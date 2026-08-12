"""Study Companion — turn material into active-recall cards with spaced repetition.

- Generate atomic flashcards from pasted material (evidence-based card design).
- Review them on an SM-2-style schedule (the spacing is where retention comes from).
- A tutor chat grounded in the same material for "I don't get this" moments.
"""
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..deps import current_user
from ..supabase_client import service_client
from .chat import (
    DEFAULT_MODEL,
    _ensure_conversation,
    _load_history,
    _save_message,
    _user_openai_client,
)

router = APIRouter(prefix="/api/study", tags=["study"])

APP = "study"
MATERIAL_CAP = 8000  # chars fed to the model (cost guard)

# Best-practice flashcard generation: atomic, recall-testing, unambiguous.
GENERATE_INSTRUCTIONS = """You are an expert learning designer creating flashcards for spaced-repetition study.
From the material, produce high-quality active-recall cards. Rules for good cards:
- ATOMIC: each card tests ONE fact or idea. Split compound ideas into separate cards.
- The question must force RECALL (not yes/no, not "true or false"). Prefer "What / Why / How / When".
- The answer is concise and unambiguous — the key fact, not a paragraph.
- Add a one-line "explanation" giving context or a memory hook (optional but helpful).
- Cover the most important concepts; skip trivia and filler.
- Use only the material provided; do not invent facts not supported by it.

Return STRICT JSON: {"title": short deck title (<=6 words), "cards": [{"question","answer","explanation"}]}.
Return ONLY the JSON object."""

TUTOR_PROMPT = """You are a patient, encouraging tutor inside an open-source app called aitech.
You help the learner actually understand their material — you explain clearly at their level, use
simple analogies, and check understanding with the occasional question (active recall beats passive
re-reading). Keep answers focused and not too long. If they're stuck, break it down step by step.
If asked about something outside their material, help briefly but say it's beyond this study set.
"""


# ── SM-2-style scheduler (pure function → unit-tested) ────────
def schedule(ease: float, interval_days: int, reps: int, lapses: int, grade: str) -> dict:
    """Return updated spaced-repetition state for a card given the user's grade.
    grade ∈ {'again','hard','good','easy'}. 'again' re-shows it in ~10 min."""
    ease = float(ease)
    interval_days = int(interval_days)
    reps = int(reps)
    lapses = int(lapses)
    prev = interval_days or 1

    if grade == "again":
        return {"ease": max(1.3, ease - 0.20), "interval_days": 0, "reps": 0,
                "lapses": lapses + 1, "due_in_minutes": 10}
    if grade == "hard":
        ease = max(1.3, ease - 0.15)
        interval = max(1, round(prev * 1.2))
    elif grade == "easy":
        ease = ease + 0.15
        interval = 4 if reps == 0 else max(1, round(prev * ease * 1.3))
    else:  # good (default)
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 3
        else:
            interval = max(1, round(prev * ease))
    return {"ease": ease, "interval_days": interval, "reps": reps + 1,
            "lapses": lapses, "due_in_days": interval}


class GenerateBody(BaseModel):
    material: str = Field(min_length=10)
    title: str | None = None
    count: int = Field(default=10, ge=4, le=20)


class TutorBody(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: str | None = None
    deck_id: str | None = None


class ReviewBody(BaseModel):
    grade: str = Field(pattern="^(again|hard|good|easy)$")


@router.post("/generate")
async def generate_deck(body: GenerateBody, user=Depends(current_user)):
    client = _user_openai_client(user.id)
    material = body.material.strip()[:MATERIAL_CAP]
    try:
        resp = client.chat.completions.create(
            model=DEFAULT_MODEL,
            response_format={"type": "json_object"},
            temperature=0.3,
            messages=[
                {"role": "system", "content": GENERATE_INSTRUCTIONS},
                {"role": "user", "content": f"Make about {body.count} cards from this material:\n\n{material}"},
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate cards: {exc}")

    raw_cards = data.get("cards") or []
    cards = [
        c for c in raw_cards
        if isinstance(c, dict) and (c.get("question") or "").strip() and (c.get("answer") or "").strip()
    ][:20]
    if not cards:
        raise HTTPException(status_code=422, detail="No usable cards were generated. Try richer material.")

    title = (body.title or data.get("title") or "Study set").strip()[:120]
    sb = service_client()
    deck = (
        sb.table("study_decks")
        .insert({"user_id": user.id, "title": title, "source_text": material[:6000]})
        .execute()
        .data[0]
    )
    rows = [
        {
            "deck_id": deck["id"],
            "user_id": user.id,
            "question": (c.get("question") or "").strip()[:1000],
            "answer": (c.get("answer") or "").strip()[:2000],
            "explanation": (c.get("explanation") or "").strip()[:2000] or None,
        }
        for c in cards
    ]
    sb.table("study_cards").insert(rows).execute()
    return {"deck": deck, "count": len(rows)}


@router.post("/tutor")
async def tutor(body: TutorBody, user=Depends(current_user)):
    client = _user_openai_client(user.id)
    conversation_id = _ensure_conversation(user.id, body.conversation_id, body.message, app=APP)
    history = _load_history(conversation_id)
    _save_message(conversation_id, user.id, "user", body.message)

    system = TUTOR_PROMPT
    if body.deck_id:
        sb = service_client()
        d = (
            sb.table("study_decks").select("source_text, title")
            .eq("id", body.deck_id).eq("user_id", user.id).maybe_single().execute()
        )
        if d and d.data and d.data.get("source_text"):
            system += f"\n\nThe learner is studying \"{d.data.get('title')}\". Their material:\n{d.data['source_text']}"

    messages = [{"role": "system", "content": system}] + history + [{"role": "user", "content": body.message}]

    def event_stream():
        yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
        collected: list[str] = []
        try:
            stream = client.chat.completions.create(
                model=DEFAULT_MODEL, messages=messages, stream=True, temperature=0.5
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    collected.append(delta)
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            full = "".join(collected)
            if full:
                _save_message(conversation_id, user.id, "assistant", full)
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/decks")
async def list_decks(user=Depends(current_user)):
    sb = service_client()
    decks = (
        sb.table("study_decks").select("id, title, created_at")
        .eq("user_id", user.id).order("created_at", desc=True).execute().data or []
    )
    cards = (
        sb.table("study_cards").select("deck_id, due_at").eq("user_id", user.id).execute().data or []
    )
    now = datetime.now(timezone.utc)
    for d in decks:
        dc = [c for c in cards if c["deck_id"] == d["id"]]
        d["card_count"] = len(dc)
        d["due_count"] = sum(1 for c in dc if datetime.fromisoformat(c["due_at"]) <= now)
    return decks


@router.get("/decks/{deck_id}")
async def get_deck(deck_id: str, user=Depends(current_user)):
    sb = service_client()
    deck = (
        sb.table("study_decks").select("*").eq("id", deck_id).eq("user_id", user.id).maybe_single().execute()
    )
    if not deck or not deck.data:
        raise HTTPException(status_code=404, detail="Deck not found.")
    cards = (
        sb.table("study_cards").select("*").eq("deck_id", deck_id).eq("user_id", user.id)
        .order("created_at").execute().data or []
    )
    return {"deck": deck.data, "cards": cards}


@router.get("/decks/{deck_id}/due")
async def due_cards(deck_id: str, user=Depends(current_user)):
    """Cards due for review now (oldest-due first)."""
    now = datetime.now(timezone.utc).isoformat()
    res = (
        service_client().table("study_cards").select("*")
        .eq("deck_id", deck_id).eq("user_id", user.id)
        .lte("due_at", now).order("due_at").execute()
    )
    return res.data or []


@router.post("/cards/{card_id}/review")
async def review_card(card_id: str, body: ReviewBody, user=Depends(current_user)):
    sb = service_client()
    c = sb.table("study_cards").select("*").eq("id", card_id).eq("user_id", user.id).maybe_single().execute()
    if not c or not c.data:
        raise HTTPException(status_code=404, detail="Card not found.")
    card = c.data
    upd = schedule(card["ease"], card["interval_days"], card["reps"], card["lapses"], body.grade)
    now = datetime.now(timezone.utc)
    if "due_in_minutes" in upd:
        due = now + timedelta(minutes=upd.pop("due_in_minutes"))
    else:
        due = now + timedelta(days=upd.pop("due_in_days"))
    sb.table("study_cards").update(
        {**upd, "due_at": due.isoformat(), "last_reviewed_at": now.isoformat()}
    ).eq("id", card_id).eq("user_id", user.id).execute()
    return {"ok": True, "due_at": due.isoformat(), "interval_days": upd["interval_days"]}


@router.delete("/decks/{deck_id}", status_code=204)
async def delete_deck(deck_id: str, user=Depends(current_user)):
    service_client().table("study_decks").delete().eq("id", deck_id).eq("user_id", user.id).execute()
    return None

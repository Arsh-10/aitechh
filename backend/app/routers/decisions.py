"""Decision Assistant — a structured decision coach.

Guides the user through a hard choice (frame → options → what matters →
trade-offs & biases → clarity), saves a structured "decision card", and lets
them revisit later to record what actually happened.
"""
import json

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

router = APIRouter(prefix="/api/decisions", tags=["decisions"])

APP = "decision"

SYSTEM_PROMPT = """You are a calm, sharp decision coach inside an open-source app called aitech.
You help someone think through a hard decision clearly — you do NOT decide for them.

Your method (adapt naturally, one focused question at a time — don't dump the whole framework):
1. Understand the decision and what's really at stake for them.
2. Surface the real options — including the status quo / "do nothing", which people forget.
3. Draw out what actually matters to THEM (their criteria and priorities). Don't assume; ask.
4. Explore trade-offs honestly. Gently surface blind spots, second-order effects, and common
   biases: sunk cost, fear-driven choices, social pressure, recency, over-weighting the reversible.
5. Where useful, use regret-minimisation ("which would you regret NOT trying?") and the
   10/10/10 lens (how you'll feel in 10 minutes, 10 months, 10 years).
6. Help them reach THEIR OWN decision with clarity and confidence.

Style: warm but direct, concise, one question at a time. Reflect their words back. Don't lecture.

Boundaries: you are not a financial, legal, or medical adviser. For decisions needing an expert
(large investments, legal/medical matters), help them think, and suggest consulting a professional.
"""

# One cheap structured call to produce the saved "decision card".
CARD_INSTRUCTIONS = """Summarise this decision-coaching conversation as STRICT JSON:
{
 "title": short label for the decision (max 8 words),
 "options": array of the real options considered (short strings),
 "criteria": array of what matters most to this person (short strings),
 "leaning": the option they seem to be leaning toward, or "undecided",
 "rationale": one sentence on why that leaning fits what matters to them,
 "key_risk": one sentence naming the main risk or thing to watch,
 "confidence": integer 1-5 for how clear/confident the decision seems
}
Base it ONLY on the conversation. Return ONLY the JSON object."""


class DecisionChat(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: str | None = None


class OutcomeBody(BaseModel):
    outcome: str = Field(min_length=1)
    rating: int | None = Field(default=None, ge=1, le=5)


@router.post("/chat")
async def decision_chat(body: DecisionChat, user=Depends(current_user)):
    client = _user_openai_client(user.id)
    conversation_id = _ensure_conversation(user.id, body.conversation_id, body.message, app=APP)
    history = _load_history(conversation_id)
    _save_message(conversation_id, user.id, "user", body.message)

    messages = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + history
        + [{"role": "user", "content": body.message}]
    )

    def event_stream():
        yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
        collected: list[str] = []
        try:
            stream = client.chat.completions.create(
                model=DEFAULT_MODEL, messages=messages, stream=True, temperature=0.6
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


@router.post("/wrap/{conversation_id}")
async def wrap_decision(conversation_id: str, user=Depends(current_user)):
    """Produce + save the structured decision card for a conversation."""
    sb = service_client()
    conv = (
        sb.table("conversations")
        .select("id, title")
        .eq("id", conversation_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not conv or not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    history = _load_history(conversation_id)
    if len(history) < 2:
        raise HTTPException(status_code=400, detail="Not enough conversation to summarise yet.")

    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in history)
    client = _user_openai_client(user.id)
    try:
        resp = client.chat.completions.create(
            model=DEFAULT_MODEL,
            response_format={"type": "json_object"},
            temperature=0.2,
            messages=[
                {"role": "system", "content": CARD_INSTRUCTIONS},
                {"role": "user", "content": transcript},
            ],
        )
        card = json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not summarise decision: {exc}")

    title = (card.get("title") or "Untitled decision")[:120]

    # Upsert one decision row per conversation.
    existing = (
        sb.table("decisions").select("id").eq("conversation_id", conversation_id).maybe_single().execute()
    )
    if existing and existing.data:
        sb.table("decisions").update({"title": title, "card": card}).eq(
            "id", existing.data["id"]
        ).execute()
        decision_id = existing.data["id"]
    else:
        ins = (
            sb.table("decisions")
            .insert(
                {
                    "user_id": user.id,
                    "conversation_id": conversation_id,
                    "title": title,
                    "card": card,
                }
            )
            .execute()
        )
        decision_id = ins.data[0]["id"]

    return {"id": decision_id, "title": title, "card": card}


@router.get("")
async def list_decisions(user=Depends(current_user)):
    res = (
        service_client()
        .table("decisions")
        .select("id, conversation_id, title, card, outcome, outcome_rating, created_at, revisited_at")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/{decision_id}")
async def get_decision(decision_id: str, user=Depends(current_user)):
    sb = service_client()
    d = (
        sb.table("decisions")
        .select("*")
        .eq("id", decision_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not d or not d.data:
        raise HTTPException(status_code=404, detail="Decision not found.")
    messages = _load_history(d.data["conversation_id"]) if d.data.get("conversation_id") else []
    return {"decision": d.data, "messages": messages}


@router.post("/{decision_id}/outcome")
async def record_outcome(decision_id: str, body: OutcomeBody, user=Depends(current_user)):
    """Revisit a past decision and record what actually happened."""
    from datetime import datetime, timezone

    sb = service_client()
    d = sb.table("decisions").select("id").eq("id", decision_id).eq("user_id", user.id).maybe_single().execute()
    if not d or not d.data:
        raise HTTPException(status_code=404, detail="Decision not found.")
    sb.table("decisions").update(
        {
            "outcome": body.outcome,
            "outcome_rating": body.rating,
            "revisited_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", decision_id).eq("user_id", user.id).execute()
    return {"ok": True}


@router.delete("/{decision_id}", status_code=204)
async def delete_decision(decision_id: str, user=Depends(current_user)):
    sb = service_client()
    row = sb.table("decisions").select("conversation_id").eq("id", decision_id).eq("user_id", user.id).maybe_single().execute()
    sb.table("decisions").delete().eq("id", decision_id).eq("user_id", user.id).execute()
    if row and row.data and row.data.get("conversation_id"):
        sb.table("conversations").delete().eq("id", row.data["conversation_id"]).eq("user_id", user.id).execute()
    return None

"""Emotional-support chat: streams from OpenAI using the user's own key,
and persists conversation history in Supabase."""
import json
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field

from .. import llm, memory
from ..config import get_settings
from ..crypto import decrypt
from ..deps import current_user
from ..memory import MemoryExtract
from ..supabase_client import service_client

router = APIRouter(prefix="/api/chat", tags=["chat"])

# The system prompt defines a warm, reflective companion — explicitly NOT a
# therapist — with crisis-aware guardrails.
SYSTEM_PROMPT = """You are a warm, grounded reflection companion inside an open-source app called aitech.

Your role:
- Help the person slow down, name what they're feeling, and reflect.
- Listen more than you advise. Validate emotions without judgement.
- Keep replies concise and human — usually 2–4 sentences.
- Ask gentle, open questions when they help, but do NOT end every message with a
  question. Sometimes a warm reflection, or simply sitting with what they said, is
  enough. Vary how you respond so it feels natural, not like a script.

Hard boundaries:
- You are NOT a therapist, doctor, or a substitute for professional care. If asked, say so plainly.
- Never diagnose or give medical/clinical instructions.
"""

# Region-aware crisis guidance. We can't reliably know the user's country, so we
# list a few well-known lines and always fall back to "your local emergency number".
CRISIS_GUIDANCE = """CRISIS — this message suggests possible self-harm, suicidal thoughts, or immediate danger.
This takes priority over everything else. Respond with warmth and without judgement, and:
- Tell them clearly you're concerned and glad they said something.
- Gently and directly encourage them to reach out for help right now, to a real person.
- Offer these options and to use their local emergency number:
    • UAE: 998 (ambulance) or the national mental-health support line 800-HOPE (800 4673)
    • US / Canada: call or text 988
    • UK / Ireland: Samaritans 116 123
    • Or their local emergency number.
- Ask if they are safe right now. Do NOT moralise, lecture, or try to 'treat' them."""

# Appended DETERMINISTICALLY whenever crisis is detected, so the concrete helpline
# numbers appear 100% of the time rather than relying on the model to include them.
CRISIS_RESOURCE_FOOTER = (
    "\n\n———\n"
    "You don't have to face this alone — please reach out to someone right now:\n"
    "• UAE: 998 (ambulance) or 800-HOPE (800 4673)\n"
    "• US & Canada: call or text 988\n"
    "• UK & Ireland: Samaritans 116 123\n"
    "• Or your local emergency number.\n"
    "If you're in immediate danger, call your local emergency services now."
)

# Adaptive support modes: the companion detects the person's situation and shifts
# its whole approach — tone, pacing, and technique — to match. This is what makes
# it feel like it understands *your* specific situation, not a generic chatbot.
SUPPORT_MODES: dict[str, str] = {
    "grief_breakup": (
        "SITUATION: heartbreak or the loss of a relationship. Sit WITH the pain rather than "
        "fixing it. Validate the loss and how disorienting it feels. Do not rush them toward "
        "'moving on', lessons, or silver linings. Be tender, unhurried, and present."
    ),
    "work_stress": (
        "SITUATION: stress about work, deadlines, or burnout. Help them externalise and untangle "
        "it. Gently separate what is in their control from what isn't. Explore boundaries and one "
        "concrete next step. Steadying and lightly practical — but still ask before advising."
    ),
    "anxiety": (
        "SITUATION: anxiety, worry, or spiralling thoughts. Slow things down first. Offer a small "
        "grounding moment (one slow breath, or naming a few things they can see) before exploring. "
        "Keep sentences short and calm. Ask one question at a time, never several."
    ),
    "loneliness": (
        "SITUATION: loneliness or disconnection. Meet them with real warmth and presence so they "
        "feel less alone in this moment. Be curious about the connection they have or long for. "
        "Avoid clichés like 'just put yourself out there'."
    ),
    "low_mood": (
        "SITUATION: low, flat, or unmotivated mood. Be gentle and do not overwhelm them. Validate "
        "that low energy is real and not a failing. Explore one very small, kind next step rather "
        "than big plans. Never imply they should just cheer up."
    ),
    "relationship_conflict": (
        "SITUATION: conflict or tension with someone. Help them feel heard first, then gently "
        "explore the other perspective without taking sides or judging. Focus on their needs and "
        "what they can influence."
    ),
    "general": (
        "Follow your general approach: warm, curious, reflective. Listen for what matters most and "
        "gently help them explore it."
    ),
}

# Cheap, fast classifier run before each reply to pick the mode + flag crisis.
CLASSIFY_INSTRUCTIONS = """You route messages for a reflection-support app. Return STRICT JSON only:
{"mode": one of ["grief_breakup","work_stress","anxiety","loneliness","low_mood","relationship_conflict","general"],
 "crisis": boolean}
Set "crisis" true only if the latest message suggests self-harm, suicidal thoughts, or immediate danger.
Pick the mode that best fits what the person is going through in their latest message."""

# Human-readable labels for the detected mode (shown subtly in the UI).
MODE_LABELS: dict[str, str] = {
    "grief_breakup": "Sitting with heartbreak",
    "work_stress": "Untangling work stress",
    "anxiety": "Finding some calm",
    "loneliness": "Feeling less alone",
    "low_mood": "Gently, at your pace",
    "relationship_conflict": "Working through conflict",
    "general": "Here with you",
}

DEFAULT_MODEL = "gpt-4o-mini"

# Note: text-to-speech is handled entirely on the client via the browser's free
# Web Speech API (see frontend/src/lib/tts.ts). No server TTS, no per-use cost.

# One cheap structured call at the end of a session that produces a takeaway,
# tags the primary emotion, and evolves the user's private memory profile.
WRAP_INSTRUCTIONS = """You analyse a reflection-companion conversation and return STRICT JSON.

Given the prior memory profile and the new conversation, return an object with:
- "primary_emotion": one lowercase word for the dominant feeling the person expressed
  (e.g. anxious, sad, hopeful, angry, calm, overwhelmed, lonely, grateful).
- "takeaway": one warm, second-person sentence (max 25 words) capturing the most
  meaningful realisation or theme from THIS conversation. No preamble.
- "memory_summary": an UPDATED private profile of this person in <=120 words, written
  in third person. Merge the prior profile with what's new: recurring themes, important
  people, stressors, what seems to help, goals. Keep only durable facts, not small talk.
- "themes": array of up to 8 short lowercase tags of recurring life themes
  (e.g. "work stress", "family", "sleep", "self-doubt").

Return ONLY the JSON object, nothing else."""


# Extracted after each session into the pgvector memory store.
MEMORY_EXTRACT_INSTRUCTIONS = (
    "From this reflection conversation, extract a short list of durable memories "
    "worth recalling in future sessions. Each memory has a kind "
    "(person/stressor/helps/goal/theme/event/preference), a concise third-person "
    "text, and a salience 1-5. Keep only durable facts — skip small talk and "
    "one-off details. Return at most 6, most salient first."
)


class Classification(BaseModel):
    mode: Literal[
        "grief_breakup", "work_stress", "anxiety", "loneliness",
        "low_mood", "relationship_conflict", "general",
    ]
    crisis: bool


class SessionWrap(BaseModel):
    primary_emotion: str
    takeaway: str
    memory_summary: str
    themes: list[str]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: str | None = None
    model: str = DEFAULT_MODEL


def _load_memory(user_id: str) -> dict:
    res = (
        service_client()
        .table("user_memory")
        .select("summary, themes")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return (res.data if (res and res.data) else {"summary": "", "themes": []})


def _system_prompt_for(
    user_id: str,
    mode: str = "general",
    crisis: bool = False,
    client: OpenAI | None = None,
    query: str = "",
) -> str:
    """Base prompt, adapted to the detected situation and enriched with memory."""
    parts = [SYSTEM_PROMPT]

    # Adapt approach to the person's situation.
    guidance = SUPPORT_MODES.get(mode, SUPPORT_MODES["general"])
    parts.append("\nHow to show up right now:\n" + guidance)

    # Crisis guidance takes priority when detected.
    if crisis:
        parts.append("\n" + CRISIS_GUIDANCE)

    # Continuity from the rolling memory profile.
    mem = _load_memory(user_id)
    summary = (mem.get("summary") or "").strip()
    if summary:
        parts.append(
            "\nWhat you remember about this person (use it gently and naturally to show "
            "continuity — do NOT recite it back or list it):\n" + summary
        )

    # Specific memories most relevant to THIS message (pgvector retrieval).
    if client is not None and query:
        recalled = memory.format_for_prompt(memory.retrieve(user_id, client, query))
        if recalled:
            parts.append(
                "\nSpecific things you recall that may be relevant right now "
                "(weave in naturally only if it helps; never list them back):\n" + recalled
            )
    return "\n".join(parts)


def _classify(client: OpenAI, message: str, history: list[dict]) -> dict:
    """Detect the support mode + crisis flag for the latest message.

    Two safety signals are combined: a strict structured-output classifier and
    the moderation endpoint. Crisis fires if EITHER flags it (higher recall — we
    would much rather over-surface help than miss it). Safe default on failure.
    """
    recent = "\n".join(f"{m['role']}: {m['content']}" for m in history[-4:])
    mod = llm.moderate(client, message)
    parsed = llm.parse_structured(
        client,
        label="classify",
        model=get_settings().utility_model,
        schema=Classification,
        temperature=0,
        max_tokens=50,
        messages=[
            {"role": "system", "content": CLASSIFY_INSTRUCTIONS},
            {"role": "user", "content": f"Recent context:\n{recent}\n\nLatest message:\n{message}"},
        ],
    )
    if parsed is None:
        return {"mode": "general", "crisis": mod["self_harm"]}
    mode = parsed.mode if parsed.mode in SUPPORT_MODES else "general"
    return {"mode": mode, "crisis": bool(parsed.crisis) or mod["self_harm"]}


def _user_openai_client(user_id: str) -> OpenAI:
    res = (
        service_client()
        .table("user_keys")
        .select("encrypted_key")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(
            status_code=400,
            detail="No OpenAI key on file. Add your key in Settings first.",
        )
    api_key = decrypt(res.data["encrypted_key"])
    s = get_settings()
    kwargs: dict = {"api_key": api_key}
    if s.openai_base_url:
        # Point at any OpenAI-compatible endpoint (local model, OpenRouter, …).
        kwargs["base_url"] = s.openai_base_url
    return OpenAI(**kwargs)


def _ensure_conversation(
    user_id: str, conversation_id: str | None, first_message: str, app: str = "emotional-support"
) -> str:
    sb = service_client()
    if conversation_id:
        return conversation_id
    title = (first_message[:60] + "…") if len(first_message) > 60 else first_message
    res = (
        sb.table("conversations")
        .insert({"user_id": user_id, "title": title, "app": app})
        .execute()
    )
    return res.data[0]["id"]


def _load_history(conversation_id: str) -> list[dict]:
    res = (
        service_client()
        .table("messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    return [{"role": m["role"], "content": m["content"]} for m in (res.data or [])]


def _save_message(conversation_id: str, user_id: str, role: str, content: str) -> None:
    service_client().table("messages").insert(
        {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": role,
            "content": content,
        }
    ).execute()


@router.post("")
async def chat(body: ChatRequest, user=Depends(current_user)):
    client = _user_openai_client(user.id)
    conversation_id = _ensure_conversation(user.id, body.conversation_id, body.message)

    history = _load_history(conversation_id)
    _save_message(conversation_id, user.id, "user", body.message)

    # Detect the person's situation so we can adapt tone, pacing, and technique.
    detected = _classify(client, body.message, history)
    mode, crisis = detected["mode"], detected["crisis"]

    messages = (
        [{"role": "system", "content": _system_prompt_for(user.id, mode, crisis, client=client, query=body.message)}]
        + history
        + [{"role": "user", "content": body.message}]
    )

    def event_stream():
        # First frame carries the conversation id + detected mode/crisis for the client.
        yield f"data: {json.dumps({'conversation_id': conversation_id, 'mode': mode, 'mode_label': MODE_LABELS.get(mode), 'crisis': crisis})}\n\n"
        collected: list[str] = []
        t0 = time.perf_counter()
        usage = None
        try:
            create_kw: dict = {
                "model": body.model,
                "messages": messages,
                "stream": True,
                "temperature": 0.7,
            }
            # usage-in-stream isn't universal across OpenAI-compatible servers,
            # so only ask for it when hitting OpenAI itself.
            if not get_settings().openai_base_url:
                create_kw["stream_options"] = {"include_usage": True}
            stream = client.chat.completions.create(**create_kw)
            for chunk in stream:
                if getattr(chunk, "usage", None):
                    usage = chunk.usage
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    collected.append(delta)
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as exc:  # surface OpenAI errors to the client
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        else:
            llm.record_usage("reply", body.model, usage, (time.perf_counter() - t0) * 1000)
        finally:
            # Safety: when crisis is detected, always surface concrete helplines,
            # regardless of what the model produced.
            if crisis:
                collected.append(CRISIS_RESOURCE_FOOTER)
                yield f"data: {json.dumps({'delta': CRISIS_RESOURCE_FOOTER})}\n\n"
            full = "".join(collected)
            if full:
                _save_message(conversation_id, user.id, "assistant", full)
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class WrapResult(BaseModel):
    takeaway: str | None = None
    primary_emotion: str | None = None


@router.post("/wrap/{conversation_id}", response_model=WrapResult)
async def wrap_session(conversation_id: str, user=Depends(current_user)):
    """End-of-session reflection: derive a takeaway + emotion and evolve memory.
    Idempotent-ish: if the conversation has fewer than 2 messages, does nothing."""
    sb = service_client()
    # Ownership check.
    conv = (
        sb.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not conv or not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    history = _load_history(conversation_id)
    if len(history) < 2:
        return WrapResult()

    prior = _load_memory(user.id)
    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in history)
    client = _user_openai_client(user.id)

    wrap = llm.parse_structured(
        client,
        label="wrap",
        model=get_settings().utility_model,
        schema=SessionWrap,
        temperature=0.3,
        messages=[
            {"role": "system", "content": WRAP_INSTRUCTIONS},
            {
                "role": "user",
                "content": (
                    f"PRIOR MEMORY PROFILE:\n{prior.get('summary') or '(none yet)'}\n\n"
                    f"PRIOR THEMES: {prior.get('themes') or []}\n\n"
                    f"NEW CONVERSATION:\n{transcript}"
                ),
            },
        ],
    )
    if wrap is None:
        raise HTTPException(status_code=502, detail="Could not summarise session.")

    takeaway = (wrap.takeaway or "").strip() or None
    emotion = (wrap.primary_emotion or "").strip().lower() or None
    summary = (wrap.memory_summary or "").strip()
    themes = [str(t).strip().lower() for t in (wrap.themes or []) if str(t).strip()][:8]

    # Persist conversation enrichment.
    sb.table("conversations").update(
        {"takeaway": takeaway, "primary_emotion": emotion}
    ).eq("id", conversation_id).eq("user_id", user.id).execute()

    # Evolve the rolling memory profile.
    if summary or themes:
        sb.table("user_memory").upsert(
            {"user_id": user.id, "summary": summary, "themes": themes},
            on_conflict="user_id",
        ).execute()

    # Extract specific, embeddable memories for cross-session recall (pgvector).
    try:
        extract = llm.parse_structured(
            client,
            label="memory_extract",
            model=get_settings().utility_model,
            schema=MemoryExtract,
            temperature=0.2,
            messages=[
                {"role": "system", "content": MEMORY_EXTRACT_INSTRUCTIONS},
                {"role": "user", "content": transcript},
            ],
        )
        if extract and extract.items:
            memory.store(user.id, client, extract.items[:6])
    except Exception:  # memory is best-effort; never fail the wrap on it
        pass

    return WrapResult(takeaway=takeaway, primary_emotion=emotion)


@router.get("/conversations")
async def list_conversations(user=Depends(current_user)):
    res = (
        service_client()
        .table("conversations")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .eq("app", "emotional-support")  # keep this app's history separate
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user=Depends(current_user)):
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
    return {"conversation": conv.data, "messages": _load_history(conversation_id)}


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str, user=Depends(current_user)):
    service_client().table("conversations").delete().eq("id", conversation_id).eq(
        "user_id", user.id
    ).execute()
    return None

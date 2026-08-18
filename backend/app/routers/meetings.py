"""Meeting → Action — turn a transcript or notes into what to actually do next.

Paste a transcript (or dictate with the browser's free speech-to-text), and get a
structured card: a TL;DR, action items with owners + due dates, decisions made, and
open questions. Export the dated actions straight to your own calendar (.ics) — we
don't send reminders ourselves, your calendar does that for free.

Free except the LLM: transcription is on-device (browser) or your own key; reminders
ride your existing calendar; storage is the shared app_items table. No paid services.
"""
import json
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from .. import llm
from ..config import get_settings
from ..deps import current_user
from ..item_store import create_item, delete_item, get_item, list_items, update_item
from .chat import (
    _ensure_conversation,
    _load_history,
    _save_message,
    _user_openai_client,
)

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

APP = "meeting"
SINGLE_CAP = 12000      # transcripts up to this go in one pass
CHUNK = 8000            # else map-reduce in chunks of this size
MAX_CHUNKS = 8          # bound cost on very long transcripts


class ActionItemOut(BaseModel):
    task: str
    owner: str            # "" if not stated
    due: str              # ISO YYYY-MM-DD, or "" if none stated/inferable
    priority: Literal["high", "medium", "low"]


class MeetingCardOut(BaseModel):
    title: str
    summary: str
    action_items: list[ActionItemOut]
    decisions: list[str]
    questions: list[str]


def _instructions() -> str:
    today = date.today().isoformat()
    return (
        "You turn a meeting transcript or rough notes into an action-focused card. "
        "Extract ONLY what is in the text — never invent tasks, owners, or dates.\n"
        f"Today's date is {today}. Resolve relative deadlines (\"by Friday\", \"next week\") "
        "to an absolute ISO date (YYYY-MM-DD). If no date is stated or clearly inferable, use \"\".\n"
        "For each action item give: task (imperative, concise), owner (name/role if stated else \"\"), "
        "due (ISO date or \"\"), priority (high/medium/low).\n"
        "Also give: a short title (max 8 words), a 2-3 sentence summary, the decisions made, "
        "and the open questions / unresolved points."
    )


CHAT_PROMPT = """You help someone act on a meeting they've shared. Answer using ONLY the
transcript/notes below — if something isn't covered, say so plainly. Be concise and practical;
when useful, point to the specific action item, owner, or decision.

MEETING:
{source}"""


class AnalyzeBody(BaseModel):
    text: str = Field(min_length=20)
    title: str | None = None


class MeetingChat(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: str | None = None
    meeting_id: str | None = None


class SaveBody(BaseModel):
    data: dict


def _extract(client, text: str) -> MeetingCardOut | None:
    return llm.parse_structured(
        client,
        label="meeting.extract",
        model=get_settings().default_model,
        schema=MeetingCardOut,
        temperature=0.2,
        messages=[
            {"role": "system", "content": _instructions()},
            {"role": "user", "content": text},
        ],
    )


def _dedupe(strings: list[str]) -> list[str]:
    seen, out = set(), []
    for s in strings:
        k = s.strip().lower()
        if k and k not in seen:
            seen.add(k)
            out.append(s.strip())
    return out


def _analyze(client, text: str) -> MeetingCardOut | None:
    """Single pass for normal transcripts; map-reduce for long ones."""
    if len(text) <= SINGLE_CAP:
        return _extract(client, text)

    # MAP: extract a partial card per chunk
    chunks = [text[i : i + CHUNK] for i in range(0, len(text), CHUNK)][:MAX_CHUNKS]
    partials = [p for p in (_extract(client, c) for c in chunks) if p]
    if not partials:
        return None

    # REDUCE: merge + dedupe action items (by task), decisions, questions
    seen_tasks: set[str] = set()
    actions: list[ActionItemOut] = []
    for p in partials:
        for a in p.action_items:
            key = a.task.strip().lower()
            if key and key not in seen_tasks:
                seen_tasks.add(key)
                actions.append(a)
    return MeetingCardOut(
        title=partials[0].title,
        summary=" ".join(p.summary for p in partials)[:600],
        action_items=actions,
        decisions=_dedupe([d for p in partials for d in p.decisions]),
        questions=_dedupe([q for p in partials for q in p.questions]),
    )


def _card_to_stored(card: MeetingCardOut) -> dict:
    d = card.model_dump()
    for a in d["action_items"]:
        a["done"] = False  # per-item completion state, toggled later
    return d


@router.post("/analyze")
async def analyze(body: AnalyzeBody, user=Depends(current_user)):
    client = _user_openai_client(user.id)
    text = body.text.strip()[: CHUNK * MAX_CHUNKS]
    card = _analyze(client, text)
    if card is None:
        raise HTTPException(status_code=502, detail="Could not read that meeting. Try again.")
    stored = _card_to_stored(card)
    title = (body.title or card.title or "Meeting").strip()[:120]
    item = create_item(user.id, APP, title, stored, source_text=text)
    return {"id": item["id"], "title": title, "card": stored}


@router.post("/chat")
async def meeting_chat(body: MeetingChat, user=Depends(current_user)):
    client = _user_openai_client(user.id)
    source = ""
    if body.meeting_id:
        item = get_item(user.id, body.meeting_id)
        if item:
            source = item.get("source_text") or ""
    conversation_id = _ensure_conversation(user.id, body.conversation_id, body.message, app=APP)
    history = _load_history(conversation_id)
    _save_message(conversation_id, user.id, "user", body.message)

    system = CHAT_PROMPT.format(source=source or "(no meeting provided)")
    messages = [{"role": "system", "content": system}] + history + [{"role": "user", "content": body.message}]

    def event_stream():
        yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
        collected: list[str] = []
        try:
            stream = client.chat.completions.create(
                model=get_settings().default_model, messages=messages, stream=True, temperature=0.4
            )
            for chunk in stream:
                if not chunk.choices:
                    continue
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


@router.get("")
async def list_meetings(user=Depends(current_user)):
    return list_items(user.id, APP)


@router.get("/open")
async def open_actions(user=Depends(current_user)):
    """Carry-forward: every still-open action item across all meetings."""
    out = []
    for it in list_items(user.id, APP):
        card = it.get("data") or {}
        for a in card.get("action_items", []):
            if not a.get("done"):
                out.append({"meeting_id": it["id"], "meeting_title": it["title"], **a})
    return out


def _esc(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


def _valid_due(due: str) -> str | None:
    try:
        return datetime.strptime((due or "").strip(), "%Y-%m-%d").strftime("%Y%m%d")
    except ValueError:
        return None


@router.get("/{meeting_id}/ics")
async def export_ics(meeting_id: str, user=Depends(current_user)):
    """A calendar file of the dated action items — your calendar does the reminding, free."""
    item = get_item(user.id, meeting_id)
    if not item or item.get("app") != APP:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    title = item.get("title") or "Meeting"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//aitech//Meeting to Action//EN", "CALSCALE:GREGORIAN"]
    n = 0
    for i, a in enumerate((item.get("data") or {}).get("action_items", [])):
        d = _valid_due(a.get("due", ""))
        if not d:
            continue
        n += 1
        owner = f"  Owner: {a['owner']}" if a.get("owner") else ""
        lines += [
            "BEGIN:VEVENT",
            f"UID:{meeting_id}-{i}@aitechh.co",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{d}",
            f"DTEND;VALUE=DATE:{d}",
            f"SUMMARY:{_esc('[Action] ' + a.get('task', ''))}",
            f"DESCRIPTION:{_esc('From: ' + title + owner)}",
            "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "TRIGGER:PT9H", "END:VALARM",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    ics = "\r\n".join(lines)
    return Response(
        content=ics,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="meeting-actions.ics"', "X-Event-Count": str(n)},
    )


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: str, user=Depends(current_user)):
    item = get_item(user.id, meeting_id)
    if not item or item.get("app") != APP:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    messages = _load_history(item["conversation_id"]) if item.get("conversation_id") else []
    return {"meeting": item, "messages": messages}


@router.patch("/{meeting_id}")
async def save_meeting(meeting_id: str, body: SaveBody, user=Depends(current_user)):
    """Persist edits — mainly toggling action items done/undone."""
    item = get_item(user.id, meeting_id)
    if not item or item.get("app") != APP:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    update_item(user.id, meeting_id, body.data)
    return {"ok": True}


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(meeting_id: str, user=Depends(current_user)):
    delete_item(user.id, meeting_id)
    return None

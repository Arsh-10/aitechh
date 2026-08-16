"""Contract / Document Explainer — understand what you're signing.

Paste a contract, lease, offer letter, or terms; get a plain-English summary,
the key terms, the risky/unusual clauses to watch, and smart questions to ask.
Everything is grounded in the user's own text — no external facts, no made-up law.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..deps import current_user
from ..item_store import create_item, delete_item, get_item, list_items
from .chat import (
    DEFAULT_MODEL,
    _ensure_conversation,
    _load_history,
    _save_message,
    _user_openai_client,
)

router = APIRouter(prefix="/api/contracts", tags=["contracts"])

APP = "contract"
TEXT_CAP = 12000

ANALYZE_INSTRUCTIONS = """You explain documents (contracts, leases, offer letters, terms) in plain
English so a non-lawyer can understand them before signing. You are NOT a lawyer and you do NOT give
legal advice. Analyse ONLY the text provided — never invent clauses, numbers, or terms not present.
Be specific and reference the actual wording where useful.

Return STRICT JSON:
{
 "title": short label for the document (max 8 words),
 "summary": 2-3 sentence plain-English gist of what this document is and what it commits you to,
 "key_points": array of the most important terms, in plain English (short strings),
 "red_flags": array of {"clause": the risky/unusual/one-sided/costly term (short), "why": why to be careful},
 "questions": array of smart questions to ask before signing
}
If the text clearly isn't a document to analyse, still return the JSON with an explanatory summary.
Return ONLY the JSON object."""

CHAT_PROMPT = """You help someone understand a document they've shared. Explain clearly in plain
English, reference the specific clause when relevant, and flag anything risky or unusual. You are NOT
a lawyer and this is not legal advice — for anything important, suggest they consult a professional.
Answer using the document below; if something isn't covered by it, say so.

DOCUMENT:
{source}"""


class AnalyzeBody(BaseModel):
    text: str = Field(min_length=20)
    title: str | None = None


class ContractChat(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: str | None = None
    document_id: str | None = None


@router.post("/analyze")
async def analyze(body: AnalyzeBody, user=Depends(current_user)):
    client = _user_openai_client(user.id)
    text = body.text.strip()[:TEXT_CAP]
    try:
        resp = client.chat.completions.create(
            model=DEFAULT_MODEL,
            response_format={"type": "json_object"},
            temperature=0.2,
            messages=[
                {"role": "system", "content": ANALYZE_INSTRUCTIONS},
                {"role": "user", "content": text},
            ],
        )
        analysis = json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not analyse the document: {exc}")

    title = (body.title or analysis.get("title") or "Document").strip()[:120]
    item = create_item(user.id, APP, title, analysis, source_text=text)
    return {"id": item["id"], "title": title, "analysis": analysis}


@router.post("/chat")
async def contract_chat(body: ContractChat, user=Depends(current_user)):
    client = _user_openai_client(user.id)
    source = ""
    if body.document_id:
        item = get_item(user.id, body.document_id)
        if item:
            source = item.get("source_text") or ""
    conversation_id = _ensure_conversation(user.id, body.conversation_id, body.message, app=APP)
    history = _load_history(conversation_id)
    _save_message(conversation_id, user.id, "user", body.message)

    system = CHAT_PROMPT.format(source=source or "(no document provided)")
    messages = [{"role": "system", "content": system}] + history + [{"role": "user", "content": body.message}]

    def event_stream():
        yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
        collected: list[str] = []
        try:
            stream = client.chat.completions.create(
                model=DEFAULT_MODEL, messages=messages, stream=True, temperature=0.4
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


@router.get("")
async def list_documents(user=Depends(current_user)):
    return list_items(user.id, APP)


@router.get("/{document_id}")
async def get_document(document_id: str, user=Depends(current_user)):
    item = get_item(user.id, document_id)
    if not item or item.get("app") != APP:
        raise HTTPException(status_code=404, detail="Document not found.")
    messages = _load_history(item["conversation_id"]) if item.get("conversation_id") else []
    return {"document": item, "messages": messages}


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: str, user=Depends(current_user)):
    delete_item(user.id, document_id)
    return None

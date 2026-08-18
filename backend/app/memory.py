"""Cross-session memory for Reflection Companion.

Beyond the single rolling summary, we keep a set of small, embedded "memories"
(a person, a stressor, what helps, a goal…) in pgvector. On each new message we
retrieve the few most *relevant* ones and inject them, so the companion recalls
the right thing at the right moment — not just a generic profile.

Everything here is defensive: if the migration/extension isn't present, or the
embedding call fails, it degrades silently to the existing summary-only memory.
"""
from __future__ import annotations

import logging
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel, Field

from . import llm
from .config import get_settings
from .supabase_client import service_client

log = logging.getLogger("aitech.memory")


class MemoryItem(BaseModel):
    kind: Literal["person", "stressor", "helps", "goal", "theme", "event", "preference"]
    text: str = Field(description="One concise, durable fact about the person, in third person.")
    salience: int = Field(ge=1, le=5, description="How durable/important this is, 1 (minor) to 5 (core).")


class MemoryExtract(BaseModel):
    items: list[MemoryItem]


def _vec_literal(emb: list[float]) -> str:
    """pgvector accepts a text literal like '[0.1,0.2,...]' on insert/cast."""
    return "[" + ",".join(f"{x:.6f}" for x in emb) + "]"


def retrieve(user_id: str, client: OpenAI, query: str, k: int = 6) -> list[dict]:
    """Top-k memories most relevant to `query` (cosine). [] if unavailable."""
    s = get_settings()
    if not s.memory_enabled or not query.strip():
        return []
    try:
        emb = llm.embed(client, [query])
        if not emb:
            return []
        res = (
            service_client()
            .rpc("match_memories", {"p_user": user_id, "p_query": _vec_literal(emb[0]), "p_k": k})
            .execute()
        )
        return res.data or []
    except Exception as exc:  # noqa: BLE001 — memory is best-effort
        log.info("memory.retrieve skipped (%s)", exc)
        return []


def store(user_id: str, client: OpenAI, items: list[MemoryItem]) -> int:
    """Embed and persist extracted memories. Returns count stored (0 on skip)."""
    s = get_settings()
    if not s.memory_enabled or not items:
        return 0
    try:
        embs = llm.embed(client, [it.text for it in items])
        if len(embs) != len(items):
            return 0
        rows = [
            {
                "user_id": user_id,
                "kind": it.kind,
                "text": it.text,
                "salience": it.salience,
                "embedding": _vec_literal(embs[i]),
            }
            for i, it in enumerate(items)
        ]
        service_client().table("reflection_memories").insert(rows).execute()
        return len(rows)
    except Exception as exc:  # noqa: BLE001
        log.info("memory.store skipped (%s)", exc)
        return 0


def format_for_prompt(rows: list[dict]) -> str:
    if not rows:
        return ""
    return "\n".join(f"- ({r.get('kind', 'note')}) {r.get('text', '')}" for r in rows)

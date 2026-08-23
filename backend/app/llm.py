"""Thin observability + reliability layer over the OpenAI-compatible client.

Everything the app asks a model to do goes through here so we get, for free:
  • tracing   — every call logs model, tokens, latency, and estimated cost
  • reliability — strict structured outputs with a graceful JSON fallback
  • safety     — a moderation pre-pass helper

None of this changes what the user sees; it makes the internals observable and
robust, and gives the "Under the hood" panel real numbers to show.
"""
from __future__ import annotations

import contextlib
import contextvars
import logging
import time
from typing import TypeVar

from openai import OpenAI
from pydantic import BaseModel

from .config import get_settings

log = logging.getLogger("aitech.llm")

T = TypeVar("T", bound=BaseModel)

# USD per 1M tokens (input, output). Used only for a rough cost estimate in traces.
_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "text-embedding-3-small": (0.02, 0.0),
}

# In-memory ring buffer of the most recent traces (for the meta/debug endpoint).
_recent: list[dict] = []
_MAX_RECENT = 50

# Per-request cost meter — contextvar-isolated so concurrent requests never mix.
_cost_sink: contextvars.ContextVar = contextvars.ContextVar("llm_cost_sink", default=None)


class _Meter:
    def __init__(self) -> None:
        self.usd = 0.0


@contextlib.contextmanager
def cost_meter():
    """Sum the estimated USD cost of every LLM call made inside this block."""
    m = _Meter()
    token = _cost_sink.set(m)
    try:
        yield m
    finally:
        _cost_sink.reset(token)


def _est_cost(model: str, usage) -> float:
    price = _PRICING.get(model)
    if not price or usage is None:
        return 0.0
    p_in, p_out = price
    it = getattr(usage, "prompt_tokens", 0) or 0
    ot = getattr(usage, "completion_tokens", 0) or 0
    return round(it / 1e6 * p_in + ot / 1e6 * p_out, 6)


def _record(label: str, model: str, usage, ms: float) -> dict:
    entry = {
        "label": label,
        "model": model,
        "ms": round(ms),
        "prompt_tokens": getattr(usage, "prompt_tokens", None),
        "completion_tokens": getattr(usage, "completion_tokens", None),
        "est_cost_usd": _est_cost(model, usage),
    }
    sink = _cost_sink.get()
    if sink is not None:
        sink.usd += entry["est_cost_usd"]
    if get_settings().enable_tracing:
        log.info("llm.call %s", entry)
        _recent.append(entry)
        if len(_recent) > _MAX_RECENT:
            del _recent[: -_MAX_RECENT]
    return entry


def record_usage(label: str, model: str, usage, ms: float) -> dict:
    """Public: record a (possibly streamed) call's usage + latency into traces."""
    return _record(label, model, usage, ms)


def recent_traces() -> list[dict]:
    return list(_recent)


def usage_summary() -> dict:
    calls = len(_recent)
    cost = round(sum(e["est_cost_usd"] for e in _recent), 5)
    avg_ms = round(sum(e["ms"] for e in _recent) / calls) if calls else 0
    return {"recent_calls": calls, "recent_est_cost_usd": cost, "avg_latency_ms": avg_ms}


def chat_create(client: OpenAI, *, label: str, model: str, **kwargs):
    """Plain (non-streaming) completion, traced. Returns the raw response."""
    t = time.perf_counter()
    resp = client.chat.completions.create(model=model, **kwargs)
    _record(label, model, getattr(resp, "usage", None), (time.perf_counter() - t) * 1000)
    return resp


def parse_structured(
    client: OpenAI, *, label: str, model: str, schema: type[T], messages: list[dict], **kwargs
) -> T | None:
    """Get a validated Pydantic object out of the model.

    Tries strict structured outputs first (guaranteed-valid schema). If the
    endpoint doesn't support it (e.g. some local models), falls back to
    json_object mode and validates. Returns None only if both fail — callers
    keep a safe default for that case.
    """
    t = time.perf_counter()
    try:
        resp = client.beta.chat.completions.parse(
            model=model, messages=messages, response_format=schema, **kwargs
        )
        _record(label, model, getattr(resp, "usage", None), (time.perf_counter() - t) * 1000)
        return resp.choices[0].message.parsed
    except Exception as exc:  # noqa: BLE001 — fall back rather than fail the request
        log.warning("structured parse failed for %s (%s); falling back to json_object", label, exc)
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
                **kwargs,
            )
            _record(f"{label}:fallback", model, getattr(resp, "usage", None), (time.perf_counter() - t) * 1000)
            return schema.model_validate_json(resp.choices[0].message.content or "{}")
        except Exception as exc2:  # noqa: BLE001
            log.warning("json fallback also failed for %s (%s)", label, exc2)
            return None


def moderate(client: OpenAI, text: str) -> dict:
    """First-pass safety signal via the moderation endpoint (free on OpenAI).

    Returns {"flagged": bool, "self_harm": bool}. Fails open (all False) if the
    endpoint is unavailable — the prompt-based crisis classifier still runs, so
    moderation is an additional signal, never the only one.
    """
    try:
        res = client.moderations.create(model="omni-moderation-latest", input=text)
        r = res.results[0]
        cats = r.categories
        self_harm = bool(
            getattr(cats, "self_harm", False)
            or getattr(cats, "self_harm_intent", False)
            or getattr(cats, "self_harm_instructions", False)
        )
        return {"flagged": bool(r.flagged), "self_harm": self_harm}
    except Exception as exc:  # noqa: BLE001
        log.info("moderation unavailable (%s); relying on classifier", exc)
        return {"flagged": False, "self_harm": False}


def embed(client: OpenAI, texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings for the memory store. Traced; [] on failure."""
    if not texts:
        return []
    s = get_settings()
    t = time.perf_counter()
    try:
        resp = client.embeddings.create(model=s.embedding_model, input=texts)
        _record("embed", s.embedding_model, getattr(resp, "usage", None), (time.perf_counter() - t) * 1000)
        return [d.embedding for d in resp.data]
    except Exception as exc:  # noqa: BLE001
        log.warning("embedding failed (%s)", exc)
        return []

"""Mood check-ins, evolving user memory, and the 'You' dashboard."""
from collections import Counter
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..deps import current_user
from ..supabase_client import service_client

router = APIRouter(prefix="/api", tags=["insights"])


# ── Mood check-ins ────────────────────────────────────────────
class MoodCheckin(BaseModel):
    conversation_id: str | None = None
    phase: str = Field(pattern="^(pre|post)$")
    score: int = Field(ge=1, le=5)
    label: str | None = None


@router.post("/mood", status_code=201)
async def save_mood(body: MoodCheckin, user=Depends(current_user)):
    service_client().table("mood_checkins").insert(
        {
            "user_id": user.id,
            "conversation_id": body.conversation_id,
            "phase": body.phase,
            "score": body.score,
            "label": body.label,
        }
    ).execute()
    return {"ok": True}


# ── Memory (privacy: user can view and clear what's remembered) ─
@router.get("/memory")
async def get_memory(user=Depends(current_user)):
    res = (
        service_client()
        .table("user_memory")
        .select("summary, themes, updated_at")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        return {"summary": "", "themes": [], "updated_at": None}
    return res.data


@router.delete("/memory", status_code=204)
async def clear_memory(user=Depends(current_user)):
    service_client().table("user_memory").delete().eq("user_id", user.id).execute()
    return None


# ── Insights dashboard ────────────────────────────────────────
def _streak(dates: list[date]) -> int:
    """Consecutive-day streak counting back from today (or yesterday)."""
    if not dates:
        return 0
    days = set(dates)
    today = datetime.utcnow().date()
    # Allow the streak to be "alive" if they showed up today or yesterday.
    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("/insights")
async def insights(user=Depends(current_user)):
    sb = service_client()
    convs = (
        sb.table("conversations")
        .select("id, title, created_at, takeaway, primary_emotion")
        .eq("user_id", user.id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    moods = (
        sb.table("mood_checkins")
        .select("conversation_id, phase, score, created_at")
        .eq("user_id", user.id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    mem = (
        sb.table("user_memory")
        .select("summary, themes")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    memory = mem.data if (mem and mem.data) else {"summary": "", "themes": []}

    # Streak from session dates.
    conv_dates = [datetime.fromisoformat(c["created_at"]).date() for c in convs]

    # Mood trend: post-session scores over time (fall back to any score).
    post = [m for m in moods if m["phase"] == "post"]
    trend_src = post or moods
    mood_trend = [
        {"date": m["created_at"][:10], "score": m["score"]} for m in trend_src
    ]

    # Average before→after delta, paired by conversation.
    pre_by_conv = {m["conversation_id"]: m["score"] for m in moods if m["phase"] == "pre"}
    post_by_conv = {m["conversation_id"]: m["score"] for m in moods if m["phase"] == "post"}
    deltas = [
        post_by_conv[c] - pre_by_conv[c]
        for c in pre_by_conv
        if c in post_by_conv and c is not None
    ]
    avg_delta = round(sum(deltas) / len(deltas), 2) if deltas else None

    # Top emotions across sessions.
    emotions = Counter(
        c["primary_emotion"] for c in convs if c.get("primary_emotion")
    )
    top_emotions = [{"emotion": e, "count": n} for e, n in emotions.most_common(6)]

    # Recent takeaways.
    takeaways = [
        {"date": c["created_at"][:10], "takeaway": c["takeaway"]}
        for c in reversed(convs)
        if c.get("takeaway")
    ][:5]

    return {
        "total_sessions": len(convs),
        "streak_days": _streak(conv_dates),
        "mood_trend": mood_trend,
        "avg_mood_delta": avg_delta,
        "top_emotions": top_emotions,
        "themes": memory.get("themes", []),
        "recent_takeaways": takeaways,
        "memory_summary": memory.get("summary", ""),
    }

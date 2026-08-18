"""Small shared helper for app_items — the generic store behind the
analyze/generate mini-apps (Contract, Meeting, Career, Meal, …)."""
from .supabase_client import service_client


def create_item(user_id: str, app: str, title: str, data: dict,
                source_text: str | None = None, conversation_id: str | None = None) -> dict:
    return (
        service_client()
        .table("app_items")
        .insert({
            "user_id": user_id,
            "app": app,
            "title": (title or "")[:160],
            "source_text": (source_text or "")[:8000] or None,
            "data": data,
            "conversation_id": conversation_id,
        })
        .execute()
        .data[0]
    )


def list_items(user_id: str, app: str) -> list[dict]:
    return (
        service_client()
        .table("app_items")
        .select("id, title, data, created_at, conversation_id")
        .eq("user_id", user_id)
        .eq("app", app)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def get_item(user_id: str, item_id: str) -> dict | None:
    res = (
        service_client()
        .table("app_items")
        .select("*")
        .eq("id", item_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def update_item(user_id: str, item_id: str, data: dict) -> None:
    service_client().table("app_items").update({"data": data}).eq("id", item_id).eq(
        "user_id", user_id
    ).execute()


def delete_item(user_id: str, item_id: str) -> None:
    service_client().table("app_items").delete().eq("id", item_id).eq("user_id", user_id).execute()

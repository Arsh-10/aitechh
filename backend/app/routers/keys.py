"""Manage the user's own OpenAI API key (encrypted at rest)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..crypto import encrypt
from ..deps import current_user
from ..supabase_client import service_client

router = APIRouter(prefix="/api/keys", tags=["keys"])


class SaveKeyRequest(BaseModel):
    api_key: str = Field(min_length=20, description="The user's OpenAI API key.")
    consent: bool = Field(description="User consents to encrypted storage of their key.")


class KeyStatus(BaseModel):
    has_key: bool
    # Last 4 chars only, for the user to recognise which key is saved.
    hint: str | None = None


def _has_key_row(user_id: str):
    res = (
        service_client()
        .table("user_keys")
        .select("key_hint")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


@router.get("", response_model=KeyStatus)
async def get_key_status(user=Depends(current_user)):
    row = _has_key_row(user.id)
    if not row:
        return KeyStatus(has_key=False)
    return KeyStatus(has_key=True, hint=row.get("key_hint"))


@router.put("", response_model=KeyStatus)
async def save_key(body: SaveKeyRequest, user=Depends(current_user)):
    if not body.consent:
        raise HTTPException(
            status_code=400,
            detail="You must consent to encrypted storage of your key.",
        )
    api_key = body.api_key.strip()
    encrypted = encrypt(api_key)
    hint = api_key[-4:]
    service_client().table("user_keys").upsert(
        {
            "user_id": user.id,
            "encrypted_key": encrypted,
            "key_hint": hint,
        },
        on_conflict="user_id",
    ).execute()
    return KeyStatus(has_key=True, hint=hint)


@router.delete("", status_code=204)
async def delete_key(user=Depends(current_user)):
    service_client().table("user_keys").delete().eq("user_id", user.id).execute()
    return None

"""Supabase client helpers.

We use the service-role client on the server for DB writes (it bypasses RLS),
and verify user identity from the JWT the frontend sends on each request.
"""
from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


@lru_cache
def service_client() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


def get_user_from_token(access_token: str):
    """Return the Supabase user for a given access token, or None if invalid."""
    s = get_settings()
    anon = create_client(s.supabase_url, s.supabase_anon_key)
    try:
        resp = anon.auth.get_user(access_token)
        return resp.user if resp else None
    except Exception:
        return None

"""Application configuration loaded from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    # Service-role key: server-only, bypasses RLS. NEVER expose to the frontend.
    supabase_service_key: str = ""

    # Fernet key used to encrypt/decrypt users' OpenAI keys at rest.
    # Generate with:  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""

    # CORS: comma-separated list of allowed frontend origins.
    frontend_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ── Model / provider layer ────────────────────────────────────────────
    # Provider-agnostic: leave OPENAI_BASE_URL empty to use OpenAI. Point it at
    # any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, OpenRouter, …) to
    # self-host with your own model. This is a server-wide default for self-hosters;
    # the hosted app leaves it unset so each user's key hits OpenAI directly.
    openai_base_url: str = ""
    # The model that writes the actual reflective reply (quality matters here).
    default_model: str = "gpt-4o-mini"
    # The cheaper model for internal utility calls (classify, wrap, memory extract).
    utility_model: str = "gpt-4o-mini"
    # Embedding model for the cross-session memory store (1536 dims).
    embedding_model: str = "text-embedding-3-small"

    # ── Feature flags ─────────────────────────────────────────────────────
    # Structured logging of every LLM call (model, tokens, latency, est. cost).
    enable_tracing: bool = True
    # Cross-session pgvector memory. Degrades gracefully to summary-only memory
    # if the migration/extension isn't present, but this lets you turn it off.
    memory_enabled: bool = True

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""aitech backend — FastAPI app entrypoint.

In production (Docker/Cloud Run) the built React frontend is copied to
``backend/static`` and served by this same app, so one service serves both the
API and the site on a single origin (no CORS needed).
"""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .routers import chat, contracts, decisions, insights, keys, study

settings = get_settings()

app = FastAPI(
    title="aitech API",
    description="Open-source AI mini-apps. Bring your own OpenAI key.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(keys.router)
app.include_router(chat.router)
app.include_router(insights.router)
app.include_router(decisions.router)
app.include_router(study.router)
app.include_router(contracts.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "aitech-api", "version": "0.1.0"}


# ── Serve the built frontend (production only) ────────────────
# Registered LAST so /api/* and /health always match their handlers first.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.is_dir():
    ASSETS_DIR = STATIC_DIR / "assets"
    if ASSETS_DIR.is_dir():
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        """Serve real static files if they exist, otherwise the SPA index
        (so client-side routes like /app/emotional-support work on refresh)."""
        root = STATIC_DIR.resolve()
        candidate = (STATIC_DIR / full_path).resolve()
        # Guard against path traversal outside the static dir.
        if full_path and (candidate == root or root in candidate.parents) and candidate.is_file():
            return FileResponse(candidate)
        index = STATIC_DIR / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Not found")

"""aitech backend — FastAPI app entrypoint.

In production (Docker/Cloud Run) the built React frontend is copied to
``backend/static`` and served by this same app, so one service serves both the
API and the site on a single origin (no CORS needed).
"""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .routers import chat, contracts, decisions, insights, keys, meetings, study

settings = get_settings()

app = FastAPI(
    title="aitech API",
    description="Open-source AI mini-apps. Bring your own OpenAI key.",
    version="0.1.0",
)

# Compress responses (the JS/CSS bundle is ~920 KB raw → ~250 KB gzipped, so this
# is the single biggest page-load win). Only kicks in when the client sends
# Accept-Encoding: gzip and the body is over the threshold.
app.add_middleware(GZipMiddleware, minimum_size=900)

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
app.include_router(meetings.router)


# ── Private overlay apps (optional) ───────────────────────────
# Router modules dropped into app/routers/private/ by a private overlay are
# auto-registered here. That directory is git-ignored and absent from the
# open-source repo, so the public build runs cleanly without them.
def _load_private_routers() -> None:
    import importlib.util

    private_dir = Path(__file__).resolve().parent / "routers" / "private"
    if not private_dir.is_dir():
        return
    for py in sorted(private_dir.glob("*.py")):
        if py.name.startswith("_"):
            continue
        spec = importlib.util.spec_from_file_location(f"app.routers.private.{py.stem}", py)
        if spec is None or spec.loader is None:
            continue
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        router = getattr(module, "router", None)
        if router is not None:
            app.include_router(router)


_load_private_routers()


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "aitech-api", "version": "0.1.0"}


# ── Serve the built frontend (production only) ────────────────
# Registered LAST so /api/* and /health always match their handlers first.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# Assets are content-hashed (index-<hash>.js), so a filename never changes its
# bytes — cache them hard. index.html is NOT hashed and points at the current
# hashes, so it must always revalidate or users get stuck on a stale bundle.
_IMMUTABLE = "public, max-age=31536000, immutable"
_NO_CACHE = "no-cache"


class _CachedStatic(StaticFiles):
    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        resp.headers.setdefault("Cache-Control", _IMMUTABLE)
        return resp


if STATIC_DIR.is_dir():
    ASSETS_DIR = STATIC_DIR / "assets"
    if ASSETS_DIR.is_dir():
        app.mount("/assets", _CachedStatic(directory=ASSETS_DIR), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        """Serve real static files if they exist, otherwise the SPA index
        (so client-side routes like /app/emotional-support work on refresh)."""
        root = STATIC_DIR.resolve()
        candidate = (STATIC_DIR / full_path).resolve()
        # Guard against path traversal outside the static dir.
        if full_path and (candidate == root or root in candidate.parents) and candidate.is_file():
            # Hashed files under other folders can cache hard; anything else
            # (favicon, manifest, robots…) gets a short, revalidating cache.
            cache = _IMMUTABLE if full_path.startswith("assets/") else "public, max-age=3600"
            return FileResponse(candidate, headers={"Cache-Control": cache})
        index = STATIC_DIR / "index.html"
        if index.is_file():
            return FileResponse(index, headers={"Cache-Control": _NO_CACHE})
        raise HTTPException(status_code=404, detail="Not found")

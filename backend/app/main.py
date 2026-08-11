"""aitech backend — FastAPI app entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import chat, insights, keys

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


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "aitech-api", "version": "0.1.0"}

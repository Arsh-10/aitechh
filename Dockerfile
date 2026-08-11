# syntax=docker/dockerfile:1
# ── Stage 1: build the React frontend ────────────────────────
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Reads frontend/.env.production for VITE_* values (public config).
RUN npm run build

# ── Stage 2: Python runtime that serves API + built frontend ─
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
# Built static site → served by FastAPI at ./static
COPY --from=frontend /app/frontend/dist ./static

# Cloud Run injects PORT (defaults to 8080).
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

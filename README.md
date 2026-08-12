# aitech

**Open-source AI mini-apps you run with your own OpenAI key.**

aitech is a small, growing collection of focused AI tools built to help with real things.
Each app is open source, and you run it with your **own** OpenAI API key — so your data and
your costs stay yours.

A new mini-app ships roughly every week. **Three are live today:**

- 🧠 **Reflection Companion** — a private, judgement-free space to slow down and reflect.
- 🧭 **Decision Assistant** — think through hard choices with a structured coach, save a
  "decision card", and revisit later to record what actually happened.
- 🎓 **Study Companion** — turn any material into active-recall flashcards with spaced-repetition
  scheduling, plus a tutor grounded in your material.

> ⚠️ **Not professional advice.** These are supportive/learning tools — not a therapist, doctor,
> lawyer, or financial adviser. The Reflection Companion is crisis-aware and surfaces real
> helplines (e.g. UAE 998 / 800-HOPE, US 988, UK 116 123), but is not a substitute for
> professional care.

---

## Features

**Shared across every app**
- 🔐 **Bring your own OpenAI key** — encrypted at rest, never stored in plaintext, deletable any time.
- 💬 **Streaming chat** with per-app, purpose-built system prompts.
- 🔊 **Read aloud** — free, on-device voice (browser Web Speech API) with adjustable speed
  (1× / 1.25× / 1.5× / 2×) and voice selection. No API key, no server, no per-use cost.
- 🌗 **Light/dark theme**, mobile-friendly, and a signature "breathing orb" identity.

**Reflection Companion** — adaptive support modes (detects heartbreak / work stress / anxiety /
loneliness / low mood / conflict and shifts tone & technique), region-aware crisis handling,
mood check-ins, an evolving private memory, and a "You" dashboard (mood trend, streak, themes,
takeaways).

**Decision Assistant** — a structured decision coach (options incl. status quo, your own criteria,
trade-offs, bias-spotting, regret-minimization), a saved decision card, and an outcome-revisit loop.

**Study Companion** — auto-generates atomic active-recall cards from your material, schedules
reviews with an SM-2-style spaced-repetition algorithm, and offers a tutor grounded in your notes.

---

## Architecture

A monorepo with three parts:

```
aitech/
├── backend/      FastAPI (Python) — auth verification, encrypted keys, chat, TTS, insights
├── frontend/     React + Vite + TypeScript + Tailwind + shadcn/Radix
└── supabase/     Database schema + migrations (auth, conversations, messages,
                  encrypted keys, mood, memory)
```

- **Auth & storage:** [Supabase](https://supabase.com) (email + password, free tier).
- **Your OpenAI key** is **encrypted with Fernet** on the backend before it is ever stored,
  and decrypted only in memory to make requests on your behalf. Never logged, never sent to
  the frontend.
- **Chat** streams from OpenAI to your browser via Server-Sent Events; history + mood + memory
  are saved to Supabase so you can pick up where you left off.
- **Cost is tiny** — a full reflection session on `gpt-4o-mini` costs the user roughly a cent
  or two. Voice is free (on-device). You pay nothing for their usage.

### Key API routes
| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness check |
| `PUT/GET/DELETE /api/keys` | Manage the encrypted OpenAI key |
| `POST /api/chat` | Streaming chat (detects mode + crisis) |
| `POST /api/chat/wrap/{id}` | End-of-session takeaway, emotion, memory update |
| `POST /api/mood` | Save a mood check-in |
| `GET/DELETE /api/memory` | View / clear what the companion remembers |
| `GET /api/insights` | Dashboard data |
| `POST /api/decisions/chat` · `…/wrap/{id}` · `…/{id}/outcome` | Decision coach, decision card, outcome revisit |
| `POST /api/study/generate` · `…/tutor` · `…/cards/{id}/review` | Generate cards, grounded tutor, SM-2 review |

---

## Prerequisites

- **Python** 3.11+
- **Node** 18+ and npm
- A free **Supabase** project
- An **OpenAI API key** (each user brings their own in the app)

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. (This creates everything,
   including the v1.1 tables. Existing installs can instead run
   [`supabase/migrations/002_v1_1_insights.sql`](supabase/migrations/002_v1_1_insights.sql).)
3. **Project Settings → API**, copy your **Project URL**, **anon/publishable** key, and
   **service_role/secret** key (server-only — keep it secret).
4. **Authentication → Sign In / Providers → Email**: keep **Enable Email provider ON**, and for
   frictionless local testing turn **Confirm email OFF**.

---

## 2. Run the backend

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # then fill it in (see below)
uvicorn app.main:app --reload --port 8000
```

Generate the encryption key for `.env`:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

`backend/.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_KEY=your-service-role-or-secret-key
ENCRYPTION_KEY=paste-the-generated-fernet-key
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Health check: http://localhost:8000/health → `{"status":"ok",...}`. Docs: http://localhost:8000/docs.

---

## 3. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env   # then fill it in
npm run dev
```

`frontend/.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_API_URL=http://localhost:8000
```

Open http://localhost:5173, sign up, add your OpenAI key once, and start reflecting.

---

## How your key is handled

1. You paste your OpenAI key in the app and tick a consent box.
2. The backend encrypts it with Fernet using `ENCRYPTION_KEY` (which lives only on the server).
3. Only the **encrypted** token and the last 4 characters (for recognition) are stored.
4. On each request the backend decrypts it in memory, calls OpenAI, and discards the plaintext.
5. You can delete your stored key any time from **Settings**.

Because `ENCRYPTION_KEY` never leaves your server and is not in the repo, a database leak alone
does not expose usable keys.

---

## Adding a new mini-app

1. Add an entry to [`frontend/src/lib/apps.ts`](frontend/src/lib/apps.ts).
2. Create a page under `frontend/src/pages/` and a route in `frontend/src/App.tsx`.
3. Add any backend endpoints under `backend/app/routers/`.

---

## Responsible use

This project touches sensitive territory. If you deploy it:

- Keep the "not a therapist / not medical advice" disclaimer visible.
- Keep and localise the crisis resources for your audience.
- Don't claim it treats depression or any condition.
- Respect privacy: the key and conversations are the user's; make that promise real.

---

## License

[Apache 2.0](LICENSE).

---

*A personal, open-source project — built for people.*

-- aitech v1.1 — mood tracking, evolving memory, and session insights.
-- Idempotent: safe to run on top of the initial schema.sql.

-- ─────────────────────────────────────────────────────────────
-- mood_checkins: how the user felt before/after a session (1–5).
-- The before/after pair is what lets us show "did this help?".
-- ─────────────────────────────────────────────────────────────
create table if not exists public.mood_checkins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  phase           text not null check (phase in ('pre', 'post')),
  score           int  not null check (score between 1 and 5),
  label           text,
  created_at      timestamptz not null default now()
);
create index if not exists mood_user_idx
  on public.mood_checkins (user_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- user_memory: an evolving, private profile the companion builds
-- so it "remembers" the person across sessions. This is the moat.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_memory (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  summary    text  not null default '',
  themes     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Conversation enrichment: a one-line takeaway + detected emotion.
-- ─────────────────────────────────────────────────────────────
alter table public.conversations add column if not exists takeaway        text;
alter table public.conversations add column if not exists primary_emotion text;

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security (owner-only), consistent with the base schema.
-- ─────────────────────────────────────────────────────────────
alter table public.mood_checkins enable row level security;
alter table public.user_memory   enable row level security;

drop policy if exists "own moods" on public.mood_checkins;
create policy "own moods" on public.mood_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own memory" on public.user_memory;
create policy "own memory" on public.user_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

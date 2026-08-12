-- aitech database schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Auth users live in Supabase's built-in `auth.users` table; we reference them.

-- ─────────────────────────────────────────────────────────────
-- user_keys: one encrypted OpenAI key per user.
-- The encrypted_key is a Fernet token produced by the backend; the
-- database never sees the plaintext key.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_keys (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  encrypted_key text not null,
  key_hint      text,                       -- last 4 chars, for recognition only
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- conversations: a chat thread belonging to a user.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now()
);
create index if not exists conversations_user_idx
  on public.conversations (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- messages: individual turns within a conversation.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security.
-- The backend uses the service-role key (which bypasses RLS) for writes,
-- but we still enable RLS + owner-only policies so that if the anon key is
-- ever used directly from a client, users can only ever touch their own rows.
-- ─────────────────────────────────────────────────────────────
alter table public.user_keys      enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;

drop policy if exists "own keys" on public.user_keys;
create policy "own keys" on public.user_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════
-- v1.1 — mood tracking, evolving memory, session insights.
-- (Also available standalone as migrations/002_v1_1_insights.sql.)
-- ═════════════════════════════════════════════════════════════

-- How the user felt before/after a session (1–5). The before/after pair
-- is what lets us show "did this help?".
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

-- An evolving, private profile the companion builds so it "remembers" the
-- person across sessions.
create table if not exists public.user_memory (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  summary    text  not null default '',
  themes     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Per-conversation enrichment: a one-line takeaway + detected emotion.
alter table public.conversations add column if not exists takeaway        text;
alter table public.conversations add column if not exists primary_emotion text;

alter table public.mood_checkins enable row level security;
alter table public.user_memory   enable row level security;

drop policy if exists "own moods" on public.mood_checkins;
create policy "own moods" on public.mood_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own memory" on public.user_memory;
create policy "own memory" on public.user_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════
-- Decision Assistant (2nd mini-app).
-- (Also available standalone as migrations/003_decision_assistant.sql.)
-- ═════════════════════════════════════════════════════════════
alter table public.conversations
  add column if not exists app text not null default 'emotional-support';
create index if not exists conversations_app_idx
  on public.conversations (user_id, app, created_at desc);

create table if not exists public.decisions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  title           text not null default 'Untitled decision',
  card            jsonb,
  outcome         text,
  outcome_rating  int check (outcome_rating between 1 and 5),
  created_at      timestamptz not null default now(),
  revisited_at    timestamptz
);
create index if not exists decisions_user_idx
  on public.decisions (user_id, created_at desc);

alter table public.decisions enable row level security;
drop policy if exists "own decisions" on public.decisions;
create policy "own decisions" on public.decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

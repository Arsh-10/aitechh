-- aitech — Decision Assistant (2nd mini-app).
-- Idempotent: safe to run on top of earlier schema.

-- Tag conversations by which mini-app they belong to, so each app only ever
-- sees its own history (Reflection Companion vs Decision Assistant, etc.).
alter table public.conversations
  add column if not exists app text not null default 'emotional-support';
create index if not exists conversations_app_idx
  on public.conversations (user_id, app, created_at desc);

-- One row per decision the user thinks through. The structured "decision card"
-- (options, criteria, leaning, risk, confidence) is stored as JSON, plus an
-- optional follow-up outcome so the app can learn whether decisions worked.
create table if not exists public.decisions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  title           text not null default 'Untitled decision',
  card            jsonb,                 -- {options, criteria, leaning, rationale, key_risk, confidence}
  outcome         text,                  -- what they actually decided / what happened (filled on revisit)
  outcome_rating  int check (outcome_rating between 1 and 5),  -- did it work out? 1..5
  created_at      timestamptz not null default now(),
  revisited_at    timestamptz
);
create index if not exists decisions_user_idx
  on public.decisions (user_id, created_at desc);

alter table public.decisions enable row level security;
drop policy if exists "own decisions" on public.decisions;
create policy "own decisions" on public.decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- aitech — Study Companion (3rd mini-app).
-- Active-recall cards with SM-2-style spaced-repetition scheduling.
-- Idempotent: safe to run on top of earlier schema.

-- A study set generated from some material the user pasted.
create table if not exists public.study_decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'Study set',
  source_text text,                       -- the material (trimmed) for tutor grounding
  created_at  timestamptz not null default now()
);
create index if not exists study_decks_user_idx on public.study_decks (user_id, created_at desc);

-- One flashcard. SM-2 fields drive spaced repetition:
--   ease (difficulty factor), interval_days (gap until next review), due_at,
--   reps (successful reviews in a row), lapses (times forgotten).
create table if not exists public.study_cards (
  id               uuid primary key default gen_random_uuid(),
  deck_id          uuid not null references public.study_decks (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  question         text not null,
  answer           text not null,
  explanation      text,
  ease             double precision not null default 2.5,
  interval_days    integer not null default 0,
  reps             integer not null default 0,
  lapses           integer not null default 0,
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists study_cards_due_idx on public.study_cards (user_id, due_at);
create index if not exists study_cards_deck_idx on public.study_cards (deck_id);

alter table public.study_decks enable row level security;
alter table public.study_cards enable row level security;

drop policy if exists "own decks" on public.study_decks;
create policy "own decks" on public.study_decks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cards" on public.study_cards;
create policy "own cards" on public.study_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

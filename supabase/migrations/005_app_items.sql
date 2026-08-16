-- aitech — generic store for "analyze / generate + save + revisit" mini-apps.
-- One table powers Contract Explainer, Meeting-to-Action, Career Roadmap,
-- Meal Planner, and similar future apps, so they need no per-app migrations.
-- Idempotent: safe to run on top of earlier schema.

create table if not exists public.app_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  app             text not null,                 -- e.g. 'contract', 'meeting', 'career', 'meal'
  conversation_id uuid references public.conversations (id) on delete set null,
  title           text not null default '',
  source_text     text,                          -- the user's input (for grounding follow-up chat)
  data            jsonb,                          -- the structured output for this app
  created_at      timestamptz not null default now()
);
create index if not exists app_items_user_app_idx
  on public.app_items (user_id, app, created_at desc);

alter table public.app_items enable row level security;
drop policy if exists "own app_items" on public.app_items;
create policy "own app_items" on public.app_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

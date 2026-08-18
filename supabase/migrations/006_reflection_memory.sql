-- Migration 006: cross-session memory for Reflection Companion (pgvector).
-- Stores small, embedded memories and retrieves the most relevant ones per turn.
-- Safe to run more than once.

create extension if not exists vector;

create table if not exists reflection_memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  text       text not null,
  salience   int  not null default 1,
  embedding  vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists reflection_memories_user_idx
  on reflection_memories (user_id);
create index if not exists reflection_memories_embedding_idx
  on reflection_memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table reflection_memories enable row level security;

drop policy if exists "own reflection_memories" on reflection_memories;
create policy "own reflection_memories" on reflection_memories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Cosine-similarity search, scoped to one user. The backend calls this with the
-- service role, and the explicit user_id filter keeps results per-user.
create or replace function match_memories(p_user uuid, p_query vector(1536), p_k int)
returns table (id uuid, kind text, text text, salience int, similarity float)
language sql stable as $$
  select id, kind, text, salience, 1 - (embedding <=> p_query) as similarity
  from reflection_memories
  where user_id = p_user
  order by embedding <=> p_query
  limit p_k;
$$;

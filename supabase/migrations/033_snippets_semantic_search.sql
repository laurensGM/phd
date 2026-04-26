-- Semantic search support for snippets via pgvector.
create extension if not exists vector;

alter table public.snippets
  add column if not exists embedding vector(768);

-- Approximate nearest-neighbor index (cosine distance).
create index if not exists snippets_embedding_ivfflat_idx
  on public.snippets
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Match snippets by semantic similarity against a query embedding.
create or replace function public.match_snippets_semantic(
  query_embedding vector(768),
  match_count int default 50
)
returns table (
  snippet_id uuid,
  similarity double precision
)
language sql
stable
as $$
  select
    s.id as snippet_id,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.snippets s
  where s.embedding is not null
  order by s.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

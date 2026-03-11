-- Snippets extracted from papers, optionally linked to constructs and models
create table if not exists public.snippets (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.saved_papers (id) on delete cascade,
  construct_id text null,
  model_id text null,
  content text not null,
  notes text null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists snippets_paper_id_idx on public.snippets (paper_id);
create index if not exists snippets_construct_id_idx on public.snippets (construct_id);
create index if not exists snippets_model_id_idx on public.snippets (model_id);


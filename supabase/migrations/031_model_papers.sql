-- Link saved papers to theoretical models (model_id = slug from models.json, e.g. tam, ecm-is)
create table if not exists public.model_papers (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  paper_id uuid not null references public.saved_papers (id) on delete cascade,
  created_at timestamptz default now(),
  unique (model_id, paper_id)
);

create index if not exists idx_model_papers_model_id on public.model_papers (model_id);
create index if not exists idx_model_papers_paper_id on public.model_papers (paper_id);

comment on table public.model_papers is 'Links saved papers to models for Key Citations on model detail pages.';

alter table public.model_papers enable row level security;

create policy "Allow all for model_papers"
  on public.model_papers for all
  using (true)
  with check (true);

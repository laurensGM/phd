-- Structured AI summary per paper (one row per paper)
create table if not exists public.paper_summary (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.saved_papers(id) on delete cascade,
  problem text,
  claims text,
  method text,
  results text,
  discussion text,
  limitations text,
  future_research text,
  conclusion text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(paper_id)
);

create index if not exists idx_paper_summary_paper_id on public.paper_summary(paper_id);

alter table public.paper_summary enable row level security;

create policy "Allow all for paper_summary"
  on public.paper_summary for all
  using (true)
  with check (true);

comment on table public.paper_summary is 'Structured AI-generated summary (problem, claims, method, results, etc.) for search and display';

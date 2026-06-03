-- Research contributions (thesis contribution statements)
create table if not exists public.research_contributions (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_contributions_created_at_idx
  on public.research_contributions (created_at desc);

alter table public.research_contributions enable row level security;

create policy "Allow all for research_contributions"
  on public.research_contributions for all
  using (true)
  with check (true);

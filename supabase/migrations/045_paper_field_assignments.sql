-- Manual paper ↔ field links when journal name matching is not enough
create table if not exists public.paper_field_assignments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.saved_papers (id) on delete cascade,
  field_id text not null,
  created_at timestamptz not null default now(),
  unique (paper_id, field_id)
);

create index if not exists idx_paper_field_assignments_paper_id
  on public.paper_field_assignments (paper_id);

create index if not exists idx_paper_field_assignments_field_id
  on public.paper_field_assignments (field_id);

comment on table public.paper_field_assignments is
  'Explicit field links for saved papers; combined with journal-based matching on fields.json.';

alter table public.paper_field_assignments enable row level security;

create policy "Allow all for paper_field_assignments"
  on public.paper_field_assignments for all
  using (true)
  with check (true);

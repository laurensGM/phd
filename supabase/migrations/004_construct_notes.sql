-- User notes per construct (construct_id = slug from constructs.json)
create table if not exists public.construct_notes (
  id uuid primary key default gen_random_uuid(),
  construct_id text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_construct_notes_construct_id on public.construct_notes (construct_id);

alter table public.construct_notes enable row level security;

create policy "Allow all for construct_notes"
  on public.construct_notes for all
  using (true)
  with check (true);

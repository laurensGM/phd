-- Diary entries table (single-user, no auth)
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  summary text not null,
  detailed_reflection text,
  tags text[] default '{}',
  linked_constructs text[] default '{}',
  created_at timestamptz default now()
);

-- Allow all operations with anon key (for single-user personal site)
alter table public.diary_entries enable row level security;

create policy "Allow all for diary"
  on public.diary_entries for all
  using (true)
  with check (true);

-- Meeting notes: date, title, content, participants, location (official meetings)
create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  content text,
  participants text,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.meeting_notes enable row level security;

create policy "Allow all for meeting_notes"
  on public.meeting_notes for all
  using (true)
  with check (true);

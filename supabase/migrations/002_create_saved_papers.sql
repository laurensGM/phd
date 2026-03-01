-- Saved papers: link + motivation + tags (single-user, no auth)
create table if not exists public.saved_papers (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  motivation text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

alter table public.saved_papers enable row level security;

create policy "Allow all for saved_papers"
  on public.saved_papers for all
  using (true)
  with check (true);

-- Enable RLS for snippets to avoid public-table exposure warning
alter table public.snippets enable row level security;

drop policy if exists "Allow all for snippets" on public.snippets;

create policy "Allow all for snippets"
  on public.snippets for all
  using (true)
  with check (true);

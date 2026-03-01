-- Golden nuggets: FAQs and quotes (type = 'faq' | 'quote')
-- For FAQ: content = question. For quote: content = quote text.
create table if not exists public.golden_nuggets (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('faq', 'quote')),
  content text not null,
  author text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_golden_nuggets_type on public.golden_nuggets (type);

alter table public.golden_nuggets enable row level security;

create policy "Allow all for golden_nuggets"
  on public.golden_nuggets for all
  using (true)
  with check (true);

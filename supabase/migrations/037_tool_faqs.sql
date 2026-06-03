-- Tools FAQ: question + answer pairs
create table if not exists public.tool_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tool_faqs_created_at_idx
  on public.tool_faqs (created_at desc);

alter table public.tool_faqs enable row level security;

create policy "Allow all for tool_faqs"
  on public.tool_faqs for all
  using (true)
  with check (true);

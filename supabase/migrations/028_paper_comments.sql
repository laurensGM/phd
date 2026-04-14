-- Free-form notes/comments attached to saved papers
create table if not exists public.paper_comments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.saved_papers(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists paper_comments_paper_id_idx
  on public.paper_comments (paper_id);

create index if not exists paper_comments_created_at_idx
  on public.paper_comments (created_at desc);

alter table public.paper_comments enable row level security;

drop policy if exists "Allow all for paper_comments" on public.paper_comments;

create policy "Allow all for paper_comments"
  on public.paper_comments for all
  using (true)
  with check (true);

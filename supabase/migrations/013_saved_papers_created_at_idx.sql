-- Index to speed up ordering and filtering by creation time
create index if not exists saved_papers_created_at_idx
  on public.saved_papers (created_at desc);

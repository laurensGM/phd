-- Add optional local file path for papers stored on disk
alter table public.saved_papers
  add column if not exists path text;

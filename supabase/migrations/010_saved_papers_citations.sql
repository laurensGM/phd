-- Add optional citation count for papers
alter table public.saved_papers
  add column if not exists citations integer;

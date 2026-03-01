-- Add title, authors, year for auto-fetched or manual metadata
alter table public.saved_papers
  add column if not exists title text,
  add column if not exists authors text,
  add column if not exists year text;

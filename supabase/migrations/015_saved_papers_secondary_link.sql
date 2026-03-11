-- Add a secondary link for saved papers
alter table public.saved_papers
  add column if not exists secondary_url text;

-- Remove local file path from saved_papers
alter table public.saved_papers
  drop column if exists path;

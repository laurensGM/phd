-- Add reading status to papers: Not read, 1st reading, 2nd reading, Read, Completed
alter table public.saved_papers
  add column if not exists status text not null default 'Not read';

-- Optional: constrain to allowed values (comment out if you prefer no constraint)
-- alter table public.saved_papers drop constraint if exists saved_papers_status_check;
-- alter table public.saved_papers add constraint saved_papers_status_check
--   check (status in ('Not read', '1st reading', '2nd reading', 'Read', 'Completed'));

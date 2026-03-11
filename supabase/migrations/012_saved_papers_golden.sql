-- Add a boolean flag for "golden" papers
alter table public.saved_papers
  add column if not exists golden boolean not null default false;

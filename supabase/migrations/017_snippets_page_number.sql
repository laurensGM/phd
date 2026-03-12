-- Add page number to snippets (links snippet to a page in the paper)
alter table public.snippets
  add column if not exists page_number integer null;

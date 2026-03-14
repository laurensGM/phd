-- Add journal to saved papers (e.g. "MIS Quarterly", "Journal of the AIS")
alter table public.saved_papers
  add column if not exists journal text null;

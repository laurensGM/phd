-- Cross-device "save for offline" flag (each device still caches paper/summary/audio locally)
alter table public.saved_papers
  add column if not exists saved_for_offline_at timestamptz;

comment on column public.saved_papers.saved_for_offline_at is
  'Set when user saves a paper for offline; synced so other devices download the offline bundle while online.';

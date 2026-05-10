-- Track snippets that have been incorporated into writing (vs still "raw" in the queue).
alter table public.snippets
  add column if not exists used_in_writing boolean not null default false;

comment on column public.snippets.used_in_writing is
  'True when the author has marked this snippet as processed / used in a draft or thesis section.';

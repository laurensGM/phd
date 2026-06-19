-- Audio narration for paper summaries (TTS MP3 in Supabase Storage)
alter table public.paper_summary
  add column if not exists narration_url text,
  add column if not exists narration_content_hash text;

comment on column public.paper_summary.narration_url is 'Public URL of MP3 narration of the summary (Supabase Storage).';
comment on column public.paper_summary.narration_content_hash is 'SHA-256 hash of narration script; regenerate audio when summary text changes.';

insert into storage.buckets (id, name, public)
values ('paper-narrations', 'paper-narrations', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read paper narrations" on storage.objects;
drop policy if exists "Allow insert paper narrations" on storage.objects;
drop policy if exists "Allow update paper narrations" on storage.objects;
drop policy if exists "Allow delete paper narrations" on storage.objects;

create policy "Public read paper narrations"
  on storage.objects for select
  using (bucket_id = 'paper-narrations');

create policy "Allow insert paper narrations"
  on storage.objects for insert
  with check (bucket_id = 'paper-narrations');

create policy "Allow update paper narrations"
  on storage.objects for update
  using (bucket_id = 'paper-narrations');

create policy "Allow delete paper narrations"
  on storage.objects for delete
  using (bucket_id = 'paper-narrations');

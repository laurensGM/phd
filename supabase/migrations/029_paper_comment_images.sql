-- Optional image per paper comment (public URL after upload to storage)
alter table public.paper_comments
  add column if not exists image_url text;

comment on column public.paper_comments.image_url is 'Public URL of an image attached to this comment (Supabase Storage).';

-- Bucket for comment images (public read; open policies match rest of app)
insert into storage.buckets (id, name, public)
values ('paper-comment-images', 'paper-comment-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read paper comment images" on storage.objects;
drop policy if exists "Allow insert paper comment images" on storage.objects;
drop policy if exists "Allow update paper comment images" on storage.objects;
drop policy if exists "Allow delete paper comment images" on storage.objects;

create policy "Public read paper comment images"
  on storage.objects for select
  using (bucket_id = 'paper-comment-images');

create policy "Allow insert paper comment images"
  on storage.objects for insert
  with check (bucket_id = 'paper-comment-images');

create policy "Allow update paper comment images"
  on storage.objects for update
  using (bucket_id = 'paper-comment-images');

create policy "Allow delete paper comment images"
  on storage.objects for delete
  using (bucket_id = 'paper-comment-images');

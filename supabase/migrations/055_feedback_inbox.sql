-- Product feedback / bug reports → superadmin inbox

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_id uuid references auth.users (id) on delete set null,
  author_email text,
  author_name text,
  kind text not null check (kind in ('feature', 'bug')),
  subject text,
  body text not null,
  page_url text,
  status text not null default 'unread'
    check (status in ('unread', 'read', 'archived')),
  read_at timestamptz
);

create index if not exists feedback_messages_created_at_idx
  on public.feedback_messages (created_at desc);

create index if not exists feedback_messages_status_idx
  on public.feedback_messages (status);

alter table public.feedback_messages enable row level security;

drop policy if exists "feedback_insert_authenticated" on public.feedback_messages;
create policy "feedback_insert_authenticated"
  on public.feedback_messages for insert
  to authenticated
  with check (
    auth.uid() is not null
    and author_id = auth.uid()
  );

drop policy if exists "feedback_select_superadmin" on public.feedback_messages;
create policy "feedback_select_superadmin"
  on public.feedback_messages for select
  to authenticated
  using (public.is_superadmin());

drop policy if exists "feedback_update_superadmin" on public.feedback_messages;
create policy "feedback_update_superadmin"
  on public.feedback_messages for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "feedback_delete_superadmin" on public.feedback_messages;
create policy "feedback_delete_superadmin"
  on public.feedback_messages for delete
  to authenticated
  using (public.is_superadmin());

grant select, insert, update, delete on public.feedback_messages to authenticated;

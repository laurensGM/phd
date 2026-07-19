-- Projects + memberships foundation (single project now; multi-student later).
-- Replaces open "Allow all" RLS with membership-scoped access.

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'student'
    check (role in ('owner', 'student', 'supervisor')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_user_id_idx on public.project_members (user_id);
create index if not exists project_members_project_id_idx on public.project_members (project_id);

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  role text not null default 'supervisor'
    check (role in ('student', 'supervisor')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz null,
  unique (project_id, email)
);

create index if not exists project_invites_email_idx on public.project_invites (lower(email));

-- Default project for existing personal data (claim on first login if empty)
insert into public.projects (id, name, slug)
values ('a0000000-0000-4000-8000-000000000001', 'My PhD', 'my-phd')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'student')
  );
$$;

create or replace function public.set_row_project_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if new.project_id is not null then
    return new;
  end if;
  select pm.project_id into pid
  from public.project_members pm
  where pm.user_id = auth.uid()
  order by pm.created_at
  limit 1;
  if pid is null then
    raise exception 'No project membership; sign in and join a project first';
  end if;
  new.project_id := pid;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Claim default project if it has no members yet (first student login)
create or replace function public.claim_default_project_if_empty()
returns public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  default_id uuid := 'a0000000-0000-4000-8000-000000000001';
  member_count int;
  result public.project_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into member_count
  from public.project_members
  where project_id = default_id;

  if member_count > 0 then
    select * into result
    from public.project_members
    where project_id = default_id and user_id = auth.uid();
    return result; -- may be null if already claimed by someone else
  end if;

  insert into public.profiles (id, email)
  select u.id, u.email from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;

  insert into public.project_members (project_id, user_id, role)
  values (default_id, auth.uid(), 'owner')
  returning * into result;

  return result;
end;
$$;

-- Accept pending invites for the signed-in user's email
create or replace function public.accept_my_project_invites()
returns setof public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
  inv record;
  result public.project_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select lower(u.email) into my_email
  from auth.users u
  where u.id = auth.uid();

  if my_email is null or my_email = '' then
    return;
  end if;

  insert into public.profiles (id, email)
  select u.id, u.email from auth.users u where u.id = auth.uid()
  on conflict (id) do update set email = excluded.email, updated_at = now();

  for inv in
    select *
    from public.project_invites
    where lower(email) = my_email
      and accepted_at is null
  loop
    insert into public.project_members (project_id, user_id, role)
    values (inv.project_id, auth.uid(), inv.role)
    on conflict (project_id, user_id) do update
      set role = excluded.role
    returning * into result;

    update public.project_invites
    set accepted_at = now()
    where id = inv.id;

    return next result;
  end loop;
end;
$$;

-- Invite by email (owner/student). If user already exists, add membership immediately.
create or replace function public.invite_to_project(
  p_project_id uuid,
  p_email text,
  p_role text default 'supervisor'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(p_email));
  existing_user uuid;
  member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_manage_project(p_project_id) then
    raise exception 'Only owners/students can invite';
  end if;
  if p_role not in ('student', 'supervisor') then
    raise exception 'Invalid role';
  end if;
  if normalized is null or normalized = '' or position('@' in normalized) = 0 then
    raise exception 'Invalid email';
  end if;

  select u.id into existing_user
  from auth.users u
  where lower(u.email) = normalized
  limit 1;

  if existing_user is not null then
    insert into public.profiles (id, email)
    select u.id, u.email from auth.users u where u.id = existing_user
    on conflict (id) do update set email = excluded.email, updated_at = now();

    insert into public.project_members (project_id, user_id, role)
    values (p_project_id, existing_user, p_role)
    on conflict (project_id, user_id) do update set role = excluded.role
    returning id into member_id;

    update public.project_invites
    set accepted_at = now(), role = p_role
    where project_id = p_project_id and lower(email) = normalized;

    return jsonb_build_object('status', 'added', 'user_id', existing_user, 'member_id', member_id);
  end if;

  insert into public.project_invites (project_id, email, role, invited_by)
  values (p_project_id, normalized, p_role, auth.uid())
  on conflict (project_id, email) do update
    set role = excluded.role,
        invited_by = excluded.invited_by,
        accepted_at = null,
        created_at = now();

  return jsonb_build_object('status', 'invited', 'email', normalized);
end;
$$;

revoke all on function public.claim_default_project_if_empty() from public;
revoke all on function public.accept_my_project_invites() from public;
revoke all on function public.invite_to_project(uuid, text, text) from public;
grant execute on function public.claim_default_project_if_empty() to authenticated;
grant execute on function public.accept_my_project_invites() to authenticated;
grant execute on function public.invite_to_project(uuid, text, text) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Add project_id to top-level data tables + backfill
-- ---------------------------------------------------------------------------

alter table public.diary_entries
  add column if not exists project_id uuid references public.projects (id);
alter table public.saved_papers
  add column if not exists project_id uuid references public.projects (id);
alter table public.construct_notes
  add column if not exists project_id uuid references public.projects (id);
alter table public.golden_nuggets
  add column if not exists project_id uuid references public.projects (id);
alter table public.model_notes
  add column if not exists project_id uuid references public.projects (id);
alter table public.tasks
  add column if not exists project_id uuid references public.projects (id);
alter table public.meeting_notes
  add column if not exists project_id uuid references public.projects (id);
alter table public.snippets
  add column if not exists project_id uuid references public.projects (id);
alter table public.literature_review_prompts
  add column if not exists project_id uuid references public.projects (id);
alter table public.claims
  add column if not exists project_id uuid references public.projects (id);
alter table public.research_contributions
  add column if not exists project_id uuid references public.projects (id);
alter table public.tool_faqs
  add column if not exists project_id uuid references public.projects (id);
alter table public.model_evaluation_items
  add column if not exists project_id uuid references public.projects (id);

update public.diary_entries set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.saved_papers set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.construct_notes set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.golden_nuggets set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.model_notes set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.tasks set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.meeting_notes set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.snippets set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.literature_review_prompts set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.claims set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.research_contributions set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.tool_faqs set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;
update public.model_evaluation_items set project_id = 'a0000000-0000-4000-8000-000000000001' where project_id is null;

alter table public.diary_entries alter column project_id set not null;
alter table public.saved_papers alter column project_id set not null;
alter table public.construct_notes alter column project_id set not null;
alter table public.golden_nuggets alter column project_id set not null;
alter table public.model_notes alter column project_id set not null;
alter table public.tasks alter column project_id set not null;
alter table public.meeting_notes alter column project_id set not null;
alter table public.snippets alter column project_id set not null;
alter table public.literature_review_prompts alter column project_id set not null;
alter table public.claims alter column project_id set not null;
alter table public.research_contributions alter column project_id set not null;
alter table public.tool_faqs alter column project_id set not null;
alter table public.model_evaluation_items alter column project_id set not null;

create index if not exists diary_entries_project_id_idx on public.diary_entries (project_id);
create index if not exists saved_papers_project_id_idx on public.saved_papers (project_id);
create index if not exists snippets_project_id_idx on public.snippets (project_id);
create index if not exists claims_project_id_idx on public.claims (project_id);
create index if not exists tasks_project_id_idx on public.tasks (project_id);

-- Auto-fill project_id on insert when omitted by the client
do $$
declare
  t text;
begin
  foreach t in array array[
    'diary_entries',
    'saved_papers',
    'construct_notes',
    'golden_nuggets',
    'model_notes',
    'tasks',
    'meeting_notes',
    'snippets',
    'literature_review_prompts',
    'claims',
    'research_contributions',
    'tool_faqs',
    'model_evaluation_items'
  ]
  loop
    execute format('drop trigger if exists trg_set_project_id on public.%I', t);
    execute format(
      'create trigger trg_set_project_id before insert on public.%I
       for each row execute function public.set_row_project_id()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: projects / members / invites / profiles
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.profiles enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;

drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
  on public.projects for select
  using (public.is_project_member(id));

drop policy if exists "projects_update_manager" on public.projects;
create policy "projects_update_manager"
  on public.projects for update
  using (public.can_manage_project(id));

drop policy if exists "profiles_select_self_or_coworker" on public.profiles;
create policy "profiles_select_self_or_coworker"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.project_members me
      join public.project_members them on them.project_id = me.project_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.id
    )
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "project_members_select" on public.project_members;
create policy "project_members_select"
  on public.project_members for select
  using (public.is_project_member(project_id));

-- Inserts/updates/deletes go through security definer RPCs for invites/claim
drop policy if exists "project_members_manage" on public.project_members;
create policy "project_members_manage"
  on public.project_members for all
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

drop policy if exists "project_invites_select" on public.project_invites;
create policy "project_invites_select"
  on public.project_invites for select
  using (
    public.can_manage_project(project_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "project_invites_manage" on public.project_invites;
create policy "project_invites_manage"
  on public.project_invites for all
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

-- ---------------------------------------------------------------------------
-- Replace open policies on data tables
-- ---------------------------------------------------------------------------

-- Helper macro-style: drop Allow all + create member policies
do $$
declare
  t text;
  pol text;
begin
  foreach t in array array[
    'diary_entries',
    'saved_papers',
    'construct_notes',
    'golden_nuggets',
    'model_notes',
    'tasks',
    'meeting_notes',
    'snippets',
    'literature_review_prompts',
    'claims',
    'research_contributions',
    'tool_faqs',
    'model_evaluation_items'
  ]
  loop
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol, t);
    end loop;

    execute format(
      'create policy %I on public.%I for select using (public.is_project_member(project_id))',
      t || '_select_member', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.is_project_member(project_id))',
      t || '_insert_member', t
    );
    execute format(
      'create policy %I on public.%I for update using (public.is_project_member(project_id)) with check (public.is_project_member(project_id))',
      t || '_update_member', t
    );
    execute format(
      'create policy %I on public.%I for delete using (public.is_project_member(project_id))',
      t || '_delete_member', t
    );
  end loop;
end $$;

-- Child tables: access via parent project membership
do $$
declare
  pol text;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'paper_summary'
  loop execute format('drop policy if exists %I on public.paper_summary', pol); end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'paper_comments'
  loop execute format('drop policy if exists %I on public.paper_comments', pol); end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'model_papers'
  loop execute format('drop policy if exists %I on public.model_papers', pol); end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'paper_field_assignments'
  loop execute format('drop policy if exists %I on public.paper_field_assignments', pol); end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'claim_snippets'
  loop execute format('drop policy if exists %I on public.claim_snippets', pol); end loop;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'claim_versions'
  loop execute format('drop policy if exists %I on public.claim_versions', pol); end loop;
end $$;

create policy "paper_summary_member"
  on public.paper_summary for all
  using (
    exists (
      select 1 from public.saved_papers p
      where p.id = paper_summary.paper_id and public.is_project_member(p.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.saved_papers p
      where p.id = paper_summary.paper_id and public.is_project_member(p.project_id)
    )
  );

create policy "paper_comments_member"
  on public.paper_comments for all
  using (
    exists (
      select 1 from public.saved_papers p
      where p.id = paper_comments.paper_id and public.is_project_member(p.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.saved_papers p
      where p.id = paper_comments.paper_id and public.is_project_member(p.project_id)
    )
  );

create policy "model_papers_member"
  on public.model_papers for all
  using (
    exists (
      select 1 from public.saved_papers p
      where p.id = model_papers.paper_id and public.is_project_member(p.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.saved_papers p
      where p.id = model_papers.paper_id and public.is_project_member(p.project_id)
    )
  );

create policy "paper_field_assignments_member"
  on public.paper_field_assignments for all
  using (
    exists (
      select 1 from public.saved_papers p
      where p.id = paper_field_assignments.paper_id and public.is_project_member(p.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.saved_papers p
      where p.id = paper_field_assignments.paper_id and public.is_project_member(p.project_id)
    )
  );

create policy "claim_snippets_member"
  on public.claim_snippets for all
  using (
    exists (
      select 1 from public.claims c
      where c.id = claim_snippets.claim_id and public.is_project_member(c.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.claims c
      where c.id = claim_snippets.claim_id and public.is_project_member(c.project_id)
    )
  );

create policy "claim_versions_member"
  on public.claim_versions for all
  using (
    exists (
      select 1 from public.claims c
      where c.id = claim_versions.claim_id and public.is_project_member(c.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.claims c
      where c.id = claim_versions.claim_id and public.is_project_member(c.project_id)
    )
  );

-- Storage: require signed-in users (bucket policies from earlier migrations)
do $$
declare
  pol text;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (
        policyname ilike '%paper comment%'
        or policyname ilike '%paper narration%'
        or policyname ilike '%paper-comment%'
        or policyname ilike '%paper-narration%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', pol);
  end loop;
exception when others then
  null;
end $$;

drop policy if exists "Authenticated read paper comment images" on storage.objects;
drop policy if exists "Authenticated write paper comment images" on storage.objects;
drop policy if exists "Authenticated read paper narrations" on storage.objects;
drop policy if exists "Authenticated write paper narrations" on storage.objects;
drop policy if exists "Public read paper comment images" on storage.objects;
drop policy if exists "Allow insert paper comment images" on storage.objects;
drop policy if exists "Allow update paper comment images" on storage.objects;
drop policy if exists "Allow delete paper comment images" on storage.objects;
drop policy if exists "Public read paper narrations" on storage.objects;
drop policy if exists "Allow insert paper narrations" on storage.objects;
drop policy if exists "Allow update paper narrations" on storage.objects;
drop policy if exists "Allow delete paper narrations" on storage.objects;

create policy "Authenticated read paper comment images"
  on storage.objects for select
  using (bucket_id = 'paper-comment-images' and auth.uid() is not null);

create policy "Authenticated write paper comment images"
  on storage.objects for all
  using (bucket_id = 'paper-comment-images' and auth.uid() is not null)
  with check (bucket_id = 'paper-comment-images' and auth.uid() is not null);

create policy "Authenticated read paper narrations"
  on storage.objects for select
  using (bucket_id = 'paper-narrations' and auth.uid() is not null);

create policy "Authenticated write paper narrations"
  on storage.objects for all
  using (bucket_id = 'paper-narrations' and auth.uid() is not null)
  with check (bucket_id = 'paper-narrations' and auth.uid() is not null);

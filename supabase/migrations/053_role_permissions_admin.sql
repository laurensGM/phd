-- App-level superadmin + editable role × permission matrix (placeholders for now)

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

create index if not exists profiles_is_superadmin_idx
  on public.profiles (is_superadmin)
  where is_superadmin = true;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_superadmin = true
  );
$$;

grant execute on function public.is_superadmin() to authenticated;

-- Promote existing default-project owners to superadmin (bootstrap)
update public.profiles p
set is_superadmin = true,
    updated_at = now()
from public.project_members pm
where pm.user_id = p.id
  and pm.project_id = 'a0000000-0000-4000-8000-000000000001'
  and pm.role = 'owner';

-- When claiming the empty default project, also become superadmin if none exists yet
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
  super_count int;
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
    return result;
  end if;

  insert into public.profiles (id, email)
  select u.id, u.email from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;

  insert into public.project_members (project_id, user_id, role)
  values (default_id, auth.uid(), 'owner')
  returning * into result;

  select count(*) into super_count from public.profiles where is_superadmin = true;
  if super_count = 0 then
    update public.profiles
    set is_superadmin = true, updated_at = now()
    where id = auth.uid();
  end if;

  return result;
end;
$$;

-- Permission catalog
create table if not exists public.app_permissions (
  key text primary key,
  label text not null,
  description text null,
  category text not null default 'General',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Matrix: which app role has which permission
create table if not exists public.role_permissions (
  role text not null
    check (role in ('superadmin', 'student', 'supervisor')),
  permission_key text not null references public.app_permissions (key) on delete cascade,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (role, permission_key)
);

alter table public.app_permissions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "app_permissions_select_auth" on public.app_permissions;
create policy "app_permissions_select_auth"
  on public.app_permissions for select
  to authenticated
  using (true);

drop policy if exists "app_permissions_write_superadmin" on public.app_permissions;
create policy "app_permissions_write_superadmin"
  on public.app_permissions for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "role_permissions_select_auth" on public.role_permissions;
create policy "role_permissions_select_auth"
  on public.role_permissions for select
  to authenticated
  using (true);

drop policy if exists "role_permissions_write_superadmin" on public.role_permissions;
create policy "role_permissions_write_superadmin"
  on public.role_permissions for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Placeholder permissions (can refine later)
insert into public.app_permissions (key, label, description, category, sort_order) values
  ('admin.access', 'Access admin panel', 'Open the roles & permissions admin UI', 'Admin', 10),
  ('members.manage', 'Manage project members', 'Invite, remove, and change member roles', 'Project', 20),
  ('papers.view', 'View papers', 'Browse saved papers and details', 'Literature', 30),
  ('papers.edit', 'Edit papers', 'Add, edit, or delete papers', 'Literature', 40),
  ('snippets.view', 'View snippets', 'Browse literature snippets', 'Literature', 50),
  ('snippets.edit', 'Edit snippets', 'Create and edit snippets', 'Literature', 60),
  ('claims.view', 'View claims', 'Browse claims and evidence', 'Literature', 70),
  ('claims.edit', 'Edit claims', 'Create and edit claims', 'Literature', 80),
  ('diary.view', 'View diary', 'Read research diary entries', 'Manager', 90),
  ('diary.edit', 'Edit diary', 'Write and edit diary entries', 'Manager', 100),
  ('tasks.view', 'View tasks', 'See the tasks board', 'Manager', 110),
  ('tasks.edit', 'Edit tasks', 'Create and update tasks', 'Manager', 120),
  ('meeting_notes.view', 'View meeting notes', 'Read meeting notes', 'Manager', 130),
  ('meeting_notes.edit', 'Edit meeting notes', 'Create and edit meeting notes', 'Manager', 140)
on conflict (key) do nothing;

-- Default matrix (placeholders — editable in admin UI)
insert into public.role_permissions (role, permission_key, allowed)
select r.role, p.key,
  case
    when r.role = 'superadmin' then true
    when r.role = 'student' and p.key <> 'admin.access' then true
    when r.role = 'supervisor' and p.key like '%.view' then true
    when r.role = 'supervisor' and p.key in ('meeting_notes.edit') then true
    else false
  end
from public.app_permissions p
cross join (values ('superadmin'), ('student'), ('supervisor')) as r(role)
on conflict (role, permission_key) do nothing;

-- Profiles: allow superadmins to see is_superadmin on others; users update own non-admin fields
drop policy if exists "profiles_select_self_or_coworker" on public.profiles;
create policy "profiles_select_self_or_coworker"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_superadmin()
    or exists (
      select 1
      from public.project_members me
      join public.project_members them on them.project_id = me.project_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.id
    )
  );

-- Block non-superadmins from toggling is_superadmin on any profile (including self)
create or replace function public.profiles_guard_superadmin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_superadmin is distinct from old.is_superadmin then
    -- Allow promoting the first superadmin (bootstrap / claim owner)
    if new.is_superadmin = true
       and not exists (
         select 1 from public.profiles p
         where p.is_superadmin = true and p.id is distinct from new.id
       ) then
      return new;
    end if;
    if auth.uid() is null or not public.is_superadmin() then
      raise exception 'Only a superadmin can change is_superadmin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_superadmin on public.profiles;
create trigger trg_profiles_guard_superadmin
  before update on public.profiles
  for each row execute function public.profiles_guard_superadmin_flag();

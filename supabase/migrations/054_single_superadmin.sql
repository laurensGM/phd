-- Ensure exactly one superadmin, and harden admin-only access.

-- Keep only the earliest default-project owner as superadmin; demote any others
with ranked as (
  select
    p.id,
    row_number() over (
      order by pm.created_at asc nulls last, p.created_at asc
    ) as rn
  from public.profiles p
  left join public.project_members pm
    on pm.user_id = p.id
   and pm.project_id = 'a0000000-0000-4000-8000-000000000001'
   and pm.role = 'owner'
  where p.is_superadmin = true
     or pm.user_id is not null
)
update public.profiles p
set is_superadmin = (ranked.rn = 1 and exists (
      select 1 from public.project_members pm2
      where pm2.user_id = p.id
        and pm2.project_id = 'a0000000-0000-4000-8000-000000000001'
        and pm2.role = 'owner'
    )),
    updated_at = now()
from ranked
where p.id = ranked.id;

-- If somehow multiple superadmins remain, keep the oldest profile only
update public.profiles
set is_superadmin = false,
    updated_at = now()
where is_superadmin = true
  and id not in (
    select id
    from public.profiles
    where is_superadmin = true
    order by created_at asc
    limit 1
  );

-- Enforce at most one superadmin at the database level
drop index if exists public.profiles_single_superadmin_idx;
create unique index profiles_single_superadmin_idx
  on public.profiles ((true))
  where is_superadmin = true;

-- Tighten claim bootstrap: only first owner, and only if no superadmin exists
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

-- Guard: never allow a second superadmin to be created
create or replace function public.profiles_guard_superadmin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_superadmin is not distinct from old.is_superadmin then
    return new;
  end if;

  -- Promoting to superadmin
  if new.is_superadmin = true then
    if exists (
      select 1 from public.profiles p
      where p.is_superadmin = true and p.id is distinct from new.id
    ) then
      raise exception 'Only one superadmin is allowed';
    end if;
    -- First-ever superadmin (bootstrap), or the current superadmin re-asserting
    if public.is_superadmin()
       or not exists (select 1 from public.profiles where is_superadmin = true) then
      return new;
    end if;
    raise exception 'Only the superadmin can assign the superadmin role';
  end if;

  -- Demoting
  if auth.uid() is null or not public.is_superadmin() then
    raise exception 'Only a superadmin can change is_superadmin';
  end if;
  return new;
end;
$$;

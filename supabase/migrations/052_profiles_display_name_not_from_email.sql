-- Stop auto-filling display_name from the email local part (e.g. goormachtigh.laurens).
-- Prefer an empty name until the user sets "First Last" on the profile page.

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
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

-- Clear display names that were only the email local-part autofill
update public.profiles p
set display_name = null,
    updated_at = now()
from auth.users u
where p.id = u.id
  and p.display_name is not null
  and lower(p.display_name) = lower(split_part(u.email, '@', 1));

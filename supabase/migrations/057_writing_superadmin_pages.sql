-- Superadmin-only writing tools: Humanize + LR process

insert into public.app_permissions (key, label, description, category, sort_order) values
  ('writing.humanize', 'View Humanize', 'Access the Humanize writing tips page', 'Writing', 170),
  ('writing.lr_process', 'View LR process', 'Access the LR process workflow page', 'Writing', 180)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      category = excluded.category,
      sort_order = excluded.sort_order;

insert into public.role_permissions (role, permission_key, allowed)
values
  ('superadmin', 'writing.humanize', true),
  ('superadmin', 'writing.lr_process', true),
  ('student', 'writing.humanize', false),
  ('student', 'writing.lr_process', false),
  ('supervisor', 'writing.humanize', false),
  ('supervisor', 'writing.lr_process', false)
on conflict (role, permission_key) do update
  set allowed = excluded.allowed,
      updated_at = now();

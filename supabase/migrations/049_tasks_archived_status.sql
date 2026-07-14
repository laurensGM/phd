-- Allow archived status (hidden from the board by default)
alter table public.tasks drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('backlog', 'todo', 'in_progress', 'done', 'archived'));

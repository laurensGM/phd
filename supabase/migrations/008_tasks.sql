-- Kanban tasks: title, description, status (todo | in_progress | done)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Allow all for tasks"
  on public.tasks for all
  using (true)
  with check (true);

-- Shared document links (e.g. Google Docs) for student ↔ supervisor collaboration

create table if not exists public.shared_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  url text not null,
  notes text null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_documents_project_id_idx
  on public.shared_documents (project_id);

create index if not exists shared_documents_created_at_idx
  on public.shared_documents (created_at desc);

drop trigger if exists trg_set_project_id on public.shared_documents;
create trigger trg_set_project_id
  before insert on public.shared_documents
  for each row execute function public.set_row_project_id();

alter table public.shared_documents enable row level security;

drop policy if exists "shared_documents_select_member" on public.shared_documents;
create policy "shared_documents_select_member"
  on public.shared_documents for select
  to authenticated
  using (public.is_project_member(project_id));

-- Owners/students manage the list; supervisors read only (UI + this RLS)
drop policy if exists "shared_documents_insert_manager" on public.shared_documents;
create policy "shared_documents_insert_manager"
  on public.shared_documents for insert
  to authenticated
  with check (public.can_manage_project(project_id));

drop policy if exists "shared_documents_update_manager" on public.shared_documents;
create policy "shared_documents_update_manager"
  on public.shared_documents for update
  to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

drop policy if exists "shared_documents_delete_manager" on public.shared_documents;
create policy "shared_documents_delete_manager"
  on public.shared_documents for delete
  to authenticated
  using (public.can_manage_project(project_id));

grant select, insert, update, delete on public.shared_documents to authenticated;

-- Permission catalog entries
insert into public.app_permissions (key, label, description, category, sort_order) values
  ('documents.view', 'View documents', 'See shared Google Doc / artefact links', 'Manager', 150),
  ('documents.edit', 'Edit documents', 'Add, edit, or remove shared document links', 'Manager', 160)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      category = excluded.category,
      sort_order = excluded.sort_order;

insert into public.role_permissions (role, permission_key, allowed)
values
  ('superadmin', 'documents.view', true),
  ('superadmin', 'documents.edit', true),
  ('student', 'documents.view', true),
  ('student', 'documents.edit', true),
  ('supervisor', 'documents.view', true),
  ('supervisor', 'documents.edit', false)
on conflict (role, permission_key) do nothing;

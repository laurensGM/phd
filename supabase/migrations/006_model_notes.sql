-- User notes per model (model_id = slug from models.json, e.g. tam, ecm-is)
create table if not exists public.model_notes (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_model_notes_model_id on public.model_notes (model_id);

alter table public.model_notes enable row level security;

create policy "Allow all for model_notes"
  on public.model_notes for all
  using (true)
  with check (true);

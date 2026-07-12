-- Per-model evaluation: reasons the model is relevant (advantages) vs inadequate for the study.
create table if not exists public.model_evaluation_items (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  side text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_evaluation_items_side_check check (
    side in ('advantage', 'inadequacy')
  )
);

create index if not exists idx_model_evaluation_items_model_id
  on public.model_evaluation_items (model_id);

create index if not exists idx_model_evaluation_items_model_side
  on public.model_evaluation_items (model_id, side);

alter table public.model_evaluation_items enable row level security;

create policy "Allow all for model_evaluation_items"
  on public.model_evaluation_items for all
  using (true)
  with check (true);

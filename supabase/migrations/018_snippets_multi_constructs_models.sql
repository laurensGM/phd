-- Allow snippets to link to multiple constructs and models
alter table public.snippets
  add column if not exists construct_ids text[] not null default '{}',
  add column if not exists model_ids text[] not null default '{}';

-- Backfill from single-value columns if present
update public.snippets
set construct_ids = case
  when construct_ids = '{}'::text[] and construct_id is not null then array[construct_id]
  else construct_ids
end,
    model_ids = case
  when model_ids = '{}'::text[] and model_id is not null then array[model_id]
  else model_ids
end;

create index if not exists snippets_construct_ids_gin_idx on public.snippets using gin (construct_ids);
create index if not exists snippets_model_ids_gin_idx on public.snippets using gin (model_ids);


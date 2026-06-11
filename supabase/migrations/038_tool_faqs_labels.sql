-- FAQ labels (e.g. method, theory, contribution)
alter table public.tool_faqs
  add column if not exists labels text[] not null default '{}';

create index if not exists tool_faqs_labels_idx
  on public.tool_faqs using gin (labels);

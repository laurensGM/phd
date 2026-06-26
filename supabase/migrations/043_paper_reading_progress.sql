-- Per-paper section reading progress (reading table checkboxes)
alter table public.saved_papers
  add column if not exists read_abstract boolean not null default false,
  add column if not exists read_introduction boolean not null default false,
  add column if not exists read_methodology boolean not null default false,
  add column if not exists read_results_discussion boolean not null default false,
  add column if not exists read_conclusion boolean not null default false,
  add column if not exists read_limitations_recommendations boolean not null default false;

comment on column public.saved_papers.read_abstract is 'User marked abstract section as read.';
comment on column public.saved_papers.read_introduction is 'User marked introduction section as read.';
comment on column public.saved_papers.read_methodology is 'User marked methodology section as read.';
comment on column public.saved_papers.read_results_discussion is 'User marked results and discussion section as read.';
comment on column public.saved_papers.read_conclusion is 'User marked conclusion section as read.';
comment on column public.saved_papers.read_limitations_recommendations is 'User marked limitations and recommendations section as read.';

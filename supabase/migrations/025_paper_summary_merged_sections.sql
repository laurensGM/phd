-- Merge section structure for consistency
alter table public.paper_summary
  add column if not exists results_and_discussion text,
  add column if not exists limitations_and_future_research text;

comment on column public.paper_summary.results_and_discussion is 'Manual summary: Results and Discussion';
comment on column public.paper_summary.limitations_and_future_research is 'Manual summary: Limitations and Future Research';


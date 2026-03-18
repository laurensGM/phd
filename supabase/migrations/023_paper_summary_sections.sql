-- Add section-based manual summary fields (consistent structure)
alter table public.paper_summary
  add column if not exists abstract text,
  add column if not exists introduction text,
  add column if not exists methods text,
  add column if not exists results_section text,
  add column if not exists discussion_section text,
  add column if not exists conclusion_section text,
  add column if not exists limitations_section text,
  add column if not exists future_research_section text;

comment on column public.paper_summary.abstract is 'Manual summary: Abstract (3–5 sentences)';
comment on column public.paper_summary.introduction is 'Manual summary: Introduction (3–5 sentences)';
comment on column public.paper_summary.methods is 'Manual summary: Methods (3–5 sentences)';
comment on column public.paper_summary.results_section is 'Manual summary: Results (3–5 sentences)';
comment on column public.paper_summary.discussion_section is 'Manual summary: Discussion (3–5 sentences)';
comment on column public.paper_summary.conclusion_section is 'Manual summary: Conclusion (3–5 sentences)';
comment on column public.paper_summary.limitations_section is 'Manual summary: Limitations (3–5 sentences)';
comment on column public.paper_summary.future_research_section is 'Manual summary: Future research (3–5 sentences)';


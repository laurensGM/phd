-- Add additional always-present structured sections
alter table public.paper_summary
  add column if not exists key_claims text,
  add column if not exists academic_constructs text;

comment on column public.paper_summary.key_claims is 'Manual summary: Key Claims (3–5 sentences or bullets)';
comment on column public.paper_summary.academic_constructs is 'Manual summary: Academic Constructs (key constructs mentioned, optional bullets)';


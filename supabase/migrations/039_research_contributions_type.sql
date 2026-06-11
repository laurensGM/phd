-- Contribution type: theoretical, methodological, or practical
alter table public.research_contributions
  add column if not exists contribution_type text
  check (contribution_type is null or contribution_type in ('theoretical', 'methodological', 'practical'));

create index if not exists research_contributions_type_idx
  on public.research_contributions (contribution_type);

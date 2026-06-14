-- Link snippets to research contribution statements
alter table public.snippets
  add column if not exists contribution_id uuid null references public.research_contributions (id) on delete set null;

create index if not exists snippets_contribution_id_idx on public.snippets (contribution_id);

comment on column public.snippets.contribution_id is 'Optional link to a thesis contribution this snippet supports.';

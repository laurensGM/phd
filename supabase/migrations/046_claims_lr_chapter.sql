-- Replace confidence_level with lr_chapter (where in the literature review to situate the claim).

alter table public.claims drop constraint if exists claims_confidence_check;

alter table public.claims add column if not exists lr_chapter text null;

alter table public.claims drop column if exists confidence_level;

alter table public.claims drop constraint if exists claims_lr_chapter_check;
alter table public.claims add constraint claims_lr_chapter_check check (
  lr_chapter is null
  or lr_chapter in (
    'introduction',
    'ci-to-use-is',
    'theoretical-foundations',
    'antecedents-of-ci',
    'other-secondary-antecedents',
    'research-gap',
    'proposed-model',
    'ssa-context'
  )
);

create index if not exists claims_lr_chapter_idx on public.claims (lr_chapter);

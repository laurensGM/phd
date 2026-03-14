-- Add optional snippet type: definition, theory, empirical finding, method, limitation, future research
alter table public.snippets
  add column if not exists snippet_type text null;

alter table public.snippets
  drop constraint if exists snippets_snippet_type_check;

alter table public.snippets
  add constraint snippets_snippet_type_check check (
    snippet_type is null
    or snippet_type in (
      'definition',
      'theory',
      'empirical finding',
      'method',
      'limitation',
      'future research'
    )
  );

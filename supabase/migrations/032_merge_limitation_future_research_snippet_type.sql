alter table public.snippets
  drop constraint if exists snippets_snippet_type_check;

-- Merge snippet types "limitation" and "future research" into one category.
update public.snippets
set snippet_type = 'limitations and future research'
where snippet_type in ('limitation', 'future research');

alter table public.snippets
  add constraint snippets_snippet_type_check check (
    snippet_type is null
    or snippet_type in (
      'definition',
      'theory',
      'empirical finding',
      'method',
      'limitations and future research'
    )
  );

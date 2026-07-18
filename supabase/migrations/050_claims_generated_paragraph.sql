-- Store the literature-review paragraph pasted after using the claim AI prompt
alter table public.claims
  add column if not exists generated_paragraph text null;

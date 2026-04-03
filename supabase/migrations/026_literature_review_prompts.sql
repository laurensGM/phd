-- Saved literature-review prompt generations: claim, linked snippets, optional AI paragraph
create table if not exists public.literature_review_prompts (
  id uuid primary key default gen_random_uuid(),
  claim text not null,
  snippet_ids uuid[] not null default '{}',
  prompt_text text not null,
  generated_paragraph text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists literature_review_prompts_created_at_idx
  on public.literature_review_prompts (created_at desc);

alter table public.literature_review_prompts enable row level security;

create policy "Allow all for literature_review_prompts"
  on public.literature_review_prompts for all
  using (true)
  with check (true);

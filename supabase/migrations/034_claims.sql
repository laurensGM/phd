-- Claims: literature-backed statements linked to snippets (evidence graph).

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  claim_text text not null,
  constructs_involved text[] not null default '{}',
  relationship_type text null,
  confidence_level text not null default 'medium',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claims_confidence_check check (
    confidence_level in ('low', 'medium', 'high')
  ),
  constraint claims_relationship_type_check check (
    relationship_type is null
    or relationship_type in (
      'predicts',
      'mediates',
      'moderates',
      'influences',
      'relates',
      'associated',
      'other'
    )
  )
);

create index if not exists claims_created_at_idx on public.claims (created_at desc);
create index if not exists claims_constructs_gin_idx on public.claims using gin (constructs_involved);

create table if not exists public.claim_snippets (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  snippet_id uuid not null references public.snippets (id) on delete cascade,
  role text not null default 'supporting',
  created_at timestamptz not null default now(),
  constraint claim_snippets_role_check check (
    role in ('supporting', 'contradicting', 'definition')
  ),
  constraint claim_snippets_unique_snippet unique (claim_id, snippet_id)
);

create index if not exists claim_snippets_claim_id_idx on public.claim_snippets (claim_id);
create index if not exists claim_snippets_snippet_id_idx on public.claim_snippets (snippet_id);

create table if not exists public.claim_versions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  version_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists claim_versions_claim_id_idx on public.claim_versions (claim_id, created_at desc);

alter table public.claims enable row level security;
alter table public.claim_snippets enable row level security;
alter table public.claim_versions enable row level security;

create policy "Allow all for claims"
  on public.claims for all
  using (true)
  with check (true);

create policy "Allow all for claim_snippets"
  on public.claim_snippets for all
  using (true)
  with check (true);

create policy "Allow all for claim_versions"
  on public.claim_versions for all
  using (true)
  with check (true);

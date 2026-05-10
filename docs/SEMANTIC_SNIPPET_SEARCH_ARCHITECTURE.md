# Semantic Snippet Search Architecture (Option A: Local/Free)

## Goal

Enable meaning-based snippet retrieval so queries like:

- `drivers of continuance intention`

return relevant snippets even when wording differs.

## Why This Change

Current snippet search is lexical/filter-based. It is strong for explicit tags and exact phrase matching, but weaker for semantic paraphrases.

Semantic search adds a vector retrieval layer so the app behaves as a personal literature retrieval engine, not only a note database.

## Scope

- Snippet-level semantic retrieval
- Local embedding generation (no paid embedding API required)
- Existing snippet filters remain (construct/model/type/tag/journal/paper)
- Backward-compatible with keyword search

## High-Level Design

### 1) Data Layer (Supabase/Postgres)

- Use `pgvector` in Postgres.
- Add `embedding vector(768)` to `public.snippets`.
- Add ANN index on `embedding` (`ivfflat`, cosine ops).
- Add SQL RPC function:
  - `public.match_snippets_semantic(query_embedding vector(768), match_count int default 50)`
  - returns top snippet IDs ordered by cosine similarity.

### 2) Local Embedding Layer

- Use local Ollama embeddings endpoint:
  - default URL: `http://localhost:11434/api/embeddings`
  - default model: `nomic-embed-text`
- Configurable via env:
  - `PUBLIC_OLLAMA_BASE_URL`
  - `PUBLIC_LOCAL_EMBED_MODEL`

### 3) Retrieval Flow

1. User enters semantic query in Snippets page.
2. Frontend requests local embedding for query text.
3. Frontend calls Supabase RPC `match_snippets_semantic`.
4. Returned snippet IDs are intersected with active UI filters.
5. Results are shown in ranked semantic order.

### 4) Embedding Lifecycle

- On snippet create and update, frontend attempts non-blocking local embedding sync:
  - generate vector locally
  - update snippet row `embedding`
- If local embedding service is unavailable, snippet save/edit still succeeds; that row simply has no vector until a later edit on localhost (or manual DB update).

## Implemented Components

- Migration: `supabase/migrations/033_snippets_semantic_search.sql`
- Local embedding helper: `src/lib/localEmbeddings.ts`
- Snippet UI integration:
  - Search mode toggle (`Keyword` / `Semantic`)
  - Semantic retrieval path + ranking
  - Graceful semantic error message in filters panel
  - Automatic non-blocking embedding sync on add/edit

## Operational Requirements

1. Apply DB migrations (including `033`).
2. Ensure local Ollama is running.
3. Pull embedding model (example):
   - `ollama pull nomic-embed-text`
4. Optional env vars (if not using defaults):
   - `PUBLIC_OLLAMA_BASE_URL`
   - `PUBLIC_LOCAL_EMBED_MODEL`

## Limitations / Current Trade-offs

- Query embedding is generated in browser context (local call to Ollama), so semantic mode depends on local service availability.
- Snippets created or edited only without a working local embedder may lack vectors and won’t appear in semantic results until edited again with Ollama available.
- Current ranking is pure vector similarity; hybrid reranking (keyword + vector) is not yet implemented.

## Suggested Next Steps

1. Add “Hybrid” mode (vector + keyword signal).
2. Add optional similarity score display for debugging.
3. Add telemetry/logging for semantic retrieval failures and latency.

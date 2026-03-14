# PhD Manager — Software Architecture & System Design

This document describes the architectural decisions, data model, and system design of the PhD Manager application so that the logic and structure can be retrieved and extended later.

---

## 1. Overview

**PhD Manager** is a static-first web application for organizing doctoral research: literature (papers, snippets), theory (models, constructs), milestones, diary, and tools. It is built for a single user (or trusted users), with no authentication in the app layer.

**Goals:**

- Curate and link literature (papers, snippets) to theory (constructs, models).
- Track PhD milestones and progress.
- Support citation (APA 7) and metadata (journal, authors, year) for papers.
- Deploy as a static site (e.g. GitHub Pages) while persisting user data in a backend.

---

## 2. Technology Stack

| Layer        | Choice              | Rationale |
|-------------|---------------------|-----------|
| **Framework** | Astro 4             | Static-first, minimal JS by default, good for content-heavy sites and optional React islands. |
| **Output**    | Static (`output: 'static'`) | Pre-rendered HTML; no Node server at runtime. Suited for GitHub Pages. |
| **UI**        | Astro + React 18    | Astro for layout and static pages; React for interactive UIs (forms, boards, filters). |
| **Backend**   | Supabase (PostgreSQL) | Managed Postgres + real-time optional; simple REST/JS client; RLS for future auth. |
| **Language**  | TypeScript          | Typed APIs and shared types for Supabase and components. |
| **Content**   | JSON files + MDX    | Curated data (constructs, models, outline) in repo; MDX for long-form where needed. |

**Notable dependencies:**

- `@supabase/supabase-js` — data persistence.
- `@astrojs/react` — React islands in Astro.
- `reactflow` — theory map diagram (optional).
- `@astrojs/mdx` — MDX for content pages.

**Deployment:** Configured for a project site on GitHub Pages (`base: '/phd/'`, `trailingSlash: 'always'`). Build produces static assets in `dist/`.

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Static site (HTML/CSS/JS)                  │
│  Astro pages + React islands (client:load / client:visible)       │
└─────────────────────────────────────────────────────────────────┘
     │                                    │
     │ read at build time                 │ read/write at runtime
     ▼                                    ▼
┌──────────────────┐              ┌──────────────────────────────┐
│  src/data/*.json │              │  Supabase (PostgreSQL)         │
│  constructs      │              │  saved_papers, snippets,       │
│  models          │              │  diary_entries, notes, tasks,  │
│  outline         │              │  meeting_notes, golden_nuggets  │
│  fields, etc.    │              └───────────────────────────────┘
└──────────────────┘
     │
     │ referenced by id in DB (e.g. snippet.construct_ids)
     └─────────────────────────────────────────────────────────────┘
```

- **Left:** Curated, version-controlled data. No runtime backend; used at build time for static routes and at runtime in the client as imported JSON.
- **Right:** User-generated and app-managed data. Fetched and mutated in the browser via the Supabase client.

---

## 4. Data Strategy: Static vs Persisted

### 4.1 Static / curated (JSON in repo)

Stored under `src/data/`. Used for:

- **Constructs** (`constructs.json`) — definitions, abbreviations, source, measurement items. Referenced by **id** (slug, e.g. `perceived-usefulness`) from snippets, diary, and construct_notes.
- **Models** (`models.json`) — theory models (TAM, ECM, etc.), descriptions, construct lists. Referenced by **id** (e.g. `tam`, `ecm`) from snippets and model_notes.
- **Fields** (`fields.json`) — research fields (e.g. ICT4D, HCI).
- **Outline** (`outline.json`) — PhD milestones and dates (e.g. preliminary literature review, proposal defence). Used for homepage timeline and milestones page.
- **Research questions, academics, literature, tools, supervisor, etc.** — similar static content.

**Design choice:** These are stable, curated entities. Keeping them in JSON gives:

- Version control and diff-friendly updates.
- No backend required for theory structure.
- Build-time generation of one HTML page per construct/model/field via `getStaticPaths()`.

**Linking:** Snippets and diary store **arrays of IDs** (e.g. `construct_ids`, `model_ids`) that reference these JSON entities. The app resolves IDs to names at runtime by loading the same JSON files in the client.

### 4.2 Persisted (Supabase)

All user-generated or mutable content lives in Supabase:

| Table            | Purpose |
|------------------|--------|
| **saved_papers** | Papers to read: url, secondary_url, title, authors, year, **journal**, citations, status, golden, motivation, tags. |
| **snippets**     | Extracts from papers: content, paper_id (FK), construct_ids[], model_ids[], tags[], page_number, notes. |
| **diary_entries**| Daily reflections: date, summary, detailed_reflection, tags, linked_constructs[]. |
| **construct_notes** | Free-form notes per construct (construct_id → content). |
| **model_notes**  | Free-form notes per model (model_id → content). |
| **tasks**        | Task list: title, description, status, sort_order. |
| **meeting_notes**| Meetings: date, title, content, participants, location. |
| **golden_nuggets** | Quotations or insights: type, content, author. |

**Design choice:** Supabase was chosen for a simple, hosted Postgres with a typed JS client and optional RLS. The app uses **client-side only** access (no Astro server); every Supabase call runs in the browser after the static page has loaded.

---

## 5. Entity Relationship (Conceptual)

- **Papers** have many **snippets** (one-way: `snippets.paper_id` → `saved_papers.id`). Paper has a single **journal** field (e.g. “MIS Quarterly”); journal is not a separate table.
- **Snippets** reference:
  - One **paper** (required).
  - Zero or more **constructs** and **models** by ID (arrays). Constructs and models are defined in JSON; the app resolves IDs to labels and links (e.g. `/constructs/perceived-usefulness/`).
- **Diary** and **notes** reference constructs/models by the same IDs.
- **Outline** (milestones) is standalone JSON; no FK to Supabase.

So: **Papers → Snippets**; **Snippets ↔ Constructs/Models** (many-to-many via ID arrays); **Journal** is an attribute of **Paper**, shown on paper detail and on snippet cards (derived from the paper).

---

## 6. Routing & Pages

- **Astro file-based routing** under `src/pages/`.
- **Static routes:** `index.astro` (home), `papers/index.astro`, `snippets/index.astro`, `constructs/index.astro`, `models/index.astro`, `outline/index.astro`, `diary/index.astro`, etc.
- **Dynamic routes:** `constructs/[id].astro`, `models/[id].astro`, `fields/[id].astro`. `getStaticPaths()` returns one entry per JSON entity so each gets a pre-built page.
- **Paper detail:** Single route `papers/detail.astro`; paper is selected by **query parameter** `?id=<uuid>`. The React component `PaperDetailPage` reads `id` from the URL and fetches that paper (and its snippets) from Supabase. This avoids a huge number of static paths and keeps the build simple.

**Base path:** All links use `import.meta.env.BASE_URL` (e.g. `/phd/`) so the app works under a project subpath.

---

## 7. Frontend Architecture

### 7.1 Astro vs React

- **Astro** handles:
  - Layout (`BaseLayout.astro`): nav, footer, global CSS variables, fonts.
  - Static structure and SEO-friendly HTML.
  - Page-specific styles scoped or `:global()` as needed.
- **React** is used only where needed:
  - Forms (add/edit paper, add/edit snippet, filters).
  - Interactive lists (papers table/board, snippets list, diary).
  - Client-side data fetching (Supabase) and local state.

**Hydration:** Components that need to run in the browser use `client:load` or `client:visible` in the Astro page (e.g. `<PapersPage client:load />`, `<HomeDashboard client:load />`). This keeps initial HTML small and limits JS to interactive islands.

### 7.2 State

- **No global store.** Each React tree manages its own state (`useState`, `useMemo`, `useCallback`).
- **Persistence** is either Supabase (papers, snippets, diary, notes, tasks, etc.) or `localStorage` (e.g. PhD outline completion). No Redux or React Context for data.

### 7.3 Data flow (persisted data)

1. Page loads (static HTML).
2. React component mounts and, in `useEffect`, calls Supabase (e.g. `from('saved_papers').select(...)`).
3. Results are stored in component state and rendered.
4. User actions (save, update, delete) trigger Supabase `insert`/`update`/`delete` and then refresh local state or refetch.

Types for Supabase are centralised in `src/lib/database.types.ts` (Row, Insert, Update per table) and aligned with migrations.

---

## 8. Key Features and Where They Live

| Feature | Location | Data source |
|--------|----------|-------------|
| Home dashboard (stats, pie chart, milestones, timeline) | `HomeDashboard.tsx` + `index.astro` | Supabase (papers, snippets counts; papers by status); JSON (constructs/models counts, outline). |
| Papers list (table/board), add/edit paper, fetch from URL | `PapersPage.tsx` + `papers/index.astro` | Supabase `saved_papers`. CrossRef/arXiv for metadata. |
| Paper detail, APA 7 citation, snippets per paper | `PaperDetailPage.tsx` + `papers/detail.astro` | Supabase (paper by id, snippets by paper_id). |
| Snippets list, filters, add/edit snippet | `SnippetsPage.tsx` + `snippets/index.astro` | Supabase `snippets` + `saved_papers` (for title, journal). Constructs/models from JSON. |
| Constructs/models/fields lists and detail pages | Astro pages + optional React (e.g. notes) | JSON + Supabase for notes. |
| PhD milestones (outline) | `outline/index.astro` | JSON `outline.json`; completion in localStorage. |
| Diary, tasks, meeting notes, golden nuggets | Respective React components + Astro | Supabase. |

---

## 9. External Integrations

- **CrossRef API** (`api.crossref.org`): Given a DOI URL, fetch title, authors, year, **journal** (from `container-title`) to auto-fill the “Save a paper” form.
- **arXiv API** (`export.arxiv.org`): Given an arXiv URL, fetch title, authors, year (no journal). Used by the same “Fetch from link” flow in `PapersPage.tsx`.

Both are called from the browser; no server-side proxy. CORS permits these public APIs.

---

## 10. Security & Environment

- **Auth:** No login in the app. Supabase RLS is configured with permissive policies (`using (true)`, `with check (true)`), implying a single-user or trusted-environment use case. For multi-user or public deployment, RLS and auth should be tightened.
- **Secrets:** Supabase URL and anon key are read from `import.meta.env` (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`). They are public by design (anon key); sensitive operations would require a backend or Supabase Auth + RLS.
- **Build:** Static output; no server-side secrets at runtime. Env vars are baked at build time for the client.

---

## 11. Migrations and Schema Evolution

Supabase schema is versioned under `supabase/migrations/` as sequential SQL files (e.g. `001_create_diary_entries.sql` … `019_saved_papers_journal.sql`). Applying these in order recreates the full schema. TypeScript types in `src/lib/database.types.ts` are updated manually to match (no generated types in this repo). When adding a field (e.g. **journal** on papers):

1. Add a new migration (e.g. `ALTER TABLE saved_papers ADD COLUMN journal text null`).
2. Update `database.types.ts` (Row, Insert, Update).
3. Update components that read/write that table and any UI that displays it (e.g. paper forms, paper detail, snippet cards).

---

## 12. Design Decisions Summary

| Decision | Rationale |
|----------|-----------|
| Static output + client Supabase | Simple hosting (e.g. GitHub Pages), no server to run; data stays in Supabase. |
| JSON for constructs/models/outline | Stable, versioned, no DB needed for theory structure; easy to link from snippets/diary by ID. |
| Paper detail by query param | Avoids generating one static page per paper; works well with client-fetched data. |
| React only where needed | Keeps bundle size down and preserves Astro’s “zero JS by default” benefit. |
| Journal on paper only | Journals are an attribute of the paper; snippet cards show the source paper’s journal for context. |
| Snippet ↔ construct/model by ID arrays | Many-to-many without a join table; IDs match JSON slugs so one source of truth for names and detail URLs. |

---

## 13. File and Folder Conventions

- **`src/pages/`** — Astro routes. One entry point per URL; often wraps a single React component.
- **`src/components/`** — React components (and any shared Astro components). Naming: feature + “Page” or “View” (e.g. `PapersPage`, `PaperDetailPage`, `SnippetsPage`, `HomeDashboard`).
- **`src/layouts/`** — Base layout (header, nav, footer, global styles).
- **`src/lib/`** — Supabase client and database types.
- **`src/data/`** — Static JSON. No code that mutates these at runtime.
- **`supabase/migrations/`** — Ordered SQL migrations.
- **`docs/`** — This architecture document and any other design notes.

This structure keeps routing, data access, and static content clearly separated and should make it straightforward to retrieve the logic of the architecture and extend the system (e.g. new entity types, new pages, or stricter auth/RLS) later.

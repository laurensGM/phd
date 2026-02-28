# PhD Knowledge System

A static website for organizing PhD research: theoretical models, constructs, diary entries, literature, research questions, methods, and a visual theory map.

## Tech Stack

- **Astro** (static export) — fast, content-focused
- **React** — interactive components (model graphs, diary)
- **MDX** — Markdown with components (when needed)
- **JSON** — model definitions, constructs, literature

## Pages

| Page | Description |
|------|-------------|
| **Home** | Research topic, positioning, quick links |
| **Models** | TAM, ECT, ECM with interactive React Flow diagrams; clickable construct nodes |
| **Constructs** | Definitions, measurement scales, sources, related models |
| **Diary** | Entry form, date, tags, search, filter; persistent storage via Supabase + auth |
| **Literature** | Citation, DOI, constructs, method, findings, summary, replication notes |
| **Research Questions** | RQ versions, why changed, supervisory feedback |
| **Methods** | Operationalization, hypotheses, survey instrument, model versions |
| **Theory Map** | Visual map of model overlaps and shared constructs |

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:4321

## Build

```bash
npm run build
```

Output in `dist/`.

## Deploy to GitHub Pages

1. Create a repo and push the code.
2. In repo **Settings → Pages**: set source to **GitHub Actions**.
3. Update `astro.config.mjs`:
   - `site`: your GitHub Pages URL (e.g. `https://username.github.io` or `https://username.github.io/repo-name`)
   - `base`: `/` for user/org site, or `/repo-name/` for project site
4. Push to `main` to trigger the deploy workflow.

## Data Files

Edit JSON in `src/data/`:

- `models.json` — models with constructs and relationships
- `constructs.json` — construct definitions and measurement
- `literature.json` — papers and summaries
- `research-questions.json` — RQ evolution
- `diary-entries.json` — (legacy; diary now uses Supabase)
- `methods.json` — hypotheses, operationalization, instrument

## Diary (Supabase)

The diary uses **Supabase** for persistent storage. No login—just add entries. (Single-user setup: the table is open; keep your site URL private if you want.)

### Setup

1. Create a [Supabase](https://supabase.com) project (free tier works).

2. Run the migration in **SQL Editor**:
   - Open `supabase/migrations/001_create_diary_entries.sql`
   - Copy the contents and run in Supabase Dashboard → SQL Editor

3. Add env vars locally. Create `.env`:
   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
   Get these from **Supabase Dashboard → Settings → API**.

4. For **GitHub Actions** (deploy): add repo **Secrets** `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`, then redeploy.

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
| **Diary** | Entry form, date, tags, search, filter; entries stored in localStorage |
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
- `diary-entries.json` — sample diary (new entries via UI go to localStorage)
- `methods.json` — hypotheses, operationalization, instrument

## Diary

- **Static entries**: in `src/data/diary-entries.json`
- **New entries**: added via the form are stored in `localStorage`
- For a shared database: add Supabase (or similar) and API routes (would require a server or serverless).

# PhD Manager – Save Snippet (browser extension)

Chrome extension to save selected text as a **snippet** in your PhD Manager, creating the **paper** automatically if it is not already in your library.

## Flow

1. **Select text** on an article page (e.g. PDF viewer, journal site, DOI page).
2. **Right‑click** → **Save to PhD Manager**.
3. A tab opens with:
   - **Paper**: detected from the page URL and DOI (or title as fallback).
   - **Snippet**: the selected text (editable).
   - **Construct(s)** and **Model(s)**: multi-select dropdowns (same list as in the app).
   - **Note** (optional).
4. Click **Save snippet**:
   - If the paper **already exists** (matched by URL or canonical DOI URL): the snippet is attached to it.
   - If the paper **does not exist**: it is created first (using CrossRef/arXiv metadata when a DOI or arXiv ID is present), then the snippet is attached.

So the hierarchy is always: **Paper → Snippet**.

## Setup

1. **Load the extension** (unpacked):
   - Open `chrome://extensions/`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `browser-extension` folder.

2. **Configure Supabase**:
   - Click the extension’s **Details** → **Extension options** (or right‑click the extension icon → Options).
   - Enter your **Supabase URL** and **anon key** (Supabase project → Settings → API).
   - Click **Save**.

3. **Use it**:
   - Go to any article page, select some text, right‑click and choose **Save to PhD Manager**.

## Files

- `manifest.json` – Extension manifest (Manifest V3).
- `background.js` – Context menu and script that reads selection + URL from the page.
- `save-snippet.html` / `save-snippet.js` / `save-snippet.css` – “Save snippet” tab UI and logic (find/create paper, create snippet).
- `options.html` / `options.js` – Options page for Supabase URL and anon key.
- `constructs.json` / `models.json` – Minimal lists (id, name) for the dropdowns; sync with `src/data/` when you add constructs or models.

## Syncing constructs and models

If you add or rename constructs or models in the main app (`src/data/constructs.json` and `src/data/models.json`), regenerate the extension’s copies:

```bash
node -e "
const c = require('./src/data/constructs.json');
const m = require('./src/data/models.json');
const fs = require('fs');
fs.writeFileSync('./browser-extension/constructs.json', JSON.stringify(c.map(x => ({ id: x.id, name: x.name }))));
fs.writeFileSync('./browser-extension/models.json', JSON.stringify(m.map(x => ({ id: x.id, name: x.name }))));
"
```

Then reload the extension in `chrome://extensions/`.

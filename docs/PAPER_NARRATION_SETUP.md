# Paper summary narration (audio)

Paper detail pages can **narrate the summary** as MP3 audio — like a mini podcast episode for each paper.

## Flow

1. Open a paper that has a **summary** (manual or AI-generated).
2. In the Summary section, use **Generate narration** (first time) or **Play** (if already generated).
3. The Edge Function builds a spoken script from all summary sections, synthesizes audio with **Google Cloud Text-to-Speech** (female **Indian English** voice), and stores an MP3 in Supabase Storage.
4. Use **Save offline** to store the **paper, summary, and audio** on your device for reading and listening without network.

## Voice and style

- **Voice:** `en-IN-Neural2-D` (female, Indian English)
- **Delivery:** Slightly slower pace and lower pitch (warm podcast-style narration via SSML prosody)

## Offline (PWA)

**Save offline** stores three things on your device:

1. **Paper metadata** and **full summary** (IndexedDB on each device)
2. **Narration MP3** (browser Cache API on each device)
3. **A sync flag** in Supabase so other devices know to download the bundle

### While online

1. Open the paper and generate narration if needed.
2. Tap **Save offline** on the paper detail page.
3. On **another device** (e.g. mobile PWA), open **Papers** while online — saved papers download automatically.

### While offline

1. Open **Papers** in the app.
2. Use the **Saved for offline** list at the top (the main paper list needs network).
3. Tap a paper — you can read the summary and play the cached narration.

You must save each paper **while online** at least once. Each device caches the files locally when it syncs (Papers page load while online). The service worker also caches Supabase Storage URLs under `paper-narrations/` for repeat visits.

Apply `supabase/migrations/042_saved_papers_offline_flag.sql` for cross-device offline sync.

## Setup

### 1. Run the migration

Apply `supabase/migrations/041_paper_narration.sql` (adds `narration_url`, `narration_content_hash`, and the `paper-narrations` storage bucket).

### 2. Enable Google Cloud Text-to-Speech

1. In [Google Cloud Console](https://console.cloud.google.com/), enable **Cloud Text-to-Speech API** for your project.
2. Create an **API key** (APIs & Services → Credentials → Create credentials → API key).
3. Restrict the key to **Cloud Text-to-Speech API** (recommended).

### 3. Deploy the Edge Function

```bash
supabase functions deploy generate-paper-narration
```

### 4. Set the secret

In Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**:

| Name | Value |
|------|--------|
| `GOOGLE_TTS_API_KEY` | Your Google Cloud API key |

(`GEMINI_API_KEY` is only needed for AI summary generation, not narration.)

## Regeneration

If you **edit the summary**, the content hash changes and the app prompts you to **Regenerate narration**. Old MP3 files are overwritten in storage.

## Cost

Google Cloud TTS Neural2 voices have a free tier (see [pricing](https://cloud.google.com/text-to-speech/pricing)). Typical paper summaries are a few thousand characters — fine for personal use.

## Troubleshooting

- **“GOOGLE_TTS_API_KEY not set”** — Add the secret in Supabase.
- **“Google TTS error 403”** — Enable the Text-to-Speech API and check API key restrictions.
- **No player shown** — The paper needs summary text (at least one filled section).
- **Offline play fails** — Generate narration online first, tap **Save offline**, then open the paper from **Saved for offline** when offline.
- **“Paper not saved for offline”** — Open the paper while online and tap **Save offline** before going offline.

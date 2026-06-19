# Paper summary narration (audio)

Paper detail pages can **narrate the summary** as MP3 audio — like a mini podcast episode for each paper.

## Flow

1. Open a paper that has a **summary** (manual or AI-generated).
2. In the Summary section, use **Generate narration** (first time) or **Play** (if already generated).
3. The Edge Function builds a spoken script from all summary sections, synthesizes audio with **Google Cloud Text-to-Speech** (female **Indian English** voice), and stores an MP3 in Supabase Storage.
4. Use **Save offline** on mobile so the MP3 is cached for listening without network.

## Voice and style

- **Voice:** `en-IN-Neural2-D` (female, Indian English)
- **Delivery:** Slightly slower pace and lower pitch (warm podcast-style narration via SSML prosody)

## Offline (PWA)

- Tap **Save offline** after narration is generated — audio is stored in the browser Cache API.
- The service worker also caches Supabase Storage URLs under `paper-narrations/` for repeat visits.
- You must generate and save narrations **while online** at least once per paper.

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
- **Offline play fails** — Generate narration online first, then tap **Save offline**.

# AI paper summary (free)

When you add a new paper, the app can automatically generate a **structured AI summary** and show it on the paper details page.

## Flow

1. **Add paper** (Papers → Add paper with a URL).
2. **Detect source** – The Edge Function fetches the URL (PDF or HTML).
3. **Extract / send** – PDFs are sent to Gemini as-is; HTML is converted to plain text.
4. **Generate** – Google Gemini (free tier) produces a structured summary.
5. **Store** – The summary is saved in `paper_summary` (problem, claims, method, results, discussion, limitations, future research, conclusion).
6. **Display** – The paper detail page shows the “AI summary” section.

## Cost

- **Free**: Uses the [Google AI Studio](https://aistudio.google.com/apikey) (Gemini) free tier. Get an API key there at no cost.

## Setup

### 1. Run the migration

Apply the new table (if not already applied):

```bash
supabase db push
# or apply supabase/migrations/022_paper_summary.sql in the Supabase SQL editor
```

### 2. Deploy the Edge Function

Edge Functions are deployed with the **Supabase CLI**, not from the Dashboard.

#### 2a. Install the Supabase CLI (if needed)

- **macOS (Homebrew):** `brew install supabase/tap/supabase`
- **npm:** `npm install -g supabase`
- Or see [Install the Supabase CLI](https://supabase.com/docs/guides/cli/getting-started#install-the-supabase-cli).

#### 2b. Log in and link your project

From your project folder (where the `supabase/` folder lives):

```bash
cd "/Users/lgoormachtigha/Documents/Stellenbosch university/PhD webapp"
supabase login
```

This opens the browser to log in. Then link the repo to your Supabase project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

You find **Project ref** in the Dashboard: **Project Settings** → **General** → “Reference ID” (e.g. `abcdefghijklmnop`).

If you haven’t initialised Supabase in this folder yet, run first:

```bash
supabase init
```

(You can keep the existing `supabase/functions` and `supabase/migrations`; `init` just ensures a `config.toml` exists.)

#### 2c. Deploy the function

```bash
supabase functions deploy generate-paper-summary
```

When it finishes, the function is live at  
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-paper-summary`.  
Your app already calls this URL via `supabase.functions.invoke('generate-paper-summary', ...)`.

### 3. Set the Gemini API key

In Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions** → **Secrets**.
2. Add a secret: name `GEMINI_API_KEY`, value = your API key from [Google AI Studio](https://aistudio.google.com/apikey).

### 4. (Optional) Service role for Edge Function

The function uses `SUPABASE_ANON_KEY` by default (injected by Supabase). If you prefer to use the service role key (e.g. to bypass RLS), add `SUPABASE_SERVICE_ROLE_KEY` as a secret. The function will use it when present.

## Behaviour

- **New papers**: After you save a new paper with a URL, the app calls the Edge Function in the background. The summary appears on the paper detail page once it’s ready (refresh or open the paper).
- **Existing papers**: On the paper detail page, if there’s no summary yet, use **“Generate summary”** to run the function and then see the result (the page polls until the summary exists).
- **Structured format**: Each summary has: Definition/Research problem, Key claims, Method, Results, Discussion, Limitations, Future research, Conclusion (each 3–5 sentences). This format supports later targeted search and filtering.

## Troubleshooting

- **“GEMINI_API_KEY not set”**: Add the secret in Supabase as above.
- **“Failed to fetch URL”**: The URL must be publicly reachable from Supabase (no auth, no strict CORS that blocks the function).
- **“Could not extract enough text”**: Some pages are not suitable (e.g. paywalled or non-HTML/PDF). Try a direct PDF link or an open-access version.

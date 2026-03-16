// Supabase Edge Function: fetch paper from URL, extract text or send PDF to Gemini, store structured summary.
// Requires GEMINI_API_KEY in Supabase secrets (free at https://aistudio.google.com/apikey).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const STRUCTURED_PROMPT = `Summarize this academic paper concisely.

Return the summary using the following structure. Output valid JSON only, with these exact keys (each value 3–5 sentences):

{
  "problem": "Definition / research problem addressed.",
  "claims": "Key claims or contributions.",
  "method": "Methodology used.",
  "results": "Main results.",
  "discussion": "Discussion and interpretation.",
  "limitations": "Limitations.",
  "future_research": "Future research directions.",
  "conclusion": "Conclusion."
}

Each section must be concise (3–5 sentences). If a section cannot be determined from the paper, use an empty string "" for that key. Output only the JSON object, no markdown or code fences.`;

function stripHtmlToText(html: string): string {
  const noScript = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  const noStyle = noScript.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  const bodyMatch = noStyle.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch ? bodyMatch[1] : noStyle;
  const text = source
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 200000);
}

function extractJsonFromResponse(text: string): Record<string, string> {
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlock ? codeBlock[1].trim() : trimmed;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as Record<string, string>;
      } catch {
        //
      }
    }
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        // Allow headers used by supabase-js when calling Edge Functions
        'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Content-Type': 'application/json',
  };

  try {
    const { paper_id, url } = (await req.json()) as { paper_id?: string; url?: string };
    if (!paper_id || !url?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing paper_id or url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey?.trim()) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY not set. Add it in Supabase Dashboard → Project Settings → Edge Functions → Secrets.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PhDManager/1.0)' },
      redirect: 'follow',
    });
    if (!fetchRes.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${fetchRes.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = (fetchRes.headers.get('content-type') || '').toLowerCase();
    const isPdf = contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf');
    const bytes = new Uint8Array(await fetchRes.arrayBuffer());

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let parts: { text?: string; inlineData?: { mimeType: string; data: string } }[];

    if (isPdf && bytes.length > 0 && bytes.length < 20 * 1024 * 1024) {
      const base64 = btoa(String.fromCharCode(...bytes));
      parts = [
        { text: STRUCTURED_PROMPT },
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
      ];
    } else {
      const text = new TextDecoder().decode(bytes);
      const plain = contentType.includes('text/html')
        ? stripHtmlToText(text)
        : text.slice(0, 200000).replace(/\s+/g, ' ').trim();
      if (!plain || plain.length < 100) {
        return new Response(
          JSON.stringify({ error: 'Could not extract enough text from the document' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      parts = [{ text: `${STRUCTURED_PROMPT}\n\n---\n\nDocument text:\n\n${plain}` }];
    }

    const geminiRes = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${geminiRes.status}`, details: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData?.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text;
    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No summary content in Gemini response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = extractJsonFromResponse(content);
    const problem = typeof parsed.problem === 'string' ? parsed.problem.trim() : null;
    const claims = typeof parsed.claims === 'string' ? parsed.claims.trim() : null;
    const method = typeof parsed.method === 'string' ? parsed.method.trim() : null;
    const results = typeof parsed.results === 'string' ? parsed.results.trim() : null;
    const discussion = typeof parsed.discussion === 'string' ? parsed.discussion.trim() : null;
    const limitations = typeof parsed.limitations === 'string' ? parsed.limitations.trim() : null;
    const future_research = typeof parsed.future_research === 'string' ? parsed.future_research.trim() : null;
    const conclusion = typeof parsed.conclusion === 'string' ? parsed.conclusion.trim() : null;

    const { error: upsertError } = await supabase.from('paper_summary').upsert(
      {
        paper_id,
        problem,
        claims,
        method,
        results,
        discussion,
        limitations,
        future_research,
        conclusion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'paper_id' }
    );

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: 'Failed to save summary', details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, paper_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Supabase Edge Function: synthesize paper summary as MP3 (Google Cloud TTS, en-IN female).
// Requires GOOGLE_TTS_API_KEY in Supabase secrets.
// Narration script logic mirrors src/lib/narration/buildNarrationScript.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICE_NAME = 'en-IN-Neural2-D';
const BUCKET = 'paper-narrations';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Content-Type': 'application/json',
};

interface SummaryRow {
  abstract: string | null;
  key_claims: string | null;
  academic_constructs: string | null;
  introduction: string | null;
  methods: string | null;
  results_and_discussion: string | null;
  conclusion_section: string | null;
  limitations_and_future_research: string | null;
  problem: string | null;
  claims: string | null;
  method: string | null;
  results: string | null;
  discussion: string | null;
  conclusion: string | null;
  limitations: string | null;
  future_research: string | null;
  results_section: string | null;
  discussion_section: string | null;
  limitations_section: string | null;
  future_research_section: string | null;
  narration_url: string | null;
  narration_content_hash: string | null;
}

function plainText(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  return raw
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function section(label: string, body: string | null | undefined): string {
  const text = plainText(body);
  if (!text) return '';
  return `${label}. ${text}`;
}

function buildNarrationScript(
  summary: SummaryRow,
  paper: { title?: string | null; authors?: string | null; year?: string | null }
): string {
  const title = plainText(paper.title) || 'Untitled paper';
  const authors = plainText(paper.authors);
  const year = plainText(paper.year);
  const byline = [authors, year ? `published ${year}` : ''].filter(Boolean).join(', ');

  const resultsMerged =
    summary.results_and_discussion?.trim() ||
    [summary.results_section, summary.discussion_section, summary.results, summary.discussion]
      .map((p) => plainText(p))
      .filter(Boolean)
      .join(' ');

  const limitsMerged =
    summary.limitations_and_future_research?.trim() ||
    [summary.limitations_section, summary.future_research_section, summary.limitations, summary.future_research]
      .map((p) => plainText(p))
      .filter(Boolean)
      .join(' ');

  const conclusion = summary.conclusion_section?.trim() || summary.conclusion?.trim() || '';

  const parts = [
    `Let me walk you through this paper. ${title}.${byline ? ` ${byline}.` : ''}`,
    section('Abstract', summary.abstract || summary.problem),
    section('Key claims', summary.key_claims || summary.claims),
    section('Academic constructs', summary.academic_constructs),
    section('Introduction', summary.introduction),
    section('Methods', summary.methods || summary.method),
    section('Results and discussion', resultsMerged),
    section('Conclusion', conclusion),
    section('Limitations and future research', limitsMerged),
  ].filter(Boolean);

  return parts.join('\n\n');
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Slower, lower pitch delivery — warm podcast-style narration. */
function toSsml(text: string): string {
  const escaped = escapeSsml(text);
  return `<speak><prosody pitch="-1st">${escaped}</prosody></speak>`;
}

function chunkForTts(text: string, maxLen = 4200): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current.trim()) chunks.push(current.trim());
    if (paragraph.length <= maxLen) {
      current = paragraph;
      continue;
    }
    const sentences = paragraph.match(/[^.!?]+[.!?]+|\S+/g) ?? [paragraph];
    let sentenceBuf = '';
    for (const sentence of sentences) {
      const next = sentenceBuf ? `${sentenceBuf} ${sentence}` : sentence;
      if (next.length > maxLen && sentenceBuf) {
        chunks.push(sentenceBuf.trim());
        sentenceBuf = sentence;
      } else {
        sentenceBuf = next;
      }
    }
    current = sentenceBuf;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

async function synthesizeChunk(ssml: string, apiKey: string): Promise<Uint8Array> {
  const res = await fetch(`${TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { ssml },
      voice: {
        languageCode: 'en-IN',
        name: VOICE_NAME,
        ssmlGender: 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.3,
        pitch: -0.5,
        effectsProfileId: ['handset-class-device'],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google TTS error ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = await res.json();
  const b64 = json?.audioContent;
  if (!b64 || typeof b64 !== 'string') {
    throw new Error('No audioContent in TTS response');
  }

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatMp3(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
      },
    });
  }

  try {
    const { paper_id, force } = (await req.json()) as { paper_id?: string; force?: boolean };
    if (!paper_id?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing paper_id' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const ttsKey = Deno.env.get('GOOGLE_TTS_API_KEY');
    if (!ttsKey?.trim()) {
      return new Response(
        JSON.stringify({
          error:
            'GOOGLE_TTS_API_KEY not set. Add it in Supabase Dashboard → Project Settings → Edge Functions → Secrets.',
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [{ data: paper, error: paperErr }, { data: summary, error: summaryErr }] = await Promise.all([
      supabase.from('saved_papers').select('id, title, authors, year').eq('id', paper_id).maybeSingle(),
      supabase.from('paper_summary').select('*').eq('paper_id', paper_id).maybeSingle(),
    ]);

    if (paperErr || !paper) {
      return new Response(JSON.stringify({ error: 'Paper not found' }), { status: 404, headers: corsHeaders });
    }
    if (summaryErr || !summary) {
      return new Response(JSON.stringify({ error: 'No summary for this paper' }), { status: 404, headers: corsHeaders });
    }

    const script = buildNarrationScript(summary as SummaryRow, paper);
    if (script.length < 80) {
      return new Response(JSON.stringify({ error: 'Summary has too little text to narrate' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const contentHash = await sha256Hex(script);
    const row = summary as SummaryRow;

    if (!force && row.narration_url && row.narration_content_hash === contentHash) {
      return new Response(
        JSON.stringify({
          success: true,
          narration_url: row.narration_url,
          narration_content_hash: contentHash,
          cached: true,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const textChunks = chunkForTts(script);
    const audioParts: Uint8Array[] = [];
    for (const chunk of textChunks) {
      audioParts.push(await synthesizeChunk(toSsml(chunk), ttsKey));
    }
    const mp3 = concatMp3(audioParts);

    const storagePath = `${paper_id}.mp3`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(storagePath, mp3, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to upload narration', details: uploadErr.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const narrationUrl = `${publicData.publicUrl}?v=${contentHash.slice(0, 12)}`;

    const { error: updateErr } = await supabase
      .from('paper_summary')
      .update({
        narration_url: narrationUrl,
        narration_content_hash: contentHash,
        updated_at: new Date().toISOString(),
      })
      .eq('paper_id', paper_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to save narration metadata', details: updateErr.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        narration_url: narrationUrl,
        narration_content_hash: contentHash,
        cached: false,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

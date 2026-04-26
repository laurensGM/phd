import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ollamaBaseUrl = (process.env.PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const embedModel = process.env.PUBLIC_LOCAL_EMBED_MODEL || 'nomic-embed-text';
const batchSize = Math.max(1, parseInt(process.env.SNIPPET_EMBED_BATCH_SIZE || '50', 10));

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Missing required env vars: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getEmbedding(text) {
  const response = await fetch(`${ollamaBaseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: embedModel,
      prompt: text,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Embedding request failed (${response.status}): ${body}`);
  }
  const data = await response.json();
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Embedding response missing vector.');
  }
  return data.embedding;
}

async function run() {
  console.log('Starting snippet embedding backfill...');
  console.log(`Ollama: ${ollamaBaseUrl}`);
  console.log(`Model:  ${embedModel}`);
  console.log(`Batch:  ${batchSize}`);

  let offset = 0;
  let processed = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    const { data, error } = await supabase
      .from('snippets')
      .select('id, content, embedding')
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      processed += 1;
      if (row.embedding && Array.isArray(row.embedding) && row.embedding.length > 0) {
        continue;
      }
      try {
        const embedding = await getEmbedding((row.content || '').trim());
        const { error: updateErr } = await supabase
          .from('snippets')
          .update({ embedding })
          .eq('id', row.id);
        if (updateErr) throw updateErr;
        updated += 1;
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Failed embedding for snippet ${row.id}: ${msg}`);
      }
    }

    console.log(
      `Processed ${processed} | Updated ${updated} | Failed ${failed} | Next offset ${offset + rows.length}`
    );
    offset += rows.length;
  }

  console.log('Backfill complete.');
  console.log(`Processed: ${processed}`);
  console.log(`Updated:   ${updated}`);
  console.log(`Failed:    ${failed}`);
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});

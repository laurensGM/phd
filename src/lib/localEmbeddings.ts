const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_EMBED_MODEL = 'nomic-embed-text';

function getOllamaBaseUrl(): string {
  const raw = import.meta.env.PUBLIC_OLLAMA_BASE_URL as string | undefined;
  return (raw && raw.trim()) || DEFAULT_OLLAMA_BASE_URL;
}

function getEmbedModel(): string {
  const raw = import.meta.env.PUBLIC_LOCAL_EMBED_MODEL as string | undefined;
  return (raw && raw.trim()) || DEFAULT_EMBED_MODEL;
}

export async function getLocalEmbedding(text: string): Promise<number[]> {
  const content = text.trim();
  if (!content) return [];

  const endpoint = `${getOllamaBaseUrl().replace(/\/$/, '')}/api/embeddings`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: getEmbedModel(),
      prompt: content,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed (${response.status})`);
  }

  const data = (await response.json()) as { embedding?: number[] };
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Embedding service returned no vector.');
  }

  return data.embedding;
}

import { buildNarrationScript, type NarrationPaperMeta, type NarrationSummaryInput } from './buildNarrationScript';

/** SHA-256 hex digest of narration script (must match edge function). */
export async function narrationContentHash(
  summary: NarrationSummaryInput,
  paper: NarrationPaperMeta = {}
): Promise<string> {
  const script = buildNarrationScript(summary, paper);
  const data = new TextEncoder().encode(script);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

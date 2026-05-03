/** Build a prompt to paste into an external LLM (no server API in this app). */
export function buildClaimSuggestPrompt(params: {
  relationshipType: string;
  constructLabels: string[];
  evidenceLines: string[];
}): string {
  const { relationshipType, constructLabels, evidenceLines } = params;
  const ev = evidenceLines.join('\n\n---\n\n');
  return `You are assisting a PhD researcher in Information Systems / business sciences.

TASK: Given the evidence snippets below, propose the most defensible relationship between the constructs involved.
Relationship type the author is emphasising: ${relationshipType || 'not specified'}.
Constructs: ${constructLabels.join(', ') || '(see snippets)'}.

EVIDENCE (numbered excerpts from papers):
${ev}

RULES:
- Return exactly TWO options labelled "Option A:" and "Option B:" on separate lines (or short paragraphs).
- Each option must be ONE concise, testable claim (one or two sentences max).
- Use only what is supported by the snippets; if evidence is mixed, say so briefly inside the claim.
- Do not invent citations or studies not implied by the text.

OUTPUT FORMAT (strict):
Option A: <claim>
Option B: <claim>
`;
}

/** Best-effort parse of pasted LLM output. */
export function parseClaimOptions(pasted: string): { a: string; b: string } | null {
  const mA = pasted.match(/option\s*a\s*[:.:]\s*([\s\S]*?)(?=\n\s*option\s*b\s*[:.:]|$)/i);
  const mB = pasted.match(/option\s*b\s*[:.:]\s*([\s\S]*)/i);
  const a = mA?.[1]?.trim().replace(/\s+/g, ' ');
  if (!a) return null;
  const b = mB?.[1]?.trim().replace(/\s+/g, ' ') ?? '';
  return { a, b };
}

export function buildParagraphFromClaimPrompt(claimText: string, evidenceLines: string[]): string {
  const ev = evidenceLines.join('\n\n---\n\n');
  return `Write ONE concise academic literature-review paragraph (5–8 sentences) that supports this claim:

${claimText}

Evidence:
${ev}

Requirements: formal tone, synthesise sources, author–year citations where authors appear in the evidence. Do not invent studies.`;
}

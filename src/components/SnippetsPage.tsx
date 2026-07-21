import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { usePageLoader } from '../hooks/usePageLoader';
import { usePermissions } from '../hooks/usePermissions';
import AccessDenied from './AccessDenied';
import constructsData from '../data/constructs.json';
import modelsData from '../data/models.json';
import umbrellaConstructsData from '../data/umbrella-constructs.json';
import { getLocalEmbedding } from '../lib/localEmbeddings';
import {
  CONTRIBUTION_TYPE_LABELS,
  type ContributionType,
  isContributionType,
} from '../data/contribution-types';
import { FormatDiaryText } from '../lib/formatDiaryText';
import { paperDetailUrl } from '../lib/paperDetailUrl';

const SNIPPET_TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'definition', label: 'Definition' },
  { value: 'theory', label: 'Theory' },
  { value: 'empirical finding', label: 'Empirical finding' },
  { value: 'method', label: 'Method' },
  { value: 'impact', label: 'Impact' },
  {
    value: 'limitations and future research',
    label: 'Limitations and Future Research',
  },
] as const;

const SNIPPET_TYPE_LABEL_BY_VALUE = new Map(
  SNIPPET_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])
);

function canonicalSnippetType(value: string | null | undefined): string {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'limitation' || v === 'future research' || v === 'limitations and future research') {
    return 'limitations and future research';
  }
  return v;
}

function snippetTypeLabel(value: string | null | undefined): string {
  const canonical = canonicalSnippetType(value);
  return SNIPPET_TYPE_LABEL_BY_VALUE.get(canonical) ?? (value ?? '').trim();
}

function contributionLinkErrorMessage(message: string): string {
  if (/contribution_id/i.test(message)) {
    return `${message} Run migration 040_snippets_contribution_id.sql in Supabase, then reload the API schema if needed.`;
  }
  return message;
}

/** First token before comma, or last word (typical surname). */
function authorSurname(author: string): string {
  const trimmed = author.trim();
  if (!trimmed) return '';
  if (trimmed.includes(',')) return trimmed.split(',')[0].trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words[words.length - 1]! : trimmed;
}

function parseAuthorList(authorsRaw: string): string[] {
  return authorsRaw
    .split(/[,;]|\s+and\s+|\s*&\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

function formatPaperYear(year: string | null | undefined): string | null {
  const trimmed = year?.trim();
  if (!trimmed) return null;
  return trimmed.match(/\d{4}/)?.[0] ?? trimmed;
}

/** e.g. Venkatesh et al. 2003 p. 200 */
function formatSnippetSourceLine(paper: PaperSummary | undefined, pageNumber: number | null): string {
  const bits: string[] = [];
  const authorsRaw = paper?.authors?.trim();
  if (authorsRaw) {
    const authors = parseAuthorList(authorsRaw);
    if (authors.length === 1) {
      bits.push(authorSurname(authors[0]!));
    } else if (authors.length === 2) {
      bits.push(`${authorSurname(authors[0]!)} & ${authorSurname(authors[1]!)}`);
    } else if (authors.length > 2) {
      bits.push(`${authorSurname(authors[0]!)} et al.`);
    }
  }
  const yr = formatPaperYear(paper?.year);
  if (yr) bits.push(yr);
  let line = bits.join(' ');
  if (pageNumber != null) {
    line = line ? `${line} p. ${pageNumber}` : `p. ${pageNumber}`;
  }
  return line || 'Unknown source';
}

function buildFilteredSnippetsExportText(
  snippets: Snippet[],
  paperById: Map<string, PaperSummary>
): string {
  return snippets
    .map((s) => {
      const source = formatSnippetSourceLine(paperById.get(s.paper_id), s.page_number);
      return `${s.content.trim()}\n\n${source}`;
    })
    .join('\n\n');
}

function isSnippetUsedInWriting(s: Snippet): boolean {
  return Boolean((s as { used_in_writing?: boolean }).used_in_writing);
}

/** True when snippet created_at is on or after the given YYYY-MM-DD (local midnight). */
function snippetCreatedOnOrAfter(createdAt: string, dateStr: string): boolean {
  if (!dateStr) return true;
  const cutoff = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(cutoff.getTime())) return true;
  const created = new Date(createdAt);
  return !Number.isNaN(created.getTime()) && created >= cutoff;
}

/** Collapse pasted line breaks and extra whitespace into a single line. */
function normaliseSnippetContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[\n\r\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SNIPPET_PREVIEW_LENGTH = 140;
type SearchMode = 'keyword' | 'semantic';
type SnippetsTab = 'snippets' | 'saved-prompts';
type PromptStrategy = 'paragraph' | 'analysis';
/** Snippet “processed” filter: used in writing vs still in queue. */
type FilterProcessed = '' | 'processed' | 'unprocessed';
const DEFAULT_SEMANTIC_MATCH_COUNT = 50;
const DEFAULT_SEMANTIC_MIN_SIMILARITY = 0.55;

function buildLiteratureReviewPrompt(claim: string, evidenceBlock: string, strategy: PromptStrategy): string {
  const c = claim.trim();
  const e = evidenceBlock.trim();
  if (strategy === 'analysis') {
    return `You are a research analysis assistant for a PhD-level Information Systems literature review.

TASK FOCUS:
${c}

EVIDENCE (snippets from academic papers):
${e}

INSTRUCTIONS:
- Do NOT write a full narrative paragraph.
- Use only the provided evidence.
- Do NOT invent studies, findings, or citations.
- If evidence is weak, mixed, or missing, state that explicitly.

OUTPUT FORMAT (use these exact section headings):
1) Bullet summary
- 4-8 concise bullets capturing the core findings relevant to the task focus.

2) Argument map
- List key claims and supporting evidence chains in bullet form.
- Show links between constructs where possible.

3) Compare findings
- Highlight agreements and differences across the included studies/snippets.
- Note contextual differences (method, setting, population) when visible.

4) Identify contradictions
- Explicitly list tensions, contradictions, or unresolved inconsistencies.
- If none are visible, state "No clear contradictions in provided evidence."
`;
  }
  return `You are writing an academic literature review paragraph for a PhD-level paper in Information Systems.

TASK:
Write ONE concise, well-structured paragraph that supports the following claim:

${c}

EVIDENCE (snippets from academic papers):
${e}

REQUIREMENTS:
- Use formal academic language
- Synthesize the evidence (do NOT copy or list snippets)
- Show relationships between constructs where relevant
- Combine multiple sources into a coherent argument
- Avoid repetition
- Be precise and concise (5–8 sentences maximum)
- Do NOT invent findings that are not present in the snippets
- If evidence is limited or mixed, reflect that uncertainty

CITATIONS:
- Use author–year style where possible (e.g., Bhattacherjee, 2001)
- If author names are not available, refer to "prior research" or "existing studies"
- Do NOT fabricate citations

OUTPUT:
Return only the paragraph (no bullet points, no headings).`;
}

function buildEvidenceBlock(
  orderedIds: string[],
  snippetById: Map<string, Snippet>,
  paperById: Map<string, PaperSummary>
): string {
  const parts: string[] = [];
  let n = 0;
  for (const id of orderedIds) {
    const s = snippetById.get(id);
    if (!s) continue;
    n += 1;
    const p = paperById.get(s.paper_id);
    const lines: string[] = [];
    lines.push(`[${n}]`);
    if (p?.title?.trim()) lines.push(`Paper: ${p.title.trim()}`);
    if (p?.authors?.trim()) lines.push(`Authors: ${p.authors.trim()}`);
    if (p?.year?.trim()) lines.push(`Year: ${p.year.trim()}`);
    if (p?.journal?.trim()) lines.push(`Journal: ${p.journal.trim()}`);
    if (s.page_number != null) lines.push(`Page: ${s.page_number}`);
    lines.push(`Snippet: ${s.content}`);
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}

interface Snippet {
  id: string;
  paper_id: string;
  construct_id: string | null;
  model_id: string | null;
  construct_ids?: string[];
  model_ids?: string[];
  content: string;
  notes: string | null;
  embedding?: number[] | null;
  tags: string[];
  page_number: number | null;
  snippet_type: string | null;
  /** Marked on the snippets page when incorporated into a draft / thesis. */
  used_in_writing?: boolean;
  contribution_id?: string | null;
  created_at: string;
}

interface ContributionSummary {
  id: string;
  content: string;
  contribution_type: ContributionType | null;
}

interface ClaimSummary {
  id: string;
  title: string;
  claim_text: string;
}

interface ClaimSnippetLink {
  id: string;
  claim_id: string;
  snippet_id: string;
  role: string;
}

interface PaperSummary {
  id: string;
  title: string | null;
  url: string;
  journal: string | null;
  authors?: string | null;
  year?: string | null;
}

interface LiteratureReviewPrompt {
  id: string;
  claim: string;
  snippet_ids: string[];
  prompt_text: string;
  generated_paragraph: string | null;
  created_at: string;
  updated_at: string;
}

const constructOptions = (constructsData as any[])
  .map((c) => ({
    id: c.id as string,
    name: (c.name as string) || (c.id as string),
    abbreviation: (c.abbreviation as string | undefined) ?? undefined,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

const modelOptions = (modelsData as any[]).map((m) => ({
  id: m.id as string,
  name: (m.name as string) || (m.id as string),
  abbreviation: (m.abbreviation as string | undefined) ?? undefined,
}));

/** Canonicalize legacy model ids still present on some snippet rows. */
function canonicalModelId(id: string): string {
  if (id === 'ttf') return 'tpc';
  if (id === 'ecm') return 'ecm-is';
  return id;
}

interface UmbrellaConstructItem {
  id: string;
  name: string;
  constructIds: string[];
}
const umbrellaConstructs = umbrellaConstructsData as UmbrellaConstructItem[];

/** Flatten ids so comma-separated values in any element become separate ids (fixes legacy "id1,id2" in one cell). */
function flattenIds(ids: string[]): string[] {
  return ids.flatMap((id) =>
    id.includes(',') ? id.split(',').map((x) => x.trim()).filter(Boolean) : [id]
  );
}

/** Normalize snippet construct ids: use construct_id when construct_ids is empty (e.g. extension-only payload). */
function getSnippetConstructIds(s: any): string[] {
  const raw = s.construct_ids ?? s.construct_id;
  if (Array.isArray(raw) && raw.length > 0) return flattenIds(raw as string[]);
  if (typeof raw === 'string' && raw) return flattenIds(raw.split(',').map((x: string) => x.trim()).filter(Boolean));
  return s.construct_id ? flattenIds([s.construct_id]) : [];
}

/** Normalize snippet model ids: use model_id when model_ids is empty (e.g. extension-only payload). */
function getSnippetModelIds(s: any): string[] {
  const raw = s.model_ids ?? s.model_id;
  if (Array.isArray(raw) && raw.length > 0) return flattenIds(raw as string[]);
  if (typeof raw === 'string' && raw) return flattenIds(raw.split(',').map((x: string) => x.trim()).filter(Boolean));
  return s.model_id ? flattenIds([s.model_id]) : [];
}

export default function SnippetsPage() {
  const { loading: permLoading, canViewSnippets, canEditSnippets } = usePermissions();
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  usePageLoader(loading || permLoading);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterPaperId, setFilterPaperId] = useState('');
  const [filterJournalNames, setFilterJournalNames] = useState<string[]>([]);
  const [filterConstructIds, setFilterConstructIds] = useState<string[]>([]);
  const [filterUmbrellaConstructId, setFilterUmbrellaConstructId] = useState('');
  const [filterModelIds, setFilterModelIds] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [filterSnippetType, setFilterSnippetType] = useState('');
  const [filterProcessed, setFilterProcessed] = useState<FilterProcessed>('');
  const [filterCreatedAfter, setFilterCreatedAfter] = useState('');
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [activeTab, setActiveTab] = useState<SnippetsTab>('snippets');
  const [semanticIdsOrdered, setSemanticIdsOrdered] = useState<string[]>([]);
  const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);
  const [semanticSearchError, setSemanticSearchError] = useState<string | null>(null);
  const [semanticMatchCount, setSemanticMatchCount] = useState<number>(DEFAULT_SEMANTIC_MATCH_COUNT);
  const [semanticMinSimilarity, setSemanticMinSimilarity] = useState<number>(DEFAULT_SEMANTIC_MIN_SIMILARITY);

  const [newContent, setNewContent] = useState('');
  const [newPaperId, setNewPaperId] = useState('');
  const [newConstructId, setNewConstructId] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newPageNumber, setNewPageNumber] = useState<string>('');
  const [newTagsInput, setNewTagsInput] = useState('');
  const [newSnippetType, setNewSnippetType] = useState('');

  const [allTags, setAllTags] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editConstructId, setEditConstructId] = useState('');
  const [editModelId, setEditModelId] = useState('');
  const [editPageNumber, setEditPageNumber] = useState<string>('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editSnippetType, setEditSnippetType] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedSnippetIds, setExpandedSnippetIds] = useState<string[]>([]);
  const [togglingProcessedId, setTogglingProcessedId] = useState<string | null>(null);

  const [promptMode, setPromptMode] = useState(false);
  const [selectedSnippetIds, setSelectedSnippetIds] = useState<string[]>([]);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptStep, setPromptStep] = useState<'claim' | 'preview'>('claim');
  const [promptClaim, setPromptClaim] = useState('');
  const [promptStrategy, setPromptStrategy] = useState<PromptStrategy>('paragraph');
  const [builtPromptText, setBuiltPromptText] = useState('');
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptCopyFeedback, setPromptCopyFeedback] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<LiteratureReviewPrompt[]>([]);
  const [savedPromptsLoading, setSavedPromptsLoading] = useState(true);
  const [localEmbeddingsAvailable, setLocalEmbeddingsAvailable] = useState(true);
  const [contributions, setContributions] = useState<ContributionSummary[]>([]);
  const [linkingSnippetId, setLinkingSnippetId] = useState<string | null>(null);
  const [linkingContribution, setLinkingContribution] = useState(false);
  const [linkingContributionTargetId, setLinkingContributionTargetId] = useState<string | null>(null);
  const [contributionLinkError, setContributionLinkError] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [claimLinks, setClaimLinks] = useState<ClaimSnippetLink[]>([]);
  const [linkingClaimSnippetId, setLinkingClaimSnippetId] = useState<string | null>(null);
  const [linkingClaim, setLinkingClaim] = useState(false);
  const [linkingClaimTargetId, setLinkingClaimTargetId] = useState<string | null>(null);
  const [claimLinkError, setClaimLinkError] = useState<string | null>(null);
  const [targetClaimId, setTargetClaimId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    setLocalEmbeddingsAvailable(localHosts.has(host));
    const claimId = new URLSearchParams(window.location.search).get('claimId');
    setTargetClaimId(claimId);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError('Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [{ data: snippetData, error: snippetErr }, { data: papersData, error: papersErr }, contributionsRes, claimsRes] =
        await Promise.all([
          supabase!
            .from('snippets')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase!.from('saved_papers').select('id,title,url,journal,authors,year'),
          supabase!
            .from('research_contributions')
            .select('id, content, contribution_type')
            .order('created_at', { ascending: false }),
          supabase!
            .from('claims')
            .select('id, title, claim_text')
            .order('created_at', { ascending: false }),
        ]);
      if (cancelled) return;
      if (snippetErr) {
        setError(snippetErr.message);
        setSnippets([]);
      } else {
        const list = (snippetData ?? []) as Snippet[];
        setSnippets(list);
        const tagSet = new Set<string>();
        for (const s of list) {
          if (Array.isArray(s.tags)) {
            for (const t of s.tags) {
              if (t && typeof t === 'string') tagSet.add(t);
            }
          }
        }
        setAllTags(Array.from(tagSet));
      }
      if (papersErr) {
        // keep error but still show snippets
        setError((prev) => prev ?? papersErr.message);
        setPapers([]);
      } else {
        setPapers(
          (papersData ?? []).map((p: any) => ({
            id: p.id as string,
            title: (p.title as string | null) ?? null,
            url: p.url as string,
            journal: (p.journal as string | null) ?? null,
            authors: (p.authors as string | null) ?? null,
            year: (p.year as string | null) ?? null,
          }))
        );
      }
      if (contributionsRes.error) {
        setContributions([]);
      } else {
        setContributions(
          (contributionsRes.data ?? []).map((row: any) => ({
            id: row.id as string,
            content: row.content as string,
            contribution_type: isContributionType(row.contribution_type)
              ? row.contribution_type
              : null,
          }))
        );
      }
      if (claimsRes.error) {
        setClaims([]);
        setClaimLinks([]);
      } else {
        setClaims(
          (claimsRes.data ?? []).map((row: any) => ({
            id: row.id as string,
            title: (row.title as string) ?? '',
            claim_text: row.claim_text as string,
          }))
        );
        const snippetIds = ((snippetData ?? []) as Snippet[]).map((s) => s.id);
        if (snippetIds.length > 0) {
          const { data: linkData, error: linkErr } = await supabase!
            .from('claim_snippets')
            .select('id, claim_id, snippet_id, role')
            .in('snippet_id', snippetIds);
          if (!cancelled) {
            setClaimLinks(linkErr ? [] : ((linkData as ClaimSnippetLink[]) ?? []));
          }
        } else {
          setClaimLinks([]);
        }
      }
      const promptsRes = await supabase!
        .from('literature_review_prompts')
        .select('*')
        .order('created_at', { ascending: false });
      if (promptsRes.error) {
        setSavedPrompts([]);
      } else {
        setSavedPrompts((promptsRes.data ?? []) as LiteratureReviewPrompt[]);
      }
      setSavedPromptsLoading(false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const paperById = useMemo(() => {
    const map = new Map<string, PaperSummary>();
    for (const p of papers) map.set(p.id, p);
    return map;
  }, [papers]);

  const snippetById = useMemo(() => {
    const map = new Map<string, Snippet>();
    for (const s of snippets) map.set(s.id, s);
    return map;
  }, [snippets]);

  const contributionById = useMemo(() => {
    const map = new Map<string, ContributionSummary>();
    for (const c of contributions) map.set(c.id, c);
    return map;
  }, [contributions]);

  const claimById = useMemo(() => {
    const map = new Map<string, ClaimSummary>();
    for (const c of claims) map.set(c.id, c);
    return map;
  }, [claims]);

  const claimLinksBySnippetId = useMemo(() => {
    const map = new Map<string, ClaimSnippetLink[]>();
    for (const link of claimLinks) {
      const list = map.get(link.snippet_id) ?? [];
      list.push(link);
      map.set(link.snippet_id, list);
    }
    return map;
  }, [claimLinks]);

  const targetClaim = targetClaimId ? claimById.get(targetClaimId) : undefined;

  const allJournals = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((p) => {
      if (p.journal && p.journal.trim()) set.add(p.journal.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [papers]);

  const papersSortedAlphabetically = useMemo(() => {
    return [...papers].sort((a, b) => {
      const labelA = (a.title && a.title.trim()) || a.url;
      const labelB = (b.title && b.title.trim()) || b.url;
      return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
    });
  }, [papers]);

  const constructSnippetCounts = useMemo(() => {
    const map = new Map<string, number>();
    snippets.forEach((s) => {
      const rawSnippetConstructs = getSnippetConstructIds(s);
      const normalized = rawSnippetConstructs
        .map((val) => {
          const match = constructOptions.find(
            (opt) =>
              opt.id === val ||
              opt.name.toLowerCase() === val.toLowerCase() ||
              opt.abbreviation?.toLowerCase() === val.toLowerCase()
          );
          return match ? match.id : val;
        })
        .filter(Boolean);
      normalized.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [snippets]);

  const modelSnippetCounts = useMemo(() => {
    const map = new Map<string, number>();
    snippets.forEach((s) => {
      const ids = getSnippetModelIds(s).map(canonicalModelId);
      ids.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [snippets]);

  const modelOptionsAlphabetical = useMemo(() => {
    return [...modelOptions].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, []);

  const snippetTypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    snippets.forEach((s) => {
      const st = canonicalSnippetType((s as any).snippet_type);
      if (!st) return;
      map.set(st, (map.get(st) ?? 0) + 1);
    });
    return map;
  }, [snippets]);

  const processedSnippetCount = useMemo(
    () => snippets.reduce((n, s) => n + (isSnippetUsedInWriting(s) ? 1 : 0), 0),
    [snippets]
  );
  const unprocessedSnippetCount = snippets.length - processedSnippetCount;

  const filteredSnippetsBase = useMemo(() => {
    return snippets.filter((s) => {
      if (filterPaperId && s.paper_id !== filterPaperId) return false;
      if (filterJournalNames.length > 0) {
        const paper = paperById.get(s.paper_id);
        const journal = paper?.journal?.trim();
        if (!journal || !filterJournalNames.some((j) => j === journal)) return false;
      }
      if (filterConstructIds.length > 0) {
        const rawSnippetConstructs = getSnippetConstructIds(s);
        const normalisedConstructIds = rawSnippetConstructs
          .map((val) => {
            const match = constructOptions.find(
              (opt) =>
                opt.id === val ||
                opt.name.toLowerCase() === val.toLowerCase() ||
                opt.abbreviation?.toLowerCase() === val.toLowerCase()
            );
            return match ? match.id : val;
          })
          .filter(Boolean);

        if (!normalisedConstructIds.some((id) => filterConstructIds.includes(id))) return false;
      }
      if (filterUmbrellaConstructId) {
        const umbrella = umbrellaConstructs.find((u) => u.id === filterUmbrellaConstructId);
        if (umbrella) {
          const snippetConstructIds = getSnippetConstructIds(s);
          const umbrellaSet = new Set(umbrella.constructIds);
          if (!snippetConstructIds.some((id) => umbrellaSet.has(id))) return false;
        }
      }
      if (filterModelIds.length > 0) {
        const snippetModels = getSnippetModelIds(s).map(canonicalModelId);
        if (!snippetModels.some((id) => filterModelIds.includes(id))) return false;
      }
      if (filterSnippetType) {
        const st = canonicalSnippetType((s as any).snippet_type);
        if (st !== filterSnippetType) return false;
      }
      if (filterProcessed === 'processed' && !isSnippetUsedInWriting(s)) return false;
      if (filterProcessed === 'unprocessed' && isSnippetUsedInWriting(s)) return false;
      if (filterTag) {
        const tags = Array.isArray(s.tags) ? s.tags : [];
        if (!tags.some((t) => t.toLowerCase() === filterTag.toLowerCase())) return false;
      }
      if (!snippetCreatedOnOrAfter(s.created_at, filterCreatedAfter)) return false;
      if (search && searchMode === 'keyword') {
        const q = search.toLowerCase();
        const inContent = s.content.toLowerCase().includes(q);
        const tags = Array.isArray(s.tags) ? s.tags.join(' ').toLowerCase() : '';
        const constructName =
          constructOptions.find((c) => getSnippetConstructIds(s).includes(c.id))?.name.toLowerCase() ?? '';
        const snippetModelIdsCanon = getSnippetModelIds(s).map(canonicalModelId);
        const modelName =
          modelOptions.find((m) => snippetModelIdsCanon.includes(m.id))?.name.toLowerCase() ?? '';
        if (!inContent && !tags.includes(q) && !constructName.includes(q) && !modelName.includes(q))
          return false;
      }
      return true;
    });
  }, [
    snippets,
    filterPaperId,
    filterJournalNames,
    filterConstructIds,
    filterUmbrellaConstructId,
    filterModelIds,
    filterSnippetType,
    filterProcessed,
    filterTag,
    filterCreatedAfter,
    search,
    searchMode,
    paperById,
  ]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterPaperId) n += 1;
    if (filterJournalNames.length) n += 1;
    if (filterConstructIds.length) n += 1;
    if (filterUmbrellaConstructId) n += 1;
    if (filterModelIds.length) n += 1;
    if (filterSnippetType) n += 1;
    if (filterProcessed) n += 1;
    if (filterTag) n += 1;
    if (filterCreatedAfter) n += 1;
    if (search.trim()) n += 1;
    return n;
  }, [
    filterPaperId,
    filterJournalNames,
    filterConstructIds,
    filterUmbrellaConstructId,
    filterModelIds,
    filterSnippetType,
    filterProcessed,
    filterTag,
    filterCreatedAfter,
    search,
  ]);

  const clearAllFilters = useCallback(() => {
    setFilterPaperId('');
    setFilterJournalNames([]);
    setFilterConstructIds([]);
    setFilterUmbrellaConstructId('');
    setFilterModelIds([]);
    setFilterSnippetType('');
    setFilterProcessed('');
    setFilterTag('');
    setFilterCreatedAfter('');
    setSearch('');
  }, []);

  const filteredSnippets = useMemo(() => {
    if (searchMode !== 'semantic' || !search.trim()) return filteredSnippetsBase;

    if (semanticIdsOrdered.length === 0) return [];
    const order = new Map<string, number>();
    semanticIdsOrdered.forEach((id, idx) => order.set(id, idx));
    return filteredSnippetsBase
      .filter((s) => order.has(s.id))
      .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [filteredSnippetsBase, searchMode, search, semanticIdsOrdered]);

  const truncatableSnippets = useMemo(
    () => filteredSnippets.filter((s) => s.content.length > SNIPPET_PREVIEW_LENGTH),
    [filteredSnippets]
  );

  const allTruncatableExpanded = useMemo(() => {
    if (truncatableSnippets.length === 0) return false;
    return truncatableSnippets.every((s) => expandedSnippetIds.includes(s.id));
  }, [truncatableSnippets, expandedSnippetIds]);

  const toggleExpandAllTruncatable = useCallback(() => {
    if (truncatableSnippets.length === 0) return;
    const idSet = new Set(truncatableSnippets.map((x) => x.id));
    setExpandedSnippetIds((prev) => {
      const allOn = truncatableSnippets.every((s) => prev.includes(s.id));
      if (allOn) return prev.filter((id) => !idSet.has(id));
      return [...new Set([...prev, ...idSet])];
    });
  }, [truncatableSnippets]);

  const exportFilteredSnippetsTxt = useCallback(() => {
    if (filteredSnippets.length === 0) return;
    const text = buildFilteredSnippetsExportText(filteredSnippets, paperById);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippets-${stamp}.txt`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [filteredSnippets, paperById]);

  useEffect(() => {
    if (!localEmbeddingsAvailable) {
      setSemanticIdsOrdered([]);
      setSemanticSearchLoading(false);
      setSemanticSearchError('Semantic search is disabled on deployed sites. Use localhost to connect to Ollama.');
      return;
    }
    if (searchMode !== 'semantic' || !search.trim()) {
      setSemanticIdsOrdered([]);
      setSemanticSearchLoading(false);
      setSemanticSearchError(null);
      return;
    }
    if (!supabase || !isSupabaseConfigured()) return;

    let cancelled = false;
    (async () => {
      setSemanticSearchLoading(true);
      setSemanticSearchError(null);
      try {
        const embedding = await getLocalEmbedding(search.trim());
        if (cancelled) return;
        const { data, error } = await (supabase as any).rpc('match_snippets_semantic', {
          query_embedding: embedding,
          match_count: semanticMatchCount,
        });
        if (cancelled) return;
        if (error) throw error;
        const ids = ((data ?? []) as Array<{ snippet_id: string; similarity: number }>)
          .filter((row) => typeof row.similarity === 'number' && row.similarity >= semanticMinSimilarity)
          .map((row) => row.snippet_id);
        setSemanticIdsOrdered(ids);
      } catch (err: any) {
        if (cancelled) return;
        setSemanticIdsOrdered([]);
        setSemanticSearchError(
          err?.message ||
            'Semantic search failed. Ensure local embeddings are running (default: Ollama at http://localhost:11434).'
        );
      } finally {
        if (!cancelled) setSemanticSearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchMode, search, localEmbeddingsAvailable, semanticMatchCount, semanticMinSimilarity]);

  const syncSnippetEmbedding = useCallback(async (snippetId: string, content: string) => {
    if (!supabase || !isSupabaseConfigured()) return;
    try {
      const embedding = await getLocalEmbedding(content);
      await (supabase as any).from('snippets').update({ embedding }).eq('id', snippetId);
    } catch {
      // Non-blocking; snippet save still succeeds without a vector.
    }
  }, []);

  const handleAddSnippet = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canEditSnippets) return;
      if (!normaliseSnippetContent(newContent) || !newPaperId) return;
      if (!supabase || !isSupabaseConfigured()) return;
      setSaving(true);
      setError(null);
      const pageNum = newPageNumber.trim() ? parseInt(newPageNumber, 10) : null;
      const rawTags = newTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const existingByLower = allTags.reduce<Record<string, string>>((acc, t) => {
        acc[t.toLowerCase()] = t;
        return acc;
      }, {});
      const tags: string[] = [];
      for (const t of rawTags) {
        const key = t.toLowerCase();
        const canonical = existingByLower[key] ?? t;
        if (!tags.some((x) => x.toLowerCase() === canonical.toLowerCase())) {
          tags.push(canonical);
        }
      }
      const constructIds = newConstructId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const modelIds = newModelId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      const { data, error: insertErr } = await supabase
        .from('snippets')
        .insert({
          paper_id: newPaperId,
          construct_id: constructIds[0] ?? null,
          model_id: modelIds[0] ?? null,
          construct_ids: constructIds,
          model_ids: modelIds,
          content: normaliseSnippetContent(newContent),
          notes: null,
          tags,
          page_number: pageNum != null && !Number.isNaN(pageNum) ? pageNum : null,
          snippet_type: canonicalSnippetType(newSnippetType) || null,
        })
        .select('*')
        .single();
      if (insertErr) {
        setError(insertErr.message);
      } else if (data) {
        const inserted = data as Snippet;
        setSnippets((prev) => [inserted, ...prev]);
        void syncSnippetEmbedding(inserted.id, inserted.content);
        if (Array.isArray(inserted.tags)) {
          setAllTags((prev) => {
            const set = new Set(prev);
            for (const t of inserted.tags) {
              if (t && typeof t === 'string') set.add(t);
            }
            return Array.from(set);
          });
        }
        setNewContent('');
        setNewPaperId('');
        setNewConstructId('');
        setNewModelId('');
        setNewPageNumber('');
        setNewTagsInput('');
        setNewSnippetType('');
        setShowAddModal(false);
      }
      setSaving(false);
    },
    [canEditSnippets, newContent, newPaperId, newConstructId, newModelId, newPageNumber, newTagsInput, newSnippetType, allTags, syncSnippetEmbedding]
  );

  const handleLinkContribution = useCallback(async (snippetId: string, contributionId: string | null) => {
    if (!supabase || !isSupabaseConfigured()) return;
    setLinkingContribution(true);
    setLinkingContributionTargetId(contributionId);
    setContributionLinkError(null);
    setError(null);

    try {
      const { data, error: updateErr } = await supabase
        .from('snippets')
        .update({
          contribution_id: contributionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', snippetId)
        .select('id, contribution_id')
        .single();

      if (updateErr) {
        const msg = contributionLinkErrorMessage(updateErr.message);
        setContributionLinkError(msg);
        setError(msg);
        return;
      }

      if (!data) {
        const msg = 'Link did not save — no row was returned from the database.';
        setContributionLinkError(msg);
        setError(msg);
        return;
      }

      setSnippets((prev) =>
        prev.map((snippet) =>
          snippet.id === snippetId
            ? { ...snippet, contribution_id: data.contribution_id ?? contributionId }
            : snippet
        )
      );
      setLinkingSnippetId(null);
    } finally {
      setLinkingContribution(false);
      setLinkingContributionTargetId(null);
    }
  }, []);

  const handleLinkClaim = useCallback(async (snippetId: string, claimId: string) => {
    if (!supabase || !isSupabaseConfigured()) return;
    const existing = claimLinks.some((l) => l.snippet_id === snippetId && l.claim_id === claimId);
    if (existing) {
      setClaimLinkError('This snippet is already linked to that claim.');
      return;
    }
    setLinkingClaim(true);
    setLinkingClaimTargetId(claimId);
    setClaimLinkError(null);
    setError(null);

    try {
      const snippet = snippets.find((s) => s.id === snippetId);
      const snippetType = (snippet?.snippet_type ?? '').toLowerCase().trim();
      const role = snippetType === 'definition' ? 'definition' : 'supporting';
      const { data, error: insertErr } = await supabase
        .from('claim_snippets')
        .insert({ claim_id: claimId, snippet_id: snippetId, role })
        .select('id, claim_id, snippet_id, role')
        .single();

      if (insertErr) {
        const msg = insertErr.message.includes('unique')
          ? 'This snippet is already linked to that claim.'
          : insertErr.message;
        setClaimLinkError(msg);
        setError(msg);
        return;
      }

      if (data) {
        setClaimLinks((prev) => [...prev, data as ClaimSnippetLink]);
      }
      setLinkingClaimSnippetId(null);
    } finally {
      setLinkingClaim(false);
      setLinkingClaimTargetId(null);
    }
  }, [claimLinks, snippets]);

  const handleUnlinkClaim = useCallback(async (linkId: string) => {
    if (!supabase || !isSupabaseConfigured()) return;
    setLinkingClaim(true);
    setClaimLinkError(null);
    setError(null);
    try {
      const { error: delErr } = await supabase.from('claim_snippets').delete().eq('id', linkId);
      if (delErr) {
        setClaimLinkError(delErr.message);
        setError(delErr.message);
        return;
      }
      setClaimLinks((prev) => prev.filter((l) => l.id !== linkId));
    } finally {
      setLinkingClaim(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!canEditSnippets || !supabase || !isSupabaseConfigured()) return;
    const confirmed = window.confirm('Delete this snippet?');
    if (!confirmed) return;
    const { error: deleteErr } = await supabase.from('snippets').delete().eq('id', id);
    if (deleteErr) {
      setError(deleteErr.message);
    } else {
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      setSelectedSnippetIds((prev) => prev.filter((x) => x !== id));
    }
  }, [canEditSnippets]);

  const setSnippetProcessed = useCallback(async (snippet: Snippet, usedInWriting: boolean) => {
    if (!supabase || !isSupabaseConfigured()) return;
    setError(null);
    setTogglingProcessedId(snippet.id);
    const { data, error: upErr } = await supabase
      .from('snippets')
      .update({
        used_in_writing: usedInWriting,
        updated_at: new Date().toISOString(),
      })
      .eq('id', snippet.id)
      .select('*')
      .single();
    setTogglingProcessedId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    if (data) {
      const updated = data as Snippet;
      setSnippets((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    }
  }, []);

  const toggleSnippetSelected = useCallback((snippetId: string) => {
    setSelectedSnippetIds((prev) =>
      prev.includes(snippetId) ? prev.filter((x) => x !== snippetId) : [...prev, snippetId]
    );
  }, []);

  const selectAllVisibleSnippets = useCallback(() => {
    setSelectedSnippetIds(filteredSnippets.map((s) => s.id));
  }, [filteredSnippets]);

  const clearSnippetSelection = useCallback(() => {
    setSelectedSnippetIds([]);
  }, []);

  const openPromptFlow = useCallback(() => {
    if (selectedSnippetIds.length === 0) return;
    setPromptClaim('');
    setPromptStrategy('paragraph');
    setBuiltPromptText('');
    setPromptStep('claim');
    setShowPromptModal(true);
  }, [selectedSnippetIds]);

  const goToPromptPreview = useCallback(() => {
    if (!promptClaim.trim()) return;
    const evidence = buildEvidenceBlock(selectedSnippetIds, snippetById, paperById);
    setBuiltPromptText(buildLiteratureReviewPrompt(promptClaim, evidence, promptStrategy));
    setPromptStep('preview');
  }, [promptClaim, selectedSnippetIds, snippetById, paperById, promptStrategy]);

  const copyBuiltPrompt = useCallback(async () => {
    if (!builtPromptText) return;
    try {
      await navigator.clipboard.writeText(builtPromptText);
      setPromptCopyFeedback(true);
      window.setTimeout(() => setPromptCopyFeedback(false), 2000);
    } catch {
      setError('Could not copy to clipboard.');
    }
  }, [builtPromptText]);

  const savePromptToDatabase = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured() || !builtPromptText.trim() || !promptClaim.trim()) return;
    setPromptSaving(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from('literature_review_prompts')
      .insert({
        claim: promptClaim.trim(),
        snippet_ids: selectedSnippetIds,
        prompt_text: builtPromptText.trim(),
        generated_paragraph: null,
      })
      .select('*')
      .single();
    setPromptSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    if (data) {
      setSavedPrompts((prev) => [data as LiteratureReviewPrompt, ...prev]);
    }
    setShowPromptModal(false);
    setPromptStep('claim');
    setPromptClaim('');
    setBuiltPromptText('');
  }, [builtPromptText, promptClaim, selectedSnippetIds]);

  const updateSavedParagraph = useCallback(async (rowId: string, paragraph: string) => {
    if (!supabase || !isSupabaseConfigured()) return;
    const { data, error: upErr } = await supabase
      .from('literature_review_prompts')
      .update({ generated_paragraph: paragraph.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', rowId)
      .select('*')
      .single();
    if (upErr) {
      setError(upErr.message);
      return;
    }
    if (data) {
      setSavedPrompts((prev) => prev.map((r) => (r.id === rowId ? (data as LiteratureReviewPrompt) : r)));
    }
  }, []);

  const deleteSavedPrompt = useCallback(async (rowId: string) => {
    if (!supabase || !isSupabaseConfigured()) return;
    if (!window.confirm('Delete this saved prompt record?')) return;
    const { error: delErr } = await supabase.from('literature_review_prompts').delete().eq('id', rowId);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setSavedPrompts((prev) => prev.filter((r) => r.id !== rowId));
  }, []);

  const startEdit = useCallback((snippet: Snippet) => {
    setEditingId(snippet.id);
    setEditContent(snippet.content);
    setEditConstructId(getSnippetConstructIds(snippet).join(','));
    setEditModelId(getSnippetModelIds(snippet).join(','));
    setEditPageNumber(snippet.page_number != null ? String(snippet.page_number) : '');
    setEditTagsInput(Array.isArray(snippet.tags) ? snippet.tags.join(', ') : '');
    setEditSnippetType(canonicalSnippetType((snippet as any).snippet_type));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent('');
    setEditConstructId('');
    setEditModelId('');
    setEditPageNumber('');
    setEditTagsInput('');
    setEditSnippetType('');
  }, []);

  const toggleSnippetExpanded = useCallback((snippetId: string) => {
    setExpandedSnippetIds((prev) =>
      prev.includes(snippetId) ? prev.filter((id) => id !== snippetId) : [...prev, snippetId]
    );
  }, []);

  const handleSaveEdit = useCallback(
    async (snippet: Snippet) => {
      if (!canEditSnippets || !supabase || !isSupabaseConfigured()) return;
      if (!normaliseSnippetContent(editContent)) return;
      const pageNum = editPageNumber.trim() ? parseInt(editPageNumber, 10) : null;

      const constructIds = editConstructId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const modelIds = editModelId
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const rawTags = editTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const existingByLower = allTags.reduce<Record<string, string>>((acc, t) => {
        acc[t.toLowerCase()] = t;
        return acc;
      }, {});
      const tags: string[] = [];
      for (const t of rawTags) {
        const key = t.toLowerCase();
        const canonical = existingByLower[key] ?? t;
        if (!tags.some((x) => x.toLowerCase() === canonical.toLowerCase())) {
          tags.push(canonical);
        }
      }
      const { data, error: updateErr } = await supabase
        .from('snippets')
        .update({
          content: normaliseSnippetContent(editContent),
          construct_id: constructIds[0] ?? null,
          model_id: modelIds[0] ?? null,
          construct_ids: constructIds,
          model_ids: modelIds,
          page_number: pageNum != null && !Number.isNaN(pageNum) ? pageNum : null,
          snippet_type: canonicalSnippetType(editSnippetType) || null,
          tags,
        })
        .eq('id', snippet.id)
        .select('*')
        .single();
      if (updateErr) {
        setError(updateErr.message);
      } else if (data) {
        const updated = data as Snippet;
        setSnippets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        void syncSnippetEmbedding(updated.id, updated.content);
        if (Array.isArray(updated.tags)) {
          setAllTags((prev) => {
            const set = new Set(prev);
            for (const t of updated.tags) {
              if (t && typeof t === 'string') set.add(t);
            }
            return Array.from(set);
          });
        }
        cancelEdit();
      }
    },
    [canEditSnippets, editContent, editConstructId, editModelId, editPageNumber, editTagsInput, editSnippetType, allTags, cancelEdit, syncSnippetEmbedding]
  );

  if (loading || permLoading) {
    return (
      <div className="snippets-page">
        <p className="snippets-loading">Loading snippets…</p>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="snippets-page">
        <p className="snippets-error">
          Supabase is not configured. Set <code>PUBLIC_SUPABASE_URL</code> and{' '}
          <code>PUBLIC_SUPABASE_ANON_KEY</code> in your environment or <code>.env</code> file.
        </p>
      </div>
    );
  }

  if (!canViewSnippets) {
    return (
      <AccessDenied message="Your role cannot view snippets." permission="nav.literature.snippets" />
    );
  }

  return (
    <div className="snippets-page">
      {!canEditSnippets && (
        <p className="snippets-error" role="status" style={{ background: '#eef4fa', color: '#1e3a5f', borderColor: '#b7d0e8' }}>
          View-only: your role cannot add or edit snippets.
        </p>
      )}
      <header className="snippets-header">
        <h1>Snippets</h1>
        <p className="snippets-intro">
          Conceptual snippets extracted from papers. Filter by paper, construct, model, or tags.
        </p>
        {canEditSnippets ? (
        <div className="snippets-header-actions">
          <button
            type="button"
            className={`snippets-prompt-mode-btn${promptMode ? ' snippets-prompt-mode-btn-active' : ''}`}
            onClick={() => {
              setPromptMode((m) => {
                if (m) setSelectedSnippetIds([]);
                return !m;
              });
            }}
            aria-pressed={promptMode}
          >
            Prompt generation mode
          </button>
          {promptMode && (
            <button
              type="button"
              className="snippets-generate-prompt-btn"
              disabled={selectedSnippetIds.length === 0}
              onClick={openPromptFlow}
            >
              Generate prompt
            </button>
          )}
          <button
            type="button"
            className="snippets-open-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            Add snippet
          </button>
        </div>
        ) : null}
        <div className="snippets-top-tabs" role="tablist" aria-label="Snippets sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'snippets'}
            className={`snippets-top-tab${activeTab === 'snippets' ? ' snippets-top-tab-active' : ''}`}
            onClick={() => setActiveTab('snippets')}
          >
            Snippets ({filteredSnippets.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'saved-prompts'}
            className={`snippets-top-tab${activeTab === 'saved-prompts' ? ' snippets-top-tab-active' : ''}`}
            onClick={() => setActiveTab('saved-prompts')}
          >
            Saved prompts ({savedPrompts.length})
          </button>
        </div>
        {!localEmbeddingsAvailable && (
          <p className="snippets-semantic-local-note">
            Semantic search is disabled on deployed sites. Use localhost with Ollama to run semantic mode.
          </p>
        )}
      </header>

      {error && <p className="snippets-error">{error}</p>}

      <div className="snippets-layout">
        {activeTab === 'snippets' && (
          <>
        {promptMode && (
          <div className="snippets-prompt-toolbar" role="region" aria-label="Prompt generation selection">
            <span className="snippets-prompt-count">
              {selectedSnippetIds.length} snippet{selectedSnippetIds.length === 1 ? '' : 's'} selected
            </span>
            <button type="button" className="snippets-prompt-toolbar-btn" onClick={selectAllVisibleSnippets}>
              Select all in view
            </button>
            <button type="button" className="snippets-prompt-toolbar-btn" onClick={clearSnippetSelection}>
              Clear selection
            </button>
          </div>
        )}
        {targetClaim && (
          <div className="snippets-claim-target-banner" role="status">
            Linking snippets to claim:{' '}
            <strong>{targetClaim.title.trim() || targetClaim.claim_text.slice(0, 80)}</strong>
            {' · '}
            <a href={`${base}claims/detail/?id=${encodeURIComponent(targetClaim.id)}`}>View claim</a>
          </div>
        )}

        <section className="snippets-top-filters" aria-label="Primary snippet filters">
          <div className="snippets-top-filters-main">
            <div className="snippets-filter-field snippets-top-search">
              <div className="snippets-filter-label-row">
                <label htmlFor="snippets-search-input" className="snippets-filter-label">
                  Search
                </label>
                <div className="snippets-search-mode" role="group" aria-label="Search mode">
                  <button
                    type="button"
                    className={`snippets-search-mode-btn${searchMode === 'keyword' ? ' snippets-search-mode-btn-active' : ''}`}
                    onClick={() => setSearchMode('keyword')}
                  >
                    Keyword
                  </button>
                  <button
                    type="button"
                    className={`snippets-search-mode-btn${searchMode === 'semantic' ? ' snippets-search-mode-btn-active' : ''}`}
                    onClick={() => {
                      if (!localEmbeddingsAvailable) return;
                      setSearchMode('semantic');
                    }}
                    disabled={!localEmbeddingsAvailable}
                    title={
                      localEmbeddingsAvailable
                        ? 'Search by meaning using local embeddings'
                        : 'Semantic mode is available only on localhost'
                    }
                  >
                    Semantic
                  </button>
                </div>
              </div>
              <input
                id="snippets-search-input"
                type="search"
                className="snippets-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  searchMode === 'semantic'
                    ? 'Search by meaning…'
                    : 'Search text, tags, constructs…'
                }
              />
            </div>
            <div className="snippets-filter-field snippets-top-status">
              <label htmlFor="snippets-filter-processed" className="snippets-filter-label">
                Writing status
              </label>
              <select
                id="snippets-filter-processed"
                className="snippets-input"
                value={filterProcessed}
                onChange={(e) => setFilterProcessed(e.target.value as FilterProcessed)}
              >
                <option value="">All ({snippets.length})</option>
                <option value="processed">Processed ({processedSnippetCount})</option>
                <option value="unprocessed">Not processed ({unprocessedSnippetCount})</option>
              </select>
            </div>
            <div className="snippets-filter-field snippets-top-date">
              <label htmlFor="snippets-filter-created" className="snippets-filter-label">
                Created on or after
              </label>
              <input
                id="snippets-filter-created"
                type="date"
                className="snippets-input"
                value={filterCreatedAfter}
                onChange={(e) => setFilterCreatedAfter(e.target.value)}
              />
            </div>
            <div className="snippets-top-filters-actions">
              {activeFilterCount > 0 && (
                <span className="snippets-filters-count" aria-label={`${activeFilterCount} active filters`}>
                  {activeFilterCount}
                </span>
              )}
              <button
                type="button"
                className="snippets-clear-btn"
                onClick={clearAllFilters}
                disabled={activeFilterCount === 0}
                title="Clear all filters"
              >
                Clear
              </button>
            </div>
          </div>
          {searchMode === 'semantic' && (
            <div className="snippets-top-semantic">
              <div className="snippets-semantic-controls">
                <label className="snippets-semantic-control">
                  <span className="snippets-semantic-control-label">
                    Similarity
                    <span
                      className="snippets-help-tip"
                      title="Higher threshold = stricter matching (fewer, more focused results). Lower threshold = broader matching (more, less precise results)."
                      aria-label="Semantic threshold help"
                    >
                      ?
                    </span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    className="snippets-input snippets-semantic-input"
                    value={semanticMinSimilarity}
                    onChange={(e) =>
                      setSemanticMinSimilarity(Math.min(1, Math.max(0, Number(e.target.value) || 0)))
                    }
                  />
                </label>
                <label className="snippets-semantic-control">
                  <span className="snippets-semantic-control-label">
                    Max candidates
                    <span
                      className="snippets-help-tip"
                      title="How many top semantic matches to consider before applying your other filters."
                      aria-label="Max candidates help"
                    >
                      ?
                    </span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    className="snippets-input snippets-semantic-input"
                    value={semanticMatchCount}
                    onChange={(e) =>
                      setSemanticMatchCount(Math.min(200, Math.max(1, Number(e.target.value) || 1)))
                    }
                  />
                </label>
              </div>
              <p className="snippets-semantic-note">
                Uses local embeddings (Ollama on localhost).
                {semanticSearchLoading ? ' Searching…' : ''}
                {!semanticSearchLoading && semanticSearchError ? ` ${semanticSearchError}` : ''}
              </p>
            </div>
          )}
        </section>

        <aside className="snippets-filters" aria-label="Facet filters">
          <div className="snippets-filters-header">
            <h2 className="snippets-filters-title">Facets</h2>
          </div>
          <div className="snippets-filters-body">
            <div className="snippets-filter-field">
              <label htmlFor="snippets-filter-paper" className="snippets-filter-label">
                Paper
              </label>
              <select
                id="snippets-filter-paper"
                className="snippets-input"
                value={filterPaperId}
                onChange={(e) => setFilterPaperId(e.target.value)}
              >
                <option value="">All papers</option>
                {papersSortedAlphabetically.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || p.url}
                  </option>
                ))}
              </select>
            </div>
            <div className="snippets-filter-field">
              <div className="snippets-filter-label-row">
                <label htmlFor="snippets-filter-models" className="snippets-filter-label">
                  Models
                </label>
                {filterModelIds.length > 0 && (
                  <span className="snippets-filter-selected">{filterModelIds.length} selected</span>
                )}
              </div>
              <select
                id="snippets-filter-models"
                multiple
                size={Math.min(8, Math.max(4, modelOptionsAlphabetical.length))}
                className="snippets-input snippets-facet-select snippets-model-select"
                value={filterModelIds}
                onChange={(e) =>
                  setFilterModelIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))
                }
              >
                {modelOptionsAlphabetical.map((m) => (
                  <option key={m.id} value={m.id}>
                    {(m.abbreviation || m.name)} ({modelSnippetCounts.get(m.id) ?? 0})
                  </option>
                ))}
              </select>
            </div>
            <div className="snippets-filter-field">
              <label htmlFor="snippets-filter-umbrella" className="snippets-filter-label">
                Umbrella construct
              </label>
              <select
                id="snippets-filter-umbrella"
                className="snippets-input"
                value={filterUmbrellaConstructId}
                onChange={(e) => setFilterUmbrellaConstructId(e.target.value)}
              >
                <option value="">All</option>
                {umbrellaConstructs.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="snippets-filter-field">
              <div className="snippets-filter-label-row">
                <label htmlFor="snippets-filter-constructs" className="snippets-filter-label">
                  Constructs
                </label>
                {filterConstructIds.length > 0 && (
                  <span className="snippets-filter-selected">{filterConstructIds.length} selected</span>
                )}
              </div>
              <select
                id="snippets-filter-constructs"
                multiple
                size={Math.max(5, Math.min(10, constructOptions.length))}
                className="snippets-input snippets-facet-select snippets-construct-select"
                value={filterConstructIds}
                onChange={(e) =>
                  setFilterConstructIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))
                }
              >
                {constructOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({constructSnippetCounts.get(c.id) ?? 0})
                  </option>
                ))}
              </select>
            </div>
            <div className="snippets-filter-field">
              <div className="snippets-filter-label-row">
                <label htmlFor="snippets-filter-journals" className="snippets-filter-label">
                  Journals
                </label>
                {filterJournalNames.length > 0 && (
                  <span className="snippets-filter-selected">{filterJournalNames.length} selected</span>
                )}
              </div>
              <select
                id="snippets-filter-journals"
                multiple
                size={Math.max(4, Math.min(6, allJournals.length || 1))}
                className="snippets-input snippets-facet-select snippets-journal-select"
                value={filterJournalNames}
                onChange={(e) =>
                  setFilterJournalNames(Array.from(e.target.selectedOptions).map((opt) => opt.value))
                }
              >
                {allJournals.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
            <div className="snippets-filter-field">
              <label htmlFor="snippets-filter-type" className="snippets-filter-label">
                Snippet type
              </label>
              <select
                id="snippets-filter-type"
                className="snippets-input snippets-snippet-type-select"
                value={filterSnippetType}
                onChange={(e) => setFilterSnippetType(e.target.value)}
              >
                <option value="">All types</option>
                {SNIPPET_TYPE_OPTIONS.filter((o) => o.value).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({snippetTypeCounts.get(opt.value) ?? 0})
                  </option>
                ))}
              </select>
            </div>
            <div className="snippets-filter-field">
              <label htmlFor="snippets-filter-tag" className="snippets-filter-label">
                Tag
              </label>
              <select
                id="snippets-filter-tag"
                className="snippets-input"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>

      {showAddModal && (
        <div className="snippets-modal-overlay" role="dialog" aria-modal="true">
          <div className="snippets-modal">
            <header className="snippets-modal-header">
              <h2 className="snippets-section-title">Add snippet</h2>
              <button
                type="button"
                className="snippets-modal-close"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <form className="snippets-form" onSubmit={handleAddSnippet}>
              <label className="snippets-label">
                Paper
                <select
                  className="snippets-input"
                  value={newPaperId}
                  onChange={(e) => setNewPaperId(e.target.value)}
                  required
                >
                  <option value="">Select a paper…</option>
                  {papersSortedAlphabetically.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.url}
                    </option>
                  ))}
                </select>
              </label>
              <label className="snippets-label">
                Snippet text
                <textarea
                  className="snippets-textarea"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={3}
                  placeholder="Paste or type the key idea, quote, or conceptual snippet…"
                  required
                />
              </label>
              <div className="snippets-form-row">
                <label className="snippets-label-inline">
                  Construct(s)
                  <select
                    multiple
                    className="snippets-input-inline"
                    value={newConstructId ? newConstructId.split(',') : []}
                    onChange={(e) =>
                      setNewConstructId(
                        Array.from(e.target.selectedOptions)
                          .map((opt) => opt.value)
                          .join(',')
                      )
                    }
                  >
                    {constructOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="snippets-label-inline">
                  Model(s)
                  <select
                    multiple
                    className="snippets-input-inline"
                    value={newModelId ? newModelId.split(',') : []}
                    onChange={(e) =>
                      setNewModelId(
                        Array.from(e.target.selectedOptions)
                          .map((opt) => opt.value)
                          .join(',')
                      )
                    }
                  >
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.abbreviation || m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="snippets-label-inline">
                  Page (optional)
                  <input
                    type="number"
                    min={1}
                    className="snippets-input-inline snippets-input-page"
                    value={newPageNumber}
                    onChange={(e) => setNewPageNumber(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </label>
                <label className="snippets-label-inline">
                  Tags (optional)
                  <input
                    type="text"
                    list="snippets-tags-list"
                    className="snippets-input-inline"
                    value={newTagsInput}
                    onChange={(e) => setNewTagsInput(e.target.value)}
                    placeholder="e.g. method, theory"
                  />
                </label>
                <label className="snippets-label-inline">
                  Snippet type
                  <select
                    className="snippets-input-inline"
                    value={newSnippetType}
                    onChange={(e) => setNewSnippetType(e.target.value)}
                  >
                    {SNIPPET_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <datalist id="snippets-tags-list">
                {allTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <div className="snippets-modal-actions">
                <button type="submit" className="snippets-add-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Add snippet'}
                </button>
                <button
                  type="button"
                  className="snippets-edit-cancel-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        <section className="snippets-list-section">
        <div className="snippets-list-section-head">
          <h2 className="snippets-section-title">
            Snippets ({filteredSnippets.length})
          </h2>
          {filteredSnippets.length > 0 && (
            <>
              <button
                type="button"
                className="snippets-export-txt-btn"
                onClick={exportFilteredSnippetsTxt}
                title="Download filtered snippets as plain text (content + author/year/page only)"
              >
                Export .txt
              </button>
              <button
                type="button"
                className="snippets-expand-all-btn"
                disabled={truncatableSnippets.length === 0}
                onClick={toggleExpandAllTruncatable}
              title={
                truncatableSnippets.length === 0
                  ? 'No truncatable snippets in the current list (all are short)'
                  : allTruncatableExpanded
                    ? 'Collapse full text for every truncatable snippet in the list'
                    : 'Show full text for every truncatable snippet in the list'
              }
            >
              {allTruncatableExpanded ? '▲ Less (all)' : '▼ More (all)'}
            </button>
            </>
          )}
        </div>
        {filteredSnippets.length === 0 && (
          <p className="snippets-empty">No snippets match the current filters.</p>
        )}
        <div className="snippets-list">
          {filteredSnippets.map((s) => {
            const paper = paperById.get(s.paper_id);
            const paperYear = formatPaperYear(paper?.year);
            const canExpand = s.content.length > SNIPPET_PREVIEW_LENGTH;
            const isExpanded = expandedSnippetIds.includes(s.id);
            const displayContent =
              canExpand && !isExpanded
                ? `${s.content.slice(0, SNIPPET_PREVIEW_LENGTH)}…`
                : s.content;
            const used = isSnippetUsedInWriting(s);
            const toggling = togglingProcessedId === s.id;
            const linkedContribution = s.contribution_id
              ? contributionById.get(s.contribution_id)
              : undefined;
            const snippetClaimLinks = claimLinksBySnippetId.get(s.id) ?? [];
            const showContributionPicker = linkingSnippetId === s.id;
            const showClaimPicker = linkingClaimSnippetId === s.id;
            return (
              <article
                id={`snippet-${s.id}`}
                key={s.id}
                className={`snippets-card${promptMode ? ' snippets-card-selectable' : ''}${
                  used ? ' snippets-card--used' : ''
                }`}
              >
                <header className="snippets-card-header">
                  {promptMode && (
                    <label className="snippets-card-checkbox-wrap">
                      <input
                        type="checkbox"
                        checked={selectedSnippetIds.includes(s.id)}
                        onChange={() => toggleSnippetSelected(s.id)}
                        aria-label="Select snippet for prompt"
                      />
                    </label>
                  )}
                  <div className="snippets-card-title-row">
                    <h3 className="snippets-card-title">
                      {displayContent}
                    </h3>
                    {canExpand && (
                      <button
                        type="button"
                        className="snippets-card-toggle"
                        onClick={() => toggleSnippetExpanded(s.id)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? '▲ Less' : '▼ More'}
                      </button>
                    )}
                  </div>
                  <div className="snippets-card-badges">
                    {canonicalSnippetType((s as any).snippet_type) && (
                      <span className="snippets-card-type">
                        {snippetTypeLabel((s as any).snippet_type)}
                      </span>
                    )}
                    {used && <span className="snippets-card-used-badge">Processed</span>}
                    {linkedContribution && (
                      <a
                        href={`${base}research-questions/contribution/#contribution-${linkedContribution.id}`}
                        className="snippets-card-contribution-badge"
                      >
                        {linkedContribution.contribution_type
                          ? CONTRIBUTION_TYPE_LABELS[linkedContribution.contribution_type]
                          : 'Contribution'}
                      </a>
                    )}
                    {snippetClaimLinks.map((link) => {
                      const claim = claimById.get(link.claim_id);
                      const label = claim?.title.trim() || claim?.claim_text.slice(0, 40) || 'Claim';
                      return (
                        <a
                          key={link.id}
                          href={`${base}claims/detail/?id=${encodeURIComponent(link.claim_id)}`}
                          className="snippets-card-claim-badge"
                          title={claim?.claim_text}
                        >
                          {label}
                        </a>
                      );
                    })}
                  </div>
                  <div className="snippets-card-links">
                    {(() => {
                      const constructIds = getSnippetConstructIds(s);
                      return constructIds.map((id) => {
                        const c = constructOptions.find((opt) => opt.id === id);
                        return (
                          <a
                            key={id}
                            href={`${base}constructs/${id}/`}
                            className="snippets-chip snippets-chip-construct"
                          >
                            {c?.name || id}
                          </a>
                        );
                      });
                    })()}
                    {(() => {
                      const modelIds = getSnippetModelIds(s);
                      return modelIds.map((id) => {
                        const cid = canonicalModelId(id);
                        const m = modelOptions.find((opt) => opt.id === cid);
                        return (
                          <a
                            key={id}
                            href={`${base}models/${cid}/`}
                            className="snippets-chip snippets-chip-model"
                            title={m?.name || cid}
                          >
                            {m?.abbreviation || m?.name || cid}
                          </a>
                        );
                      });
                    })()}
                  </div>
                </header>
                {editingId === s.id ? (
                  <div className="snippets-edit-form">
                    <label className="snippets-label">
                      Snippet text
                      <textarea
                        className="snippets-textarea"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                      />
                    </label>
                    <div className="snippets-form-row">
                    <label className="snippets-label-inline">
                      Construct(s)
                      <select
                        multiple
                        className="snippets-input-inline"
                        value={editConstructId ? editConstructId.split(',') : []}
                        onChange={(e) =>
                          setEditConstructId(
                            Array.from(e.target.selectedOptions)
                              .map((opt) => opt.value)
                              .join(',')
                          )
                        }
                      >
                        {constructOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="snippets-label-inline">
                      Model(s)
                      <select
                        multiple
                        className="snippets-input-inline"
                        value={editModelId ? editModelId.split(',') : []}
                        onChange={(e) =>
                          setEditModelId(
                            Array.from(e.target.selectedOptions)
                              .map((opt) => opt.value)
                              .join(',')
                          )
                        }
                      >
                        {modelOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.abbreviation || m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                      <label className="snippets-label-inline">
                        Page
                        <input
                          type="number"
                          min={1}
                          className="snippets-input-inline snippets-input-page"
                          value={editPageNumber}
                          onChange={(e) => setEditPageNumber(e.target.value)}
                          placeholder="e.g. 12"
                        />
                      </label>
                      <label className="snippets-label-inline">
                        Tags
                        <input
                          type="text"
                          list="snippets-tags-list"
                          className="snippets-input-inline"
                          value={editTagsInput}
                          onChange={(e) => setEditTagsInput(e.target.value)}
                          placeholder="e.g. method, theory"
                        />
                      </label>
                      <label className="snippets-label-inline">
                        Snippet type
                        <select
                          className="snippets-input-inline"
                          value={editSnippetType}
                          onChange={(e) => setEditSnippetType(e.target.value)}
                        >
                          {SNIPPET_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value || 'none'} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="snippets-card-footer">
                      <span className="snippets-card-date">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                      <div className="snippets-card-actions">
                        {used ? (
                          <button
                            type="button"
                            className="snippets-processed-btn snippets-processed-btn--unmark"
                            disabled={toggling}
                            onClick={() => setSnippetProcessed(s, false)}
                          >
                            {toggling ? '…' : 'Unmark processed'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="snippets-processed-btn"
                            disabled={toggling}
                            onClick={() => setSnippetProcessed(s, true)}
                          >
                            {toggling ? '…' : 'Mark processed'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="snippets-edit-save-btn"
                          onClick={() => handleSaveEdit(s)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="snippets-edit-cancel-btn"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="snippets-card-content">
                      {paper ? (
                        <a
                          href={paperDetailUrl(paper.id, base)}
                          className="snippets-card-paper"
                        >
                          {paper.title || paper.url}
                        </a>
                      ) : (
                        <span className="snippets-card-paper">Unknown paper</span>
                      )}
                      {paperYear && editingId !== s.id && (
                        <span className="snippets-card-year-inline"> · {paperYear}</span>
                      )}
                      {s.page_number != null && editingId !== s.id && (
                        <span className="snippets-card-page-inline"> · Page {s.page_number}</span>
                      )}
                      {paper?.journal?.trim() && editingId !== s.id && (
                        <span className="snippets-card-journal"> · {paper.journal.trim()}</span>
                      )}
                    </p>
                    {Array.isArray(s.tags) && s.tags.length > 0 && (
                      <div className="snippets-card-tags">
                        {s.tags.map((tag) => (
                          <span key={tag} className="snippets-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <footer className="snippets-card-footer">
                      <span className="snippets-card-date">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                      <div className="snippets-card-actions">
                        {used ? (
                          <button
                            type="button"
                            className="snippets-processed-btn snippets-processed-btn--unmark"
                            disabled={toggling}
                            onClick={() => setSnippetProcessed(s, false)}
                          >
                            {toggling ? '…' : 'Unmark processed'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="snippets-processed-btn"
                            disabled={toggling}
                            onClick={() => setSnippetProcessed(s, true)}
                          >
                            {toggling ? '…' : 'Mark processed'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="snippets-link-contribution-btn"
                          onClick={() => {
                            setContributionLinkError(null);
                            setClaimLinkError(null);
                            setLinkingClaimSnippetId(null);
                            setLinkingSnippetId(showContributionPicker ? null : s.id);
                          }}
                        >
                          {linkedContribution ? 'Change contribution' : 'Link to contribution'}
                        </button>
                        <button
                          type="button"
                          className="snippets-link-claim-btn"
                          onClick={() => {
                            setContributionLinkError(null);
                            setClaimLinkError(null);
                            setLinkingSnippetId(null);
                            setLinkingClaimSnippetId(showClaimPicker ? null : s.id);
                          }}
                        >
                          {snippetClaimLinks.length > 0 ? 'Link another claim' : 'Link to claim'}
                        </button>
                        {canEditSnippets && (
                        <button
                          type="button"
                          className="snippets-edit-btn"
                          onClick={() => startEdit(s)}
                        >
                          Edit
                        </button>
                        )}
                        {canEditSnippets && (
                        <button
                          type="button"
                          className="snippets-delete-btn"
                          onClick={() => handleDelete(s.id)}
                        >
                          Delete
                        </button>
                        )}
                      </div>
                    </footer>
                    {showContributionPicker && (
                      <div className="snippets-contribution-picker">
                        {contributionLinkError && (
                          <p className="snippets-contribution-picker-error" role="alert">
                            {contributionLinkError}
                          </p>
                        )}
                        {contributions.length === 0 ? (
                          <p className="snippets-contribution-picker-empty">
                            No contributions yet. Add one on the Contribution page first.
                          </p>
                        ) : (
                          <ul className="snippets-contribution-picker-list">
                            {contributions.map((contribution) => {
                              const isLinkingThis =
                                linkingContribution &&
                                linkingContributionTargetId === contribution.id;
                              return (
                              <li key={contribution.id}>
                                <button
                                  type="button"
                                  className={`snippets-contribution-picker-item${
                                    s.contribution_id === contribution.id
                                      ? ' snippets-contribution-picker-item--active'
                                      : ''
                                  }`}
                                  disabled={linkingContribution}
                                  onClick={() => handleLinkContribution(s.id, contribution.id)}
                                >
                                  <span className="snippets-contribution-picker-type">
                                    {contribution.contribution_type
                                      ? CONTRIBUTION_TYPE_LABELS[contribution.contribution_type]
                                      : 'Contribution'}
                                  </span>
                                  <span className="snippets-contribution-picker-text">
                                    <FormatDiaryText text={contribution.content} />
                                  </span>
                                  {isLinkingThis && (
                                    <span className="snippets-contribution-picker-saving">Linking…</span>
                                  )}
                                </button>
                              </li>
                            );
                            })}
                          </ul>
                        )}
                        {s.contribution_id && (
                          <button
                            type="button"
                            className="snippets-contribution-unlink"
                            disabled={linkingContribution}
                            onClick={() => handleLinkContribution(s.id, null)}
                          >
                            Unlink contribution
                          </button>
                        )}
                        <button
                          type="button"
                          className="snippets-contribution-picker-cancel"
                          onClick={() => setLinkingSnippetId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {showClaimPicker && (
                      <div className="snippets-contribution-picker snippets-claim-picker">
                        {claimLinkError && (
                          <p className="snippets-contribution-picker-error" role="alert">
                            {claimLinkError}
                          </p>
                        )}
                        {claims.length === 0 ? (
                          <p className="snippets-contribution-picker-empty">
                            No claims yet.{' '}
                            <a href={`${base}claims/manual/`}>Write a claim</a> first.
                          </p>
                        ) : (
                          <ul className="snippets-contribution-picker-list">
                            {claims.map((claim) => {
                              const alreadyLinked = snippetClaimLinks.some((l) => l.claim_id === claim.id);
                              const isLinkingThis = linkingClaim && linkingClaimTargetId === claim.id;
                              const isTarget = targetClaimId === claim.id;
                              return (
                                <li key={claim.id}>
                                  <button
                                    type="button"
                                    className={`snippets-contribution-picker-item${
                                      alreadyLinked ? ' snippets-contribution-picker-item--active' : ''
                                    }${isTarget ? ' snippets-claim-picker-item--target' : ''}`}
                                    disabled={linkingClaim || alreadyLinked}
                                    onClick={() => void handleLinkClaim(s.id, claim.id)}
                                  >
                                    <span className="snippets-contribution-picker-type">
                                      {claim.title.trim() || 'Untitled claim'}
                                    </span>
                                    <span className="snippets-contribution-picker-text">
                                      {claim.claim_text}
                                    </span>
                                    {alreadyLinked && (
                                      <span className="snippets-contribution-picker-saving">Already linked</span>
                                    )}
                                    {isLinkingThis && (
                                      <span className="snippets-contribution-picker-saving">Linking…</span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {snippetClaimLinks.length > 0 && (
                          <ul className="snippets-claim-unlink-list">
                            {snippetClaimLinks.map((link) => {
                              const claim = claimById.get(link.claim_id);
                              return (
                                <li key={link.id}>
                                  <span>{claim?.title.trim() || 'Claim'}</span>
                                  <button
                                    type="button"
                                    className="snippets-contribution-unlink"
                                    disabled={linkingClaim}
                                    onClick={() => void handleUnlinkClaim(link.id)}
                                  >
                                    Unlink
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <button
                          type="button"
                          className="snippets-contribution-picker-cancel"
                          onClick={() => setLinkingClaimSnippetId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
          </>
        )}

      {activeTab === 'saved-prompts' && (
      <section className="snippets-saved-prompts" aria-labelledby="saved-prompts-heading">
        <h2 id="saved-prompts-heading" className="snippets-section-title">
          Saved literature review prompts
        </h2>
        <p className="snippets-saved-intro">
          Each record stores your <strong>claim</strong>, the <strong>linked snippets</strong>, and the full prompt. Paste the
          paragraph returned by your external AI tool below.
        </p>
        {savedPromptsLoading ? (
          <p className="snippets-saved-loading">Loading saved prompts…</p>
        ) : savedPrompts.length === 0 ? (
          <p className="snippets-saved-empty">No saved prompts yet. Use Prompt generation mode, select snippets, generate
            the prompt, copy it to an external chat, then save the record and paste your paragraph here.</p>
        ) : (
          <ul className="snippets-saved-list">
            {savedPrompts.map((row) => (
              <li key={row.id} className="snippets-saved-card">
                <div className="snippets-saved-card-head">
                  <p className="snippets-saved-claim">{row.claim}</p>
                  <p className="snippets-saved-meta">
                    {row.snippet_ids.length} snippet{row.snippet_ids.length === 1 ? '' : 's'} ·{' '}
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
                <details className="snippets-saved-details">
                  <summary>Linked snippets</summary>
                  <ol className="snippets-saved-snippet-list">
                    {row.snippet_ids.map((sid) => {
                      const sn = snippetById.get(sid);
                      return (
                        <li key={sid}>
                          {sn ? (
                            <>
                              <span className="snippets-saved-snippet-text">{sn.content}</span>
                              {paperById.get(sn.paper_id)?.title && (
                                <span className="snippets-saved-snippet-paper">
                                  {' '}
                                  — {paperById.get(sn.paper_id)?.title}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="snippets-saved-snippet-missing">Snippet {sid} (removed or unavailable)</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </details>
                <details className="snippets-saved-details">
                  <summary>Full prompt text</summary>
                  <pre className="snippets-saved-prompt-pre">{row.prompt_text}</pre>
                </details>
                <label className="snippets-saved-label">
                  Generated paragraph (from external AI)
                  <textarea
                    key={`${row.id}-${row.updated_at}`}
                    className="snippets-saved-textarea"
                    rows={5}
                    defaultValue={row.generated_paragraph ?? ''}
                    placeholder="Paste the paragraph from your AI chat here…"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      const prev = (row.generated_paragraph ?? '').trim();
                      if (v !== prev) updateSavedParagraph(row.id, e.target.value);
                    }}
                  />
                </label>
                <div className="snippets-saved-card-actions">
                  <button type="button" className="snippets-saved-delete" onClick={() => deleteSavedPrompt(row.id)}>
                    Delete record
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
      </div>

      {showPromptModal && (
        <div className="snippets-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="prompt-modal-title">
          <div className="snippets-modal snippets-modal-wide">
            <header className="snippets-modal-header">
              <h2 id="prompt-modal-title" className="snippets-section-title">
                {promptStep === 'claim' ? 'Your claim' : 'Copy prompt for external AI'}
              </h2>
              <button
                type="button"
                className="snippets-modal-close"
                onClick={() => {
                  setShowPromptModal(false);
                  setPromptStep('claim');
                  setPromptClaim('');
                  setBuiltPromptText('');
                }}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            {promptStep === 'claim' ? (
              <div className="snippets-prompt-modal-body">
                <p className="snippets-prompt-hint">
                  {selectedSnippetIds.length} snippet{selectedSnippetIds.length === 1 ? '' : 's'} will be included as
                  evidence. Choose a prompt strategy and define the focus.
                </p>
                <label className="snippets-label-inline">
                  Prompt strategy
                  <select
                    className="snippets-input-inline"
                    value={promptStrategy}
                    onChange={(e) => setPromptStrategy(e.target.value as PromptStrategy)}
                  >
                    <option value="paragraph">Generate full paragraph</option>
                    <option value="analysis">
                      Structured analysis (bullet summary, argument map, compare findings, contradictions)
                    </option>
                  </select>
                </label>
                <label className="snippets-label">
                  {promptStrategy === 'paragraph' ? 'Claim' : 'Focus question'}
                  <textarea
                    className="snippets-textarea"
                    value={promptClaim}
                    onChange={(e) => setPromptClaim(e.target.value)}
                    rows={4}
                    placeholder={
                      promptStrategy === 'paragraph'
                        ? 'e.g., Perceived usefulness is the strongest predictor of adoption intention in enterprise settings…'
                        : 'e.g., What are the main drivers of continuance intention and where do findings disagree?'
                    }
                  />
                </label>
                <div className="snippets-modal-actions">
                  <button
                    type="button"
                    className="snippets-add-btn"
                    disabled={!promptClaim.trim()}
                    onClick={goToPromptPreview}
                  >
                    Build prompt
                  </button>
                  <button
                    type="button"
                    className="snippets-edit-cancel-btn"
                    onClick={() => {
                      setShowPromptModal(false);
                      setPromptClaim('');
                      setPromptStrategy('paragraph');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="snippets-prompt-modal-body">
                <p className="snippets-prompt-hint">
                  Copy this prompt into your external AI tool. When you receive the paragraph, save this record (below) and
                  paste the result into the <strong>Generated paragraph</strong> field in the saved list.
                </p>
                <textarea className="snippets-textarea snippets-prompt-output" readOnly value={builtPromptText} rows={18} />
                <div className="snippets-modal-actions">
                  <button type="button" className="snippets-add-btn" onClick={copyBuiltPrompt}>
                    {promptCopyFeedback ? 'Copied!' : 'Copy prompt'}
                  </button>
                  <button
                    type="button"
                    className="snippets-prompt-back-btn"
                    onClick={() => {
                      setPromptStep('claim');
                      setBuiltPromptText('');
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="snippets-generate-prompt-btn"
                    onClick={savePromptToDatabase}
                    disabled={promptSaving}
                  >
                    {promptSaving ? 'Saving…' : 'Save to PhD Manager'}
                  </button>
                  <button
                    type="button"
                    className="snippets-edit-cancel-btn"
                    onClick={() => {
                      setShowPromptModal(false);
                      setPromptStep('claim');
                      setPromptClaim('');
                      setPromptStrategy('paragraph');
                      setBuiltPromptText('');
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { uploadPaperCommentImage, removePaperCommentImage } from '../lib/paperCommentImage';
import { extractImageFileFromClipboard } from '../lib/clipboardImage';
import { PAPER_STATUSES, type PaperStatusId } from '../constants/paperStatuses';
import constructsData from '../data/constructs.json';
import modelsData from '../data/models.json';

interface SavedPaper {
  id: string;
  url: string;
  secondary_url: string | null;
  motivation: string | null;
  tags: string[];
  title: string | null;
  authors: string | null;
  year: string | null;
  journal: string | null;
  citations: number | null;
  status: string;
  golden: boolean;
  created_at: string;
}

interface Snippet {
  id: string;
  paper_id: string;
  construct_id: string | null;
  model_id: string | null;
  content: string;
  notes: string | null;
  tags: string[];
  page_number: number | null;
  created_at: string;
}

interface PaperSummary {
  id: string;
  paper_id: string;
  problem: string | null;
  claims: string | null;
  method: string | null;
  results: string | null;
  discussion: string | null;
  limitations: string | null;
  future_research: string | null;
  conclusion: string | null;
  abstract: string | null;
  key_claims: string | null;
  academic_constructs: string | null;
  introduction: string | null;
  methods: string | null;
  results_and_discussion: string | null;
  limitations_and_future_research: string | null;
  results_section: string | null;
  discussion_section: string | null;
  conclusion_section: string | null;
  limitations_section: string | null;
  future_research_section: string | null;
  created_at: string;
  updated_at: string;
}

interface PaperComment {
  id: string;
  paper_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

function mapRow(row: {
  id: string;
  url: string;
  secondary_url?: string | null;
  motivation: string | null;
  tags: string[] | null;
  title?: string | null;
  authors?: string | null;
  year?: string | null;
  journal?: string | null;
  citations?: number | null;
  status?: string | null;
  golden?: boolean | null;
  created_at: string;
}): SavedPaper {
  const status = row.status?.trim() && PAPER_STATUSES.some((s) => s.id === row.status) ? row.status! : 'Not read';
  return {
    id: row.id,
    url: row.url,
    secondary_url: row.secondary_url ?? null,
    motivation: row.motivation ?? null,
    tags: row.tags ?? [],
    title: row.title ?? null,
    authors: row.authors ?? null,
    year: row.year ?? null,
    journal: row.journal ?? null,
    citations: (() => {
      const c = row.citations;
      if (c === null || c === undefined) return null;
      const n = typeof c === 'number' ? c : parseInt(String(c), 10);
      return Number.isNaN(n) ? null : n;
    })(),
    status,
    golden: !!row.golden,
    created_at: row.created_at,
  };
}

/** Extract DOI from URL for APA 7 "https://doi.org/xxx" ending */
function extractDoi(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const m = url.trim().match(/doi\.org\/(10\.\S+)/i) || url.trim().match(/^(10\.\d+\/\S+)/);
  if (!m) return null;
  return m[1].replace(/#.*$/, '').trim();
}

/**
 * Format authors string into APA 7 style: "Author, A. A., & Author, B. B."
 * Handles "Last, F.; Last2, F." or "Last, F., Last2, F." or plain "Last, F."
 */
function formatAuthorsAPA7(authors: string | null | undefined): string {
  if (!authors || !authors.trim()) return '';
  const parts = authors
    .split(/[;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}, & ${parts[1]}`;
  return parts.slice(0, -1).join(', ') + ', & ' + parts[parts.length - 1];
}

/**
 * Generate APA 7 reference (simplified for journal/article or web source).
 * Format: Author(s). (Year). Title. URL or https://doi.org/xxx
 */
function buildAPA7Citation(paper: SavedPaper): string {
  const authors = formatAuthorsAPA7(paper.authors);
  const year = paper.year?.trim() || 'n.d.';
  const title = paper.title?.trim() || 'Untitled';
  const doi = extractDoi(paper.url);
  const urlPart = doi ? `https://doi.org/${doi}` : paper.url?.trim() || '';
  const end = urlPart ? (doi ? urlPart : `Retrieved from ${urlPart}`) : '';
  if (!authors && year === 'n.d.' && !title) return '';

  const authorPart = authors ? `${authors}. ` : '';
  const yearPart = `(${year}). `;
  const titlePart = `${title}. `;
  return (authorPart + yearPart + titlePart + (end ? end : '')).trim().replace(/\s+\.$/, '.');
}

const constructOptions = (constructsData as any[]).map((c) => ({
  id: c.id as string,
  name: (c.name as string) || (c.id as string),
}));

const modelOptions = (modelsData as any[]).map((m) => ({
  id: m.id as string,
  name: (m.name as string) || (m.id as string),
}));

function canonicalModelId(id: string): string {
  return id === 'ttf' ? 'tpc' : id;
}

export default function PaperDetailPage() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [paper, setPaper] = useState<SavedPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(false);
  const [snippetError, setSnippetError] = useState<string | null>(null);
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [newSnippetConstructId, setNewSnippetConstructId] = useState('');
  const [newSnippetModelId, setNewSnippetModelId] = useState('');
  const [newSnippetPageNumber, setNewSnippetPageNumber] = useState<string>('');
  const [newSnippetTagsInput, setNewSnippetTagsInput] = useState('');
  const [allSnippetTags, setAllSnippetTags] = useState<string[]>([]);
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [pasteSummary, setPasteSummary] = useState('');
  const [summaryAbstract, setSummaryAbstract] = useState('');
  const [summaryKeyClaims, setSummaryKeyClaims] = useState('');
  const [summaryAcademicConstructs, setSummaryAcademicConstructs] = useState('');
  const [summaryIntroduction, setSummaryIntroduction] = useState('');
  const [summaryMethods, setSummaryMethods] = useState('');
  const [summaryResultsAndDiscussion, setSummaryResultsAndDiscussion] = useState('');
  const [summaryConclusion, setSummaryConclusion] = useState('');
  const [summaryLimitationsAndFutureResearch, setSummaryLimitationsAndFutureResearch] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [comments, setComments] = useState<PaperComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentImagePreviewUrl, setCommentImagePreviewUrl] = useState<string | null>(null);
  const [commentFileInputKey, setCommentFileInputKey] = useState(0);
  const [commentSaving, setCommentSaving] = useState(false);

  useEffect(() => {
    if (!commentImageFile) {
      setCommentImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(commentImageFile);
    setCommentImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [commentImageFile]);

  const syncSummaryToEditor = useCallback((s: PaperSummary | null) => {
    setSummaryAbstract(s?.abstract ?? '');
    setSummaryKeyClaims(s?.key_claims ?? '');
    setSummaryAcademicConstructs(s?.academic_constructs ?? '');
    setSummaryIntroduction(s?.introduction ?? '');
    setSummaryMethods(s?.methods ?? '');
    setSummaryResultsAndDiscussion(
      s?.results_and_discussion ??
        [s?.results_section, s?.discussion_section].filter((x) => !!x && x.trim()).join('\n\n').trim()
    );
    setSummaryConclusion(s?.conclusion_section ?? '');
    setSummaryLimitationsAndFutureResearch(
      s?.limitations_and_future_research ??
        [s?.limitations_section, s?.future_research_section].filter((x) => !!x && x.trim()).join('\n\n').trim()
    );
  }, []);

  const parseStructuredSummary = useCallback((raw: string) => {
    const txt = (raw || '').replace(/\r\n/g, '\n');
    const headings = [
      { key: 'abstract', label: 'abstract' },
      { key: 'key_claims', label: 'key claims' },
      { key: 'academic_constructs', label: 'academic constructs' },
      { key: 'introduction', label: 'introduction' },
      { key: 'methods', label: 'methods' },
      { key: 'results_and_discussion', label: 'results and discussion' },
      { key: 'results_section', label: 'results' },
      { key: 'discussion_section', label: 'discussion' },
      { key: 'conclusion_section', label: 'conclusion' },
      { key: 'limitations_and_future_research', label: 'limitations and future research' },
      { key: 'limitations_section', label: 'limitations' },
      { key: 'future_research_section', label: 'future research' },
    ] as const;

    const normal = txt
      .replace(/^\s*#+\s*/gm, '') // strip markdown heading markers
      .trim();

    const positions: { idx: number; key: (typeof headings)[number]['key'] }[] = [];
    for (const h of headings) {
      const re = new RegExp(`(^|\\n)\\s*${h.label}\\s*:?\\s*(\\n|$)`, 'i');
      const m = re.exec('\n' + normal);
      if (m && typeof m.index === 'number') {
        positions.push({ idx: m.index, key: h.key });
      }
    }
    positions.sort((a, b) => a.idx - b.idx);
    if (positions.length === 0) return null;

    const out: Partial<Record<(typeof headings)[number]['key'], string>> = {};
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].idx;
      const end = i + 1 < positions.length ? positions[i + 1].idx : undefined;
      const chunk = ('\n' + normal).slice(start, end);
      const chunkLines = chunk.split('\n');
      chunkLines.shift(); // empty prefix
      chunkLines.shift(); // heading line
      const body = chunkLines.join('\n').trim();
      out[positions[i].key] = body;
    }
    if (!out.results_and_discussion) {
      out.results_and_discussion = [out.results_section, out.discussion_section]
        .filter((x) => !!x && x.trim())
        .join('\n\n')
        .trim();
    }
    if (!out.limitations_and_future_research) {
      out.limitations_and_future_research = [out.limitations_section, out.future_research_section]
        .filter((x) => !!x && x.trim())
        .join('\n\n')
        .trim();
    }
    return out;
  }, []);

  const renderSummaryText = useCallback((raw?: string | null) => {
    const text = (raw ?? '').trim();
    if (!text) return <span>—</span>;

    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    const bulletRe = /^\s*[-*•]\s+(.+)$/;
    const numberRe = /^\s*\d+[.)]\s+(.+)$/;
    const looksLikeHeading = (s: string) => /^[A-Z][A-Za-z0-9\s/&(),\-]+$/.test(s) && s.length < 80;
    const isLabelLine = (s: string) => /:\s*$/.test(s);

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      if (bulletRe.test(line)) {
        const items: string[] = [];
        while (i < lines.length) {
          const l = lines[i].trim();
          if (!l) {
            i++;
            continue;
          }
          const m = l.match(bulletRe);
          if (!m) break;
          const itemParts = [m[1].trim()];
          i++;
          // Capture wrapped lines that belong to the same bullet item.
          while (i < lines.length) {
            const contRaw = lines[i];
            const cont = contRaw.trim();
            if (!cont) {
              i++;
              break;
            }
            if (bulletRe.test(cont) || numberRe.test(cont)) break;
            itemParts.push(cont);
            i++;
          }
          items.push(itemParts.join(' '));
        }
        nodes.push(
          <ul key={`u-${key++}`} className="paper-detail-summary-list paper-detail-summary-list-ul">
            {items.map((item, idx) => (
              <li key={`ui-${idx}`}>{item}</li>
            ))}
          </ul>
        );
        continue;
      }

      if (numberRe.test(line)) {
        const items: string[] = [];
        while (i < lines.length) {
          const l = lines[i].trim();
          if (!l) {
            i++;
            continue;
          }
          const m = l.match(numberRe);
          if (!m) break;
          const itemParts = [m[1].trim()];
          i++;
          // Capture wrapped lines that belong to the same numbered item.
          while (i < lines.length) {
            const contRaw = lines[i];
            const cont = contRaw.trim();
            if (!cont) {
              i++;
              break;
            }
            if (numberRe.test(cont) || bulletRe.test(cont)) break;
            itemParts.push(cont);
            i++;
          }
          items.push(itemParts.join(' '));
        }
        nodes.push(
          <ol key={`o-${key++}`} className="paper-detail-summary-list paper-detail-summary-list-ol">
            {items.map((item, idx) => (
              <li key={`oi-${idx}`}>{item}</li>
            ))}
          </ol>
        );
        continue;
      }

      // Heuristic mode: many pasted summaries are line-based without "-" or "1."
      // Convert heading-like line groups into bullet structures.
      if (looksLikeHeading(line)) {
        const title = line;
        i++;
        const bodyLines: string[] = [];
        while (i < lines.length) {
          const l = lines[i].trim();
          if (!l) {
            i++;
            if (bodyLines.length > 0) break;
            continue;
          }
          if (bulletRe.test(l) || numberRe.test(l)) break;
          if (looksLikeHeading(l) && bodyLines.length > 0) break;
          bodyLines.push(l);
          i++;
        }

        // Handle label + list pattern e.g. "Highlights importance of:" + items
        const nestedStart = bodyLines.findIndex((l) => isLabelLine(l));
        if (nestedStart !== -1 && nestedStart < bodyLines.length - 1) {
          const intro = bodyLines.slice(0, nestedStart + 1).join(' ');
          const nestedItems = bodyLines.slice(nestedStart + 1).filter(Boolean);
          nodes.push(
            <div key={`h-${key++}`} className="paper-detail-summary-bullet-block">
              <ul className="paper-detail-summary-list paper-detail-summary-list-ul">
                <li>
                  <strong>{title}</strong>
                  {intro ? <> {intro}</> : null}
                  {nestedItems.length > 0 && (
                    <ul className="paper-detail-summary-list paper-detail-summary-list-ul paper-detail-summary-sublist">
                      {nestedItems.map((n, idx) => (
                        <li key={`ns-${idx}`}>{n}</li>
                      ))}
                    </ul>
                  )}
                </li>
              </ul>
            </div>
          );
          continue;
        }

        nodes.push(
          <div key={`h-${key++}`} className="paper-detail-summary-bullet-block">
            <ul className="paper-detail-summary-list paper-detail-summary-list-ul">
              <li>
                <strong>{title}</strong>
                {bodyLines.length > 0 ? <> — {bodyLines.join(' ')}</> : null}
              </li>
            </ul>
          </div>
        );
        continue;
      }

      const para: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (!l) break;
        if (bulletRe.test(l) || numberRe.test(l)) break;
        para.push(l);
        i++;
      }
      nodes.push(
        <p key={`p-${key++}`} className="paper-detail-summary-paragraph">
          {para.join(' ')}
        </p>
      );
    }

    return <div className="paper-detail-summary-rich">{nodes}</div>;
  }, []);

  const getIdFromUrl = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }, []);

  useEffect(() => {
    const id = getIdFromUrl();
    if (!id) {
      setError('No paper ID in URL. Use the Papers list and click a paper to open its details.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase!
        .from('saved_papers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setPaper(null);
      } else if (data) {
        setPaper(mapRow(data as Parameters<typeof mapRow>[0]));
        // Load snippets once the paper is known
        const row = data as Parameters<typeof mapRow>[0];
        const paperId = row.id;
        setSnippetsLoading(true);
        const loadSnippets = async () => {
          const { data: snippetData, error: snippetErr } = await supabase!
            .from('snippets')
            .select('*')
            .eq('paper_id', paperId)
            .order('created_at', { ascending: false });
          if (snippetErr) {
            setSnippetError(snippetErr.message);
            setSnippets([]);
          } else {
            setSnippetError(null);
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
            setAllSnippetTags(Array.from(tagSet));
          }
          setSnippetsLoading(false);
        };
        loadSnippets();
        const { data: summaryData } = await supabase!
          .from('paper_summary')
          .select('*')
          .eq('paper_id', paperId)
          .maybeSingle();
        if (!cancelled && summaryData) {
          const s = summaryData as PaperSummary;
          setSummary(s);
          syncSummaryToEditor(s);
        }
      } else {
        setError('Paper not found.');
        setPaper(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdFromUrl, syncSummaryToEditor]);

  const handleStatusChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newStatus = e.target.value as PaperStatusId;
      if (!paper || !supabase || !isSupabaseConfigured()) return;
      if (newStatus === paper.status) return;
      setStatusSaving(true);
      setStatusError(null);
      const { error: updateError } = await supabase
        .from('saved_papers')
        .update({ status: newStatus })
        .eq('id', paper.id);
      setStatusSaving(false);
      if (updateError) {
        setStatusError(updateError.message);
        return;
      }
      setPaper((prev) => (prev ? { ...prev, status: newStatus } : null));
    },
    [paper]
  );

  const loadSummary = useCallback(async (paperId: string) => {
    if (!supabase) return;
    setSummaryLoading(true);
    setSummaryError(null);
    const { data, error: err } = await supabase
      .from('paper_summary')
      .select('*')
      .eq('paper_id', paperId)
      .maybeSingle();
    setSummaryLoading(false);
    if (err) setSummaryError(err.message);
    else if (data) {
      const s = data as PaperSummary;
      setSummary(s);
      syncSummaryToEditor(s);
    }
  }, []);

  const loadComments = useCallback(async (paperId: string) => {
    if (!supabase) return;
    setCommentsLoading(true);
    setCommentError(null);
    const { data, error: err } = await supabase
      .from('paper_comments')
      .select('id, paper_id, content, image_url, created_at')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: false });
    setCommentsLoading(false);
    if (err) setCommentError(err.message);
    else setComments((data ?? []) as PaperComment[]);
  }, []);

  useEffect(() => {
    if (!paper?.id || !supabase || !isSupabaseConfigured()) return;
    loadComments(paper.id);
  }, [paper?.id, loadComments]);

  const handleAddComment = useCallback(async () => {
    if (!paper || !supabase || !isSupabaseConfigured()) return;
    const content = newComment.trim();
    if (!content && !commentImageFile) return;
    setCommentSaving(true);
    setCommentError(null);
    let uploadedPath: string | null = null;
    let imageUrl: string | null = null;
    if (commentImageFile) {
      const up = await uploadPaperCommentImage(supabase, paper.id, commentImageFile);
      if ('error' in up) {
        setCommentError(up.error);
        setCommentSaving(false);
        return;
      }
      uploadedPath = up.path;
      imageUrl = up.url;
    }
    const { data, error: insertError } = await supabase
      .from('paper_comments')
      .insert({ paper_id: paper.id, content: content || '', image_url: imageUrl })
      .select('id, paper_id, content, image_url, created_at')
      .single();
    if (insertError) {
      if (uploadedPath) await removePaperCommentImage(supabase, uploadedPath);
      setCommentError(insertError.message);
      setCommentSaving(false);
      return;
    }
    setCommentSaving(false);
    if (data) {
      setComments((prev) => [data as PaperComment, ...prev]);
      setNewComment('');
      setCommentImageFile(null);
      setCommentFileInputKey((k) => k + 1);
    }
  }, [paper, newComment, commentImageFile]);

  const handleGenerateSummary = useCallback(async () => {
    if (!paper || !supabase || !isSupabaseConfigured()) return;
    setGeneratingSummary(true);
    setSummaryError(null);
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('generate-paper-summary', {
        body: { paper_id: paper.id, url: paper.url },
      });
      if (fnErr) throw fnErr;
      const errMsg = fnData?.error;
      if (errMsg) throw new Error(typeof errMsg === 'string' ? errMsg : fnData?.details ?? 'Summary generation failed.');
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data } = await supabase.from('paper_summary').select('*').eq('paper_id', paper.id).maybeSingle();
        if (data) {
          setSummary(data as PaperSummary);
          break;
        }
        attempts++;
      }
    } catch (e) {
      setSummaryError(e?.message ?? 'Failed to generate summary. Set GEMINI_API_KEY in Edge Function secrets.');
    } finally {
      setGeneratingSummary(false);
    }
  }, [paper]);

  const handleSaveSummary = useCallback(async () => {
    if (!paper || !supabase || !isSupabaseConfigured()) return;
    setSavingSummary(true);
    setSummaryError(null);
    const payload = {
      paper_id: paper.id,
      abstract: summaryAbstract.trim() || null,
      key_claims: summaryKeyClaims.trim() || null,
      academic_constructs: summaryAcademicConstructs.trim() || null,
      introduction: summaryIntroduction.trim() || null,
      methods: summaryMethods.trim() || null,
      results_and_discussion: summaryResultsAndDiscussion.trim() || null,
      conclusion_section: summaryConclusion.trim() || null,
      limitations_and_future_research: summaryLimitationsAndFutureResearch.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error: upsertErr } = await supabase.from('paper_summary').upsert(payload, { onConflict: 'paper_id' });
    setSavingSummary(false);
    if (upsertErr) {
      setSummaryError(upsertErr.message);
      return;
    }
    await loadSummary(paper.id);
    setEditingSummary(false);
  }, [
    paper,
    summaryAbstract,
    summaryKeyClaims,
    summaryAcademicConstructs,
    summaryIntroduction,
    summaryMethods,
    summaryResultsAndDiscussion,
    summaryConclusion,
    summaryLimitationsAndFutureResearch,
    loadSummary,
  ]);

  const citation = paper ? buildAPA7Citation(paper) : '';
  const handleCopyCitation = useCallback(() => {
    if (!citation) return;
    navigator.clipboard.writeText(citation).then(
      () => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      },
      () => {}
    );
  }, [citation]);

  const handleAddSnippet = useCallback(async () => {
    if (!paper || !newSnippetContent.trim()) return;
    if (!supabase || !isSupabaseConfigured()) return;
    setSnippetsLoading(true);
    setSnippetError(null);
    const pageNum = newSnippetPageNumber.trim() ? parseInt(newSnippetPageNumber, 10) : null;
    const rawTags = newSnippetTagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const existingByLower = allSnippetTags.reduce<Record<string, string>>((acc, t) => {
      acc[t.toLowerCase()] = t;
      return acc;
    }, {});
    const snippetTags: string[] = [];
    for (const t of rawTags) {
      const key = t.toLowerCase();
      const canonical = existingByLower[key] ?? t;
      if (!snippetTags.some((x) => x.toLowerCase() === canonical.toLowerCase())) {
        snippetTags.push(canonical);
      }
    }
    const payload: Omit<Snippet, 'id' | 'created_at'> & { id?: string; created_at?: string } = {
      paper_id: paper.id,
      construct_id: newSnippetConstructId.trim() || null,
      model_id: newSnippetModelId.trim() || null,
      content: newSnippetContent.trim(),
      notes: null,
      tags: snippetTags,
      page_number: pageNum != null && !Number.isNaN(pageNum) ? pageNum : null,
    };
    const { data, error: insertError } = await supabase
      .from('snippets')
      .insert(payload)
      .select('*')
      .single();
    if (insertError) {
      setSnippetError(insertError.message);
    } else if (data) {
      const inserted = data as Snippet;
      setSnippets((prev) => [inserted, ...prev]);
      if (Array.isArray(inserted.tags)) {
        setAllSnippetTags((prev) => {
          const set = new Set(prev);
          for (const t of inserted.tags) {
            if (t && typeof t === 'string') set.add(t);
          }
          return Array.from(set);
        });
      }
      setNewSnippetContent('');
      setNewSnippetConstructId('');
      setNewSnippetModelId('');
      setNewSnippetPageNumber('');
      setNewSnippetTagsInput('');
    }
    setSnippetsLoading(false);
  }, [paper, newSnippetContent, newSnippetConstructId, newSnippetModelId, newSnippetPageNumber, newSnippetTagsInput, allSnippetTags]);

  const handleDeleteSnippet = useCallback(
    async (id: string) => {
      if (!supabase || !isSupabaseConfigured()) return;
      const confirmed = window.confirm('Delete this snippet?');
      if (!confirmed) return;
      setSnippetsLoading(true);
      setSnippetError(null);
      const { error: deleteError } = await supabase.from('snippets').delete().eq('id', id);
      if (deleteError) {
        setSnippetError(deleteError.message);
      } else {
        setSnippets((prev) => prev.filter((s) => s.id !== id));
      }
      setSnippetsLoading(false);
    },
    []
  );

  if (loading) {
    return (
      <div className="paper-detail-page">
        <p className="paper-detail-loading">Loading paper…</p>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="paper-detail-page">
        <a href={`${base}papers/`} className="paper-detail-back">← Back to Papers</a>
        <p className="paper-detail-error">{error || 'Paper not found.'}</p>
      </div>
    );
  }

  return (
    <div className="paper-detail-page">
      <a href={`${base}papers/`} className="paper-detail-back">← Back to Papers</a>

      <header className="paper-detail-header">
        <h1 className="paper-detail-title">{paper.title || 'Untitled'}</h1>
        {paper.authors && <p className="paper-detail-authors">{paper.authors}</p>}
        <div className="paper-detail-meta-row">
          {paper.year && <span className="paper-detail-year">{paper.year}</span>}
          {paper.journal && <span className="paper-detail-journal">{paper.journal}</span>}
          <select
            id="paper-detail-status"
            className={`paper-detail-status-select paper-detail-status-${paper.status.replace(/\s+/g, '-').toLowerCase()}`}
            value={paper.status}
            onChange={handleStatusChange}
            disabled={statusSaving}
            aria-label="Reading status"
            aria-busy={statusSaving}
          >
            {PAPER_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {statusSaving && <span className="paper-detail-status-saving">Saving…</span>}
          {statusError && <span className="paper-detail-status-error">{statusError}</span>}
          {paper.golden && <span className="paper-detail-golden">Golden</span>}
        </div>
      </header>

      <section className="paper-detail-section">
        <h2 className="paper-detail-section-title">Links</h2>
        <p>
          <a href={paper.url} target="_blank" rel="noopener noreferrer" className="paper-detail-link">
            Open paper
          </a>
          {paper.secondary_url && (
            <>
              {' · '}
              <a href={paper.secondary_url} target="_blank" rel="noopener noreferrer" className="paper-detail-link">
                Secondary link
              </a>
            </>
          )}
        </p>
      </section>

      {paper.motivation && (
        <section className="paper-detail-section">
          <h2 className="paper-detail-section-title">Why I saved this</h2>
          <p className="paper-detail-motivation">{paper.motivation}</p>
        </section>
      )}

      {paper.tags.length > 0 && (
        <section className="paper-detail-section">
          <h2 className="paper-detail-section-title">Tags</h2>
          <div className="paper-detail-tags">
            {paper.tags.map((t) => (
              <span key={t} className="paper-detail-tag">{t}</span>
            ))}
          </div>
        </section>
      )}

      {(paper.citations != null && paper.citations !== undefined) && (
        <section className="paper-detail-section">
          <h2 className="paper-detail-section-title">Citations</h2>
          <p className="paper-detail-citations">{paper.citations}</p>
        </section>
      )}

      <section className="paper-detail-section paper-detail-comments">
        <h2 className="paper-detail-section-title">Comments</h2>
        <div className="paper-detail-comments-add">
          <div className="paper-detail-comments-add-fields">
            <textarea
              className="paper-detail-comments-input"
              rows={3}
              placeholder="Add a quick comment (you can also paste an image with Cmd+V)..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onPaste={(e) => {
                const pastedImage = extractImageFileFromClipboard(e.clipboardData);
                if (!pastedImage) return;
                e.preventDefault();
                setCommentImageFile(pastedImage);
              }}
            />
            <div className="paper-detail-comments-image-tools">
              <label className="paper-detail-comments-file-label">
                <input
                  key={commentFileInputKey}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="paper-detail-comments-file-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setCommentImageFile(f);
                  }}
                />
                <span className="paper-detail-comments-file-text">Attach image / Paste (Cmd+V)</span>
              </label>
              {commentImageFile && (
                <button
                  type="button"
                  className="paper-detail-comments-file-clear"
                  onClick={() => {
                    setCommentImageFile(null);
                    setCommentFileInputKey((k) => k + 1);
                  }}
                >
                  Remove image
                </button>
              )}
            </div>
            {commentImagePreviewUrl && (
              <div className="paper-detail-comments-preview-wrap">
                <img
                  src={commentImagePreviewUrl}
                  alt="Selected attachment preview"
                  className="paper-detail-comments-preview"
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className="paper-detail-comments-btn"
            onClick={handleAddComment}
            disabled={commentSaving || (!newComment.trim() && !commentImageFile)}
          >
            {commentSaving ? 'Saving…' : 'Add comment'}
          </button>
        </div>
        {commentError && <p className="paper-detail-comments-error">{commentError}</p>}
        {commentsLoading && comments.length === 0 && (
          <p className="paper-detail-comments-empty">Loading comments…</p>
        )}
        {!commentsLoading && comments.length === 0 && !commentError && (
          <p className="paper-detail-comments-empty">No comments yet.</p>
        )}
        {comments.length > 0 && (
          <ul className="paper-detail-comments-list">
            {comments.map((c) => (
              <li key={c.id} className="paper-detail-comments-item">
                {c.content.trim() ? (
                  <p className="paper-detail-comments-content">{c.content}</p>
                ) : null}
                {c.image_url ? (
                  <a
                    href={c.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-detail-comments-image-link"
                  >
                    <img
                      src={c.image_url}
                      alt=""
                      className="paper-detail-comments-image"
                      loading="lazy"
                    />
                  </a>
                ) : null}
                <time className="paper-detail-comments-time" dateTime={c.created_at}>
                  {new Date(c.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="paper-detail-section paper-detail-summary">
        <div className="paper-detail-summary-header">
          <h2 className="paper-detail-section-title">Summary</h2>
          <div className="paper-detail-summary-header-actions">
            <button
              type="button"
              className="paper-detail-summary-btn"
              onClick={() => {
                setEditingSummary((v) => {
                  const next = !v;
                  if (next) syncSummaryToEditor(summary);
                  return next;
                });
              }}
            >
              {editingSummary ? 'Close editor' : 'Edit summary'}
            </button>
            <button
              type="button"
              className="paper-detail-summary-btn paper-detail-summary-btn-secondary"
              onClick={handleGenerateSummary}
              disabled={generatingSummary}
              title="Experimental: may fail on sites that block server-side access (403)."
            >
              {generatingSummary ? 'Generating…' : 'Try auto summary'}
            </button>
          </div>
        </div>

        {summaryLoading && !summary && <p className="paper-detail-summary-loading">Loading summary…</p>}
        {summaryError && <p className="paper-detail-summary-error">{summaryError}</p>}

        {editingSummary && (
          <div className="paper-detail-summary-editor">
            <label className="paper-detail-summary-label">
              Paste structured summary (optional)
              <textarea
                className="paper-detail-summary-textarea"
                value={pasteSummary}
                onChange={(e) => setPasteSummary(e.target.value)}
                rows={6}
                placeholder={`Abstract:\n...\n\nKey Claims:\n...\n\nAcademic Constructs:\n...\n\nIntroduction:\n...\n\nMethods:\n...\n\nResults and Discussion:\n...\n\nConclusion:\n...\n\nLimitations and Future Research:\n...`}
              />
            </label>
            <div className="paper-detail-summary-editor-actions">
              <button
                type="button"
                className="paper-detail-summary-btn paper-detail-summary-btn-secondary"
                onClick={() => {
                  const parsed = parseStructuredSummary(pasteSummary);
                  if (!parsed) return;
                  if (parsed.abstract != null) setSummaryAbstract(parsed.abstract || '');
                  if (parsed.key_claims != null) setSummaryKeyClaims(parsed.key_claims || '');
                  if (parsed.academic_constructs != null) setSummaryAcademicConstructs(parsed.academic_constructs || '');
                  if (parsed.introduction != null) setSummaryIntroduction(parsed.introduction || '');
                  if (parsed.methods != null) setSummaryMethods(parsed.methods || '');
                  if (parsed.results_and_discussion != null) setSummaryResultsAndDiscussion(parsed.results_and_discussion || '');
                  if (parsed.conclusion_section != null) setSummaryConclusion(parsed.conclusion_section || '');
                  if (parsed.limitations_and_future_research != null) setSummaryLimitationsAndFutureResearch(parsed.limitations_and_future_research || '');
                }}
              >
                Parse into sections
              </button>
              <button
                type="button"
                className="paper-detail-summary-btn"
                onClick={handleSaveSummary}
                disabled={savingSummary}
              >
                {savingSummary ? 'Saving…' : 'Save summary'}
              </button>
            </div>

            <div className="paper-detail-summary-fields paper-detail-summary-fields-edit">
              <div className="paper-detail-summary-fields-main">
                <label className="paper-detail-summary-label">
                  Abstract
                  <textarea className="paper-detail-summary-textarea" rows={3} value={summaryAbstract} onChange={(e) => setSummaryAbstract(e.target.value)} />
                </label>
                <label className="paper-detail-summary-label">
                  Key Claims
                  <textarea className="paper-detail-summary-textarea" rows={3} value={summaryKeyClaims} onChange={(e) => setSummaryKeyClaims(e.target.value)} />
                </label>
                <label className="paper-detail-summary-label">
                  Introduction
                  <textarea className="paper-detail-summary-textarea" rows={3} value={summaryIntroduction} onChange={(e) => setSummaryIntroduction(e.target.value)} />
                </label>
                <label className="paper-detail-summary-label">
                  Methods
                  <textarea className="paper-detail-summary-textarea" rows={3} value={summaryMethods} onChange={(e) => setSummaryMethods(e.target.value)} />
                </label>
                <label className="paper-detail-summary-label">
                  Results and Discussion
                  <textarea className="paper-detail-summary-textarea" rows={4} value={summaryResultsAndDiscussion} onChange={(e) => setSummaryResultsAndDiscussion(e.target.value)} />
                </label>
                <label className="paper-detail-summary-label">
                  Conclusion
                  <textarea className="paper-detail-summary-textarea" rows={3} value={summaryConclusion} onChange={(e) => setSummaryConclusion(e.target.value)} />
                </label>
              </div>
              <div className="paper-detail-summary-fields-side">
                <label className="paper-detail-summary-label">
                  Academic Constructs
                  <textarea className="paper-detail-summary-textarea" rows={5} value={summaryAcademicConstructs} onChange={(e) => setSummaryAcademicConstructs(e.target.value)} />
                </label>
                <label className="paper-detail-summary-label">
                  Limitations and Future Research
                  <textarea className="paper-detail-summary-textarea" rows={5} value={summaryLimitationsAndFutureResearch} onChange={(e) => setSummaryLimitationsAndFutureResearch(e.target.value)} />
                </label>
              </div>
            </div>
          </div>
        )}

        {!editingSummary && (
          <div className="paper-detail-summary-layout">
            <div className="paper-detail-summary-col paper-detail-summary-col-main">
              <div className="paper-detail-summary-grid">
                <div className="paper-detail-summary-block">
                  <h3 className="paper-detail-summary-heading">Abstract</h3>
                  <div className="paper-detail-summary-text">{renderSummaryText(summary?.abstract)}</div>
                </div>
                <div className="paper-detail-summary-block">
                  <h3 className="paper-detail-summary-heading">Key Claims</h3>
                  <div className="paper-detail-summary-text">{renderSummaryText(summary?.key_claims)}</div>
                </div>
                <div className="paper-detail-summary-block">
                  <h3 className="paper-detail-summary-heading">Introduction</h3>
                  <div className="paper-detail-summary-text">{renderSummaryText(summary?.introduction)}</div>
                </div>
                <div className="paper-detail-summary-block">
                  <h3 className="paper-detail-summary-heading">Methods</h3>
                  <div className="paper-detail-summary-text">{renderSummaryText(summary?.methods)}</div>
                </div>
                <div className="paper-detail-summary-block">
                  <h3 className="paper-detail-summary-heading">Results and Discussion</h3>
                  <div className="paper-detail-summary-text">
                    {renderSummaryText((summary?.results_and_discussion ?? [summary?.results_section, summary?.discussion_section].filter((x) => !!x && x.trim()).join('\n\n')))}
                  </div>
                </div>
                <div className="paper-detail-summary-block">
                  <h3 className="paper-detail-summary-heading">Conclusion</h3>
                  <div className="paper-detail-summary-text">{renderSummaryText(summary?.conclusion_section)}</div>
                </div>
              </div>
            </div>
            <aside className="paper-detail-summary-col paper-detail-summary-col-side" aria-label="Constructs and limitations">
              <div className="paper-detail-summary-block">
                <h3 className="paper-detail-summary-heading">Academic Constructs</h3>
                <div className="paper-detail-summary-text">{renderSummaryText(summary?.academic_constructs)}</div>
              </div>
              <div className="paper-detail-summary-block">
                <h3 className="paper-detail-summary-heading">Limitations and Future Research</h3>
                <div className="paper-detail-summary-text">
                  {renderSummaryText((summary?.limitations_and_future_research ?? [summary?.limitations_section, summary?.future_research_section].filter((x) => !!x && x.trim()).join('\n\n')))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </section>

      <section className="paper-detail-section paper-detail-snippets">
        <h2 className="paper-detail-section-title">Snippets from this paper</h2>
        <p className="paper-detail-snippets-hint">
          Capture key ideas or quotes here and optionally link them to constructs or models so you can reuse them later.
        </p>
        <div className="paper-detail-snippet-form">
          <label className="paper-detail-snippet-label">
            Snippet text
            <textarea
              className="paper-detail-snippet-input"
              value={newSnippetContent}
              onChange={(e) => setNewSnippetContent(e.target.value)}
              rows={3}
              placeholder="Paste or type the key idea, quote, or conceptual snippet from this paper…"
            />
          </label>
          <div className="paper-detail-snippet-meta-row">
            <label className="paper-detail-snippet-label-inline">
              Construct (optional)
              <select
                className="paper-detail-snippet-input-inline"
                value={newSnippetConstructId}
                onChange={(e) => setNewSnippetConstructId(e.target.value)}
              >
                <option value="">None</option>
                {constructOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="paper-detail-snippet-label-inline">
              Model (optional)
              <select
                className="paper-detail-snippet-input-inline"
                value={newSnippetModelId}
                onChange={(e) => setNewSnippetModelId(e.target.value)}
              >
                <option value="">None</option>
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="paper-detail-snippet-label-inline">
              Page number (optional)
              <input
                type="number"
                min={1}
                className="paper-detail-snippet-input-inline paper-detail-snippet-page-input"
                value={newSnippetPageNumber}
                onChange={(e) => setNewSnippetPageNumber(e.target.value)}
                placeholder="e.g. 12"
              />
            </label>
            <label className="paper-detail-snippet-label-inline">
              Tags (optional)
              <input
                type="text"
                list="snippet-tags-list"
                className="paper-detail-snippet-input-inline paper-detail-snippet-tags-input"
                value={newSnippetTagsInput}
                onChange={(e) => setNewSnippetTagsInput(e.target.value)}
                placeholder="e.g. method, theory"
              />
            </label>
          </div>
          <datalist id="snippet-tags-list">
            {allSnippetTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            type="button"
            className="paper-detail-snippet-add"
            onClick={handleAddSnippet}
            disabled={!newSnippetContent.trim() || snippetsLoading}
          >
            {snippetsLoading ? 'Saving snippet…' : 'Add snippet'}
          </button>
          {snippetError && <p className="paper-detail-snippet-error">{snippetError}</p>}
        </div>

        <div className="paper-detail-snippet-list">
          {snippetsLoading && snippets.length === 0 && (
            <p className="paper-detail-snippet-empty">Loading snippets…</p>
          )}
          {!snippetsLoading && snippets.length === 0 && !snippetError && (
            <p className="paper-detail-snippet-empty">No snippets yet. Add your first snippet from this paper above.</p>
          )}
          {snippets.map((s) => (
            <article key={s.id} className="paper-detail-snippet-card">
              <p className="paper-detail-snippet-content">{s.content}</p>
              {(s.page_number != null || s.construct_id || s.model_id) && (
                <div className="paper-detail-snippet-meta">
                  {s.page_number != null && (
                    <span className="paper-detail-snippet-page">Page {s.page_number}</span>
                  )}
                  {(s.construct_id || s.model_id) && (
                <div className="paper-detail-snippet-links">
                  {s.construct_id && (
                    <a
                      href={`${base}constructs/${s.construct_id}/`}
                      className="paper-detail-snippet-chip"
                    >
                      Construct: {s.construct_id}
                    </a>
                  )}
                  {s.model_id && (() => {
                    const mid = canonicalModelId(s.model_id);
                    const m = modelOptions.find((x) => x.id === mid);
                    return (
                    <a
                      href={`${base}models/${mid}/`}
                      className="paper-detail-snippet-chip"
                    >
                      Model: {m?.name ?? mid}
                    </a>
                    );
                  })()}
                </div>
                  )}
                </div>
              )}
              {Array.isArray(s.tags) && s.tags.length > 0 && (
                <div className="paper-detail-snippet-tags">
                  {s.tags.map((tag) => (
                    <span key={tag} className="paper-detail-snippet-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="paper-detail-snippet-footer">
                <span className="paper-detail-snippet-date">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  className="paper-detail-snippet-delete"
                  onClick={() => handleDeleteSnippet(s.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="paper-detail-section paper-detail-apa-section">
        <h2 className="paper-detail-section-title">APA 7 reference</h2>
        <p className="paper-detail-apa-hint">
          Use this reference in your bibliography. You can copy it and paste into your document.
        </p>
        <div className="paper-detail-apa-box">
          <output className="paper-detail-apa-output" aria-live="polite">
            {citation || 'Add title, authors, and year in the paper edit form to generate a citation.'}
          </output>
          {citation && (
            <button type="button" className="paper-detail-apa-copy" onClick={handleCopyCitation}>
              {copyFeedback ? 'Copied!' : 'Copy citation'}
            </button>
          )}
        </div>
      </section>

      <p className="paper-detail-created">
        Saved on {new Date(paper.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}

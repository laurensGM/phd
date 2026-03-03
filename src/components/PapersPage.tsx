import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SavedPaper {
  id: string;
  url: string;
  motivation: string | null;
  tags: string[];
  title: string | null;
  authors: string | null;
  year: string | null;
  created_at: string;
}

/** Extract DOI from a URL like https://doi.org/10.2307/249008 */
function extractDoi(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const m = trimmed.match(/doi\.org\/(10\.\S+)/i) || trimmed.match(/^(10\.\d+\/\S+)/);
  if (!m) return null;
  return m[1].replace(/#.*$/, '').trim();
}

/** Extract arXiv ID from URL like https://arxiv.org/abs/2301.00001 or .../pdf/2301.00001 */
function extractArxivId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const m = url.trim().match(/arxiv\.org\/(?:abs|pdf)\/([a-z\-]*(?:\d{4}\.\d{4,5})(?:v\d+)?)/i);
  if (!m) return null;
  return m[1].replace(/v\d+$/, '');
}

/** Fetch title, authors, year from CrossRef (DOI) or arXiv API */
async function fetchMetadataFromUrl(url: string): Promise<{ title: string; authors: string; year: string } | null> {
  const doi = extractDoi(url);
  if (doi) {
    try {
      const res = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const msg = data?.message;
      if (!msg) return null;
      const title = Array.isArray(msg.title) ? msg.title[0] : msg.title || '';
      const authorList = msg.author ?? [];
      const authors = authorList
        .map((a: { family?: string; given?: string }) => [a.family, a.given].filter(Boolean).join(', '))
        .filter(Boolean)
        .join('; ');
      const dateParts = msg.published?.['date-parts']?.[0] ?? msg['published-print']?.['date-parts']?.[0] ?? msg['published-online']?.['date-parts']?.[0];
      const year = dateParts?.[0] != null ? String(dateParts[0]) : '';
      return { title: title || '', authors: authors || '', year };
    } catch {
      return null;
    }
  }
  const arxivId = extractArxivId(url);
  if (arxivId) {
    try {
      const res = await fetch(
        `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`,
        { headers: { Accept: 'application/atom+xml' } }
      );
      if (!res.ok) return null;
      const xml = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const entry = doc.querySelector('entry');
      if (!entry) return null;
      const titleEl = entry.querySelector('title');
      const title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const authorEls = entry.querySelectorAll('author name');
      const authors = Array.from(authorEls).map((el) => el.textContent?.trim() ?? '').filter(Boolean).join('; ');
      const published = entry.querySelector('published')?.textContent ?? '';
      const year = published ? String(new Date(published).getFullYear()) : '';
      return { title, authors, year };
    } catch {
      return null;
    }
  }
  return null;
}

const TAG_OPTIONS = [
  'method',
  'theory',
  'conclusion',
  'model',
  'constructs',
  'agritech',
  'SSA',
  'results',
  'seminal',
  'ICT4D',
];

function mapRow(row: {
  id: string;
  url: string;
  motivation: string | null;
  tags: string[] | null;
  title?: string | null;
  authors?: string | null;
  year?: string | null;
  created_at: string;
}): SavedPaper {
  return {
    id: row.id,
    url: row.url,
    motivation: row.motivation ?? null,
    tags: row.tags ?? [],
    title: row.title ?? null,
    authors: row.authors ?? null,
    year: row.year ?? null,
    created_at: row.created_at,
  };
}

export default function PapersPage() {
  const [papers, setPapers] = useState<SavedPaper[]>([]);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    url: '',
    motivation: '',
    tags: [] as string[],
    title: '',
    authors: '',
    year: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    url: '',
    title: '',
    authors: '',
    year: '',
    motivation: '',
    tags: [] as string[],
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPapers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('saved_papers')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setPapers([]);
    } else {
      setPapers((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    fetchPapers();
  }, [fetchPapers]);

  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const urlMatch = p.url.toLowerCase().includes(q);
        const motivationMatch = p.motivation?.toLowerCase().includes(q);
        const tagMatch = p.tags.some((t) => t.toLowerCase().includes(q));
        const titleMatch = p.title?.toLowerCase().includes(q);
        const authorsMatch = p.authors?.toLowerCase().includes(q);
        if (!urlMatch && !motivationMatch && !tagMatch && !titleMatch && !authorsMatch) return false;
      }
      if (tagFilter && !p.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [papers, search, tagFilter]);

  const handleFetchMetadata = async () => {
    const url = formData.url.trim();
    if (!url) {
      setError('Paste a DOI or arXiv link first.');
      return;
    }
    setFetchingMeta(true);
    setError(null);
    const meta = await fetchMetadataFromUrl(url);
    setFetchingMeta(false);
    if (meta) {
      setFormData((d) => ({ ...d, title: meta.title, authors: meta.authors, year: meta.year }));
    } else {
      setError('Could not fetch metadata. Try a DOI link (e.g. https://doi.org/10.1234/...) or arXiv link. You can still fill title, authors, and year manually.');
    }
  };

  const toggleTag = (tag: string) => {
    setFormData((d) => ({
      ...d,
      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
    }));
  };

  const startEdit = (paper: SavedPaper) => {
    setEditingId(paper.id);
    setEditForm({
      url: paper.url,
      title: paper.title ?? '',
      authors: paper.authors ?? '',
      year: paper.year ?? '',
      motivation: paper.motivation ?? '',
      tags: paper.tags ?? [],
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleEditTag = (tag: string) => {
    setEditForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editingId) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('saved_papers')
      .update({
        url: editForm.url.trim(),
        title: editForm.title.trim() || null,
        authors: editForm.authors.trim() || null,
        year: editForm.year.trim() || null,
        motivation: editForm.motivation.trim() || null,
        tags: editForm.tags,
      })
      .eq('id', editingId)
      .select('id, url, motivation, tags, title, authors, year, created_at')
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) {
      setPapers((prev) => prev.map((p) => (p.id === editingId ? mapRow({ ...data, id: data.id }) : p)));
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this paper from your list?')) return;
    if (!supabase) return;
    setDeletingId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('saved_papers').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setPapers((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { data: insertData, error: insertError } = await supabase
      .from('saved_papers')
      .insert({
        url: formData.url.trim(),
        motivation: formData.motivation.trim() || null,
        tags: formData.tags,
        title: formData.title.trim() || null,
        authors: formData.authors.trim() || null,
        year: formData.year.trim() || null,
      })
      .select('id, url, motivation, tags, title, authors, year, created_at')
      .single();
    if (insertError) {
      setError(insertError.message);
    } else if (insertData) {
      setPapers((prev) => [mapRow({ ...insertData, id: insertData.id }), ...prev]);
      setFormData({ url: '', motivation: '', tags: [], title: '', authors: '', year: '' });
      setShowForm(false);
    }
    setSaving(false);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
    } catch {
      return iso.slice(0, 10);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="papers-setup">
        <h3>Saved papers require Supabase</h3>
        <p>
          Add your Supabase credentials to save paper links and motivations. See the README for setup.
        </p>
        <p className="papers-setup-hint">
          Set <code>PUBLIC_SUPABASE_URL</code> and <code>PUBLIC_SUPABASE_ANON_KEY</code> in your environment or <code>.env</code> file.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="papers-loading">Loading saved papers...</div>;
  }

  return (
    <div className="papers-page">
      {error && <p className="papers-error">{error}</p>}

      <section className="papers-add-section">
        <button
          className="papers-add-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '− Hide form' : '+ Save a paper'}
        </button>

        {showForm && (
          <form className="papers-form" onSubmit={handleSubmit}>
            <h3 className="papers-form-title">Save a paper</h3>
            <p className="papers-form-hint">Add a link and why you want to keep it so you don’t forget later.</p>

            <div className="papers-form-field">
              <label htmlFor="paper-url">Link to the paper</label>
              <div className="papers-url-row">
                <input
                  id="paper-url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData((d) => ({ ...d, url: e.target.value }))}
                  required
                  placeholder="https://doi.org/... or https://arxiv.org/abs/..."
                  className="papers-input"
                />
                <button
                  type="button"
                  onClick={handleFetchMetadata}
                  disabled={fetchingMeta || !formData.url.trim()}
                  className="papers-fetch-btn"
                  title="Fetch title, authors, year from DOI or arXiv"
                >
                  {fetchingMeta ? 'Fetching…' : 'Fetch from link'}
                </button>
              </div>
              <span className="papers-field-hint">Paste a DOI or arXiv URL, then click to auto-fill metadata.</span>
            </div>

            <div className="papers-form-field papers-form-field-row">
              <div>
                <label htmlFor="paper-title">Title</label>
                <input
                  id="paper-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Fetched automatically or enter manually"
                  className="papers-input"
                />
              </div>
              <div>
                <label htmlFor="paper-year">Year</label>
                <input
                  id="paper-year"
                  type="text"
                  value={formData.year}
                  onChange={(e) => setFormData((d) => ({ ...d, year: e.target.value }))}
                  placeholder="e.g. 2023"
                  className="papers-input papers-input-short"
                />
              </div>
            </div>

            <div className="papers-form-field">
              <label htmlFor="paper-authors">Authors</label>
              <input
                id="paper-authors"
                type="text"
                value={formData.authors}
                onChange={(e) => setFormData((d) => ({ ...d, authors: e.target.value }))}
                placeholder="Fetched automatically or enter manually"
                className="papers-input"
              />
            </div>

            <div className="papers-form-field papers-form-field-motivation">
              <label htmlFor="paper-motivation">Why I’m saving this</label>
              <textarea
                id="paper-motivation"
                value={formData.motivation}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, motivation: e.target.value }))
                }
                rows={6}
                placeholder="e.g. Good definition of continuance intention; method I might replicate; relevant for SSA context..."
                className="papers-textarea"
              />
            </div>

            <div className="papers-form-field">
              <span className="papers-form-label">Tags (click to select)</span>
              <div className="papers-tag-chips">
                {TAG_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`papers-tag-chip ${formData.tags.includes(t) ? 'selected' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="papers-submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save paper'}
            </button>
          </form>
        )}
      </section>

      <section className="papers-history-section">
        <h3 className="papers-history-title">
          Your saved papers
          {papers.length > 0 && (
            <span className="papers-entry-count">
              {' '}({filteredPapers.length} {filteredPapers.length === 1 ? 'paper' : 'papers'})
            </span>
          )}
        </h3>
        <div className="papers-filters">
          <input
            type="search"
            placeholder="Search by title, authors, URL or motivation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="papers-search"
          />
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="papers-select"
          >
            <option value="">All tags</option>
            {TAG_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="papers-entries">
          {filteredPapers.map((paper) => (
            <article key={paper.id} className="papers-entry">
              {editingId === paper.id ? (
                <form className="papers-entry-edit-form" onSubmit={handleSaveEdit}>
                  <div className="papers-form-field">
                    <label>Link</label>
                    <input
                      type="url"
                      value={editForm.url}
                      onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                      required
                      className="papers-input"
                    />
                  </div>
                  <div className="papers-form-field papers-form-field-row">
                    <div>
                      <label>Title</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        className="papers-input"
                      />
                    </div>
                    <div>
                      <label>Year</label>
                      <input
                        type="text"
                        value={editForm.year}
                        onChange={(e) => setEditForm((f) => ({ ...f, year: e.target.value }))}
                        className="papers-input papers-input-short"
                      />
                    </div>
                  </div>
                  <div className="papers-form-field">
                    <label>Authors</label>
                    <input
                      type="text"
                      value={editForm.authors}
                      onChange={(e) => setEditForm((f) => ({ ...f, authors: e.target.value }))}
                      className="papers-input"
                    />
                  </div>
                  <div className="papers-form-field">
                    <label>Why I’m saving this</label>
                    <textarea
                      value={editForm.motivation}
                      onChange={(e) => setEditForm((f) => ({ ...f, motivation: e.target.value }))}
                      rows={3}
                      className="papers-textarea"
                    />
                  </div>
                  <div className="papers-form-field">
                    <span className="papers-form-label">Tags</span>
                    <div className="papers-tag-chips">
                      {TAG_OPTIONS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`papers-tag-chip ${editForm.tags.includes(t) ? 'selected' : ''}`}
                          onClick={() => toggleEditTag(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="papers-entry-edit-actions">
                    <button type="submit" className="papers-btn papers-btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="papers-btn papers-btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="papers-entry-header">
                    <div className="papers-entry-header-left">
                      <time dateTime={paper.created_at}>{formatDate(paper.created_at)}</time>
                      {paper.year && <span className="papers-entry-year">{paper.year}</span>}
                      <div className="papers-entry-tags">
                        {paper.tags.map((t) => (
                          <span key={t} className="papers-tag-badge">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="papers-entry-actions">
                      <button
                        type="button"
                        className="papers-entry-action papers-entry-edit"
                        onClick={() => startEdit(paper)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="papers-entry-action papers-entry-delete"
                        onClick={() => handleDelete(paper.id)}
                        disabled={deletingId === paper.id}
                        title="Delete"
                      >
                        {deletingId === paper.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  <h4 className="papers-entry-title">
                    <a href={paper.url} target="_blank" rel="noopener noreferrer">
                      {paper.title || paper.url}
                    </a>
                  </h4>
                  {paper.authors && (
                    <p className="papers-entry-authors">{paper.authors}</p>
                  )}
                  {!paper.title && (
                    <p className="papers-entry-url-fallback">
                      <a href={paper.url} target="_blank" rel="noopener noreferrer">{paper.url}</a>
                    </p>
                  )}
                  {paper.motivation && (
                    <p className="papers-entry-motivation">{paper.motivation}</p>
                  )}
                </>
              )}
            </article>
          ))}
          {filteredPapers.length === 0 && !loading && (
            <p className="papers-empty">
              No saved papers yet. Add a link and motivation above so you remember why you kept it.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

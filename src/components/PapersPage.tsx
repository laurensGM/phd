import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SavedPaper {
  id: string;
  url: string;
  motivation: string | null;
  tags: string[];
  created_at: string;
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
];

function mapRow(row: {
  id: string;
  url: string;
  motivation: string | null;
  tags: string[] | null;
  created_at: string;
}): SavedPaper {
  return {
    id: row.id,
    url: row.url,
    motivation: row.motivation ?? null,
    tags: row.tags ?? [],
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (!urlMatch && !motivationMatch && !tagMatch) return false;
      }
      if (tagFilter && !p.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [papers, search, tagFilter]);

  const toggleTag = (tag: string) => {
    setFormData((d) => ({
      ...d,
      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
    }));
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
      })
      .select('id, url, motivation, tags, created_at')
      .single();
    if (insertError) {
      setError(insertError.message);
    } else if (insertData) {
      setPapers((prev) => [mapRow({ ...insertData, id: insertData.id }), ...prev]);
      setFormData({ url: '', motivation: '', tags: [] });
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
              <input
                id="paper-url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData((d) => ({ ...d, url: e.target.value }))}
                required
                placeholder="https://..."
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
            placeholder="Search by URL or motivation..."
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
              <div className="papers-entry-header">
                <time dateTime={paper.created_at}>{formatDate(paper.created_at)}</time>
                <div className="papers-entry-tags">
                  {paper.tags.map((t) => (
                    <span key={t} className="papers-tag-badge">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <h4 className="papers-entry-link">
                <a href={paper.url} target="_blank" rel="noopener noreferrer">
                  {paper.url}
                </a>
              </h4>
              {paper.motivation && (
                <p className="papers-entry-motivation">{paper.motivation}</p>
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

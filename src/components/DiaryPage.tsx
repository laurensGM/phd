import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface DiaryEntry {
  id: string;
  date: string;
  summary: string;
  detailedReflection: string;
  tags: string[];
  linkedConstructs: string[];
}

const TAG_OPTIONS = ['theory', 'meeting', 'coding', 'writing', 'idea', 'literature', 'supervision', 'methods'];

function mapRow(row: {
  id: string;
  date: string;
  summary: string;
  detailed_reflection: string | null;
  tags: string[] | null;
  linked_constructs: string[] | null;
}): DiaryEntry {
  return {
    id: row.id,
    date: row.date,
    summary: row.summary,
    detailedReflection: row.detailed_reflection ?? '',
    tags: row.tags ?? [],
    linkedConstructs: row.linked_constructs ?? [],
  };
}

export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    summary: '',
    detailedReflection: '',
    tags: [] as string[],
    linkedConstructs: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('diary_entries')
      .select('*')
      .order('date', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setEntries([]);
    } else {
      setEntries((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    fetchEntries();
  }, [fetchEntries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.summary.toLowerCase().includes(q) &&
          !e.detailedReflection?.toLowerCase().includes(q) &&
          !e.tags.some((t) => t.toLowerCase().includes(q)) &&
          !e.linkedConstructs?.some((c) => c.toLowerCase().includes(q))
        )
          return false;
      }
      if (tagFilter && !e.tags.includes(tagFilter)) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [entries, search, tagFilter, dateFrom, dateTo]);

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
    const now = new Date().toISOString().slice(0, 10);
    const linked = formData.linkedConstructs
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const { data: insertData, error: insertError } = await supabase
      .from('diary_entries')
      .insert({
        date: now,
        summary: formData.summary,
        detailed_reflection: formData.detailedReflection || null,
        tags: formData.tags,
        linked_constructs: linked,
      })
      .select('id, date, summary, detailed_reflection, tags, linked_constructs')
      .single();
    if (insertError) {
      setError(insertError.message);
    } else if (insertData) {
      setEntries((prev) => [mapRow({ ...insertData, id: insertData.id }), ...prev]);
      setFormData({ summary: '', detailedReflection: '', tags: [], linkedConstructs: '' });
      setShowForm(false);
    }
    setSaving(false);
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="diary-setup">
        <h3>Diary persistence requires Supabase</h3>
        <p>
          Add your Supabase credentials to enable the persistent diary. See the README for setup instructions.
        </p>
        <p className="diary-setup-hint">
          Set <code>PUBLIC_SUPABASE_URL</code> and <code>PUBLIC_SUPABASE_ANON_KEY</code> in your environment or <code>.env</code> file.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="diary-loading">Loading...</div>;
  }

  return (
    <div className="diary-page">
      {error && <p className="diary-error">{error}</p>}
      <div className="diary-filters">
        <input
          type="search"
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="diary-search"
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="diary-select"
        >
          <option value="">All tags</option>
          {TAG_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="From"
          className="diary-date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="To"
          className="diary-date"
        />
      </div>

      <button
        className="diary-add-btn"
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? 'Cancel' : '+ New Entry'}
      </button>

      {showForm && (
        <form className="diary-form" onSubmit={handleSubmit}>
          <h3>New Diary Entry</h3>
          <p className="form-date-hint">Date will be set to today automatically.</p>
          <label>
            Summary
            <input
              type="text"
              value={formData.summary}
              onChange={(e) => setFormData((d) => ({ ...d, summary: e.target.value }))}
              required
              placeholder="Brief summary of what you did"
            />
          </label>
          <label>
            Details
            <textarea
              value={formData.detailedReflection}
              onChange={(e) =>
                setFormData((d) => ({ ...d, detailedReflection: e.target.value }))
              }
              rows={4}
              placeholder="Describe what you did..."
            />
          </label>
          <label>
            Tags (click to select)
            <div className="tag-chips">
              {TAG_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`tag-chip ${formData.tags.includes(t) ? 'selected' : ''}`}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </label>
          <label>
            Linked Constructs (comma or semicolon separated)
            <input
              type="text"
              value={formData.linkedConstructs}
              onChange={(e) =>
                setFormData((d) => ({ ...d, linkedConstructs: e.target.value }))
              }
              placeholder="e.g. Perceived Usefulness, Satisfaction"
            />
          </label>
          <button type="submit" className="diary-submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      )}

      <div className="diary-entries">
        {filteredEntries.map((entry) => (
          <article key={entry.id} className="diary-entry">
            <div className="entry-header">
              <time dateTime={entry.date}>{entry.date}</time>
              <div className="entry-tags">
                {entry.tags.map((t) => (
                  <span key={t} className="tag-badge">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <h4>{entry.summary}</h4>
            {entry.detailedReflection && (
              <p className="entry-reflection">{entry.detailedReflection}</p>
            )}
            {entry.linkedConstructs?.length > 0 && (
              <p className="entry-constructs">
                Linked: {entry.linkedConstructs.join(', ')}
              </p>
            )}
          </article>
        ))}
        {filteredEntries.length === 0 && !loading && (
          <p className="diary-empty">No entries yet. Add your first diary entry above.</p>
        )}
      </div>
    </div>
  );
}

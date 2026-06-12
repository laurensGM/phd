import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FormatDiaryText } from '../lib/formatDiaryText';
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
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    summary: '',
    detailedReflection: '',
    tags: [] as string[],
    linkedConstructs: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: '',
    summary: '',
    detailedReflection: '',
    tags: [] as string[],
    linkedConstructs: '',
  });
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

  const toggleEditTag = (tag: string) => {
    setEditFormData((d) => ({
      ...d,
      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
    }));
  };

  const startEdit = (entry: DiaryEntry) => {
    setEditingId(entry.id);
    setEditFormData({
      date: entry.date,
      summary: entry.summary,
      detailedReflection: entry.detailedReflection,
      tags: [...entry.tags],
      linkedConstructs: entry.linkedConstructs.join(', '),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({
      date: '',
      summary: '',
      detailedReflection: '',
      tags: [],
      linkedConstructs: '',
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!supabase) return;
    const summary = editFormData.summary.trim();
    if (!summary) return;
    setSaving(true);
    setError(null);
    const linked = editFormData.linkedConstructs
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const { data, error: updateError } = await supabase
      .from('diary_entries')
      .update({
        date: editFormData.date,
        summary,
        detailed_reflection: editFormData.detailedReflection || null,
        tags: editFormData.tags,
        linked_constructs: linked,
      })
      .eq('id', id)
      .select('id, date, summary, detailed_reflection, tags, linked_constructs')
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) {
      setEntries((prev) => prev.map((entry) => (entry.id === id ? mapRow(data) : entry)));
      cancelEdit();
    }
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
      setShowForm(false); // Hide form after save; user can click "+ New Entry" to add another
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

      <section className="diary-add-section">
        <button
          className="diary-add-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '− Hide form' : '+ New Entry'}
        </button>

        {showForm && (
          <form className="diary-form" onSubmit={handleSubmit}>
            <h3 className="diary-form-title">New Diary Entry</h3>
            <p className="form-date-hint">Date will be set to today automatically.</p>

            <div className="diary-form-field">
              <label htmlFor="diary-summary">Summary</label>
              <input
                id="diary-summary"
                type="text"
                value={formData.summary}
                onChange={(e) => setFormData((d) => ({ ...d, summary: e.target.value }))}
                required
                placeholder="Brief summary of what you did"
                className="diary-input diary-input-summary"
              />
            </div>

            <div className="diary-form-field diary-form-field-details">
              <label htmlFor="diary-details">Details</label>
              <p className="diary-format-hint">
                Line breaks are kept as you type them. Wrap text in <code>**double asterisks**</code> to make it{' '}
                <strong>bold</strong> when displayed.
              </p>
              <textarea
                id="diary-details"
                value={formData.detailedReflection}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, detailedReflection: e.target.value }))
                }
                rows={10}
                placeholder="Describe what you did, key decisions, reflections..."
                className="diary-textarea"
              />
            </div>

            <div className="diary-form-field">
              <span className="diary-form-label">Tags (click to select)</span>
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
            </div>

            <div className="diary-form-field">
              <label htmlFor="diary-constructs">Linked Constructs (comma or semicolon separated)</label>
              <input
                id="diary-constructs"
                type="text"
                value={formData.linkedConstructs}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, linkedConstructs: e.target.value }))
                }
                placeholder="e.g. Perceived Usefulness, Satisfaction"
                className="diary-input"
              />
            </div>

            <button type="submit" className="diary-submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </form>
        )}
      </section>

      <section className="diary-history-section">
        <h3 className="diary-history-title">
          Diary History {entries.length > 0 && <span className="entry-count">({filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'})</span>}
        </h3>
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

        <div className="diary-entries">
        {filteredEntries.map((entry) => (
          <article key={entry.id} className="diary-entry">
            {editingId === entry.id ? (
              <div className="diary-edit-form">
                <h4 className="diary-edit-title">Edit entry</h4>
                <div className="diary-form-field">
                  <label htmlFor={`edit-date-${entry.id}`}>Date</label>
                  <input
                    id={`edit-date-${entry.id}`}
                    type="date"
                    value={editFormData.date}
                    onChange={(e) => setEditFormData((d) => ({ ...d, date: e.target.value }))}
                    className="diary-input diary-date"
                    required
                  />
                </div>
                <div className="diary-form-field">
                  <label htmlFor={`edit-summary-${entry.id}`}>Summary</label>
                  <input
                    id={`edit-summary-${entry.id}`}
                    type="text"
                    value={editFormData.summary}
                    onChange={(e) => setEditFormData((d) => ({ ...d, summary: e.target.value }))}
                    required
                    className="diary-input diary-input-summary"
                  />
                </div>
                <div className="diary-form-field diary-form-field-details">
                  <label htmlFor={`edit-details-${entry.id}`}>Details</label>
                  <textarea
                    id={`edit-details-${entry.id}`}
                    value={editFormData.detailedReflection}
                    onChange={(e) =>
                      setEditFormData((d) => ({ ...d, detailedReflection: e.target.value }))
                    }
                    rows={8}
                    className="diary-textarea"
                  />
                </div>
                <div className="diary-form-field">
                  <span className="diary-form-label">Tags</span>
                  <div className="tag-chips">
                    {TAG_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`tag-chip ${editFormData.tags.includes(t) ? 'selected' : ''}`}
                        onClick={() => toggleEditTag(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="diary-form-field">
                  <label htmlFor={`edit-constructs-${entry.id}`}>Linked constructs</label>
                  <input
                    id={`edit-constructs-${entry.id}`}
                    type="text"
                    value={editFormData.linkedConstructs}
                    onChange={(e) =>
                      setEditFormData((d) => ({ ...d, linkedConstructs: e.target.value }))
                    }
                    className="diary-input"
                  />
                </div>
                <div className="diary-entry-actions">
                  <button
                    type="button"
                    className="diary-submit"
                    onClick={() => handleSaveEdit(entry.id)}
                    disabled={saving || !editFormData.summary.trim()}
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" className="diary-btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="entry-header">
                  <time dateTime={entry.date}>{entry.date}</time>
                  <div className="entry-header-actions">
                    <div className="entry-tags">
                      {entry.tags.map((t) => (
                        <span key={t} className="tag-badge">
                          {t}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="diary-btn-secondary"
                      onClick={() => startEdit(entry)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <h4 className="entry-summary">
                  <FormatDiaryText text={entry.summary} />
                </h4>
                {entry.detailedReflection && (
                  <div className="entry-reflection">
                    <FormatDiaryText text={entry.detailedReflection} />
                  </div>
                )}
                {entry.linkedConstructs?.length > 0 && (
                  <p className="entry-constructs">
                    Linked: {entry.linkedConstructs.join(', ')}
                  </p>
                )}
              </>
            )}
          </article>
        ))}
        {filteredEntries.length === 0 && !loading && (
          <p className="diary-empty">No entries yet. Add your first diary entry above.</p>
        )}
        </div>
      </section>
    </div>
  );
}

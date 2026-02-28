import React, { useState, useMemo, useEffect } from 'react';

interface DiaryEntry {
  id: string;
  date: string;
  summary: string;
  detailedReflection: string;
  tags: string[];
  linkedConstructs: string[];
}

const TAG_OPTIONS = ['theory', 'meeting', 'coding', 'writing', 'idea', 'literature', 'supervision', 'methods'];

export default function DiaryPage({ initialEntries }: { initialEntries: DiaryEntry[] }) {
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);
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

  useEffect(() => {
    const stored = localStorage.getItem('phd-diary-entries');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setEntries((prev) => {
          const merged = [...initialEntries];
          parsed.forEach((e: DiaryEntry) => {
            if (!merged.some((x) => x.id === e.id)) merged.push(e);
          });
          return merged.sort((a, b) => (b.date > a.date ? 1 : -1));
        });
      } catch (_) {}
    }
  }, []);

  const saveToStorage = (newEntries: DiaryEntry[]) => {
    const custom = newEntries.filter(
      (e) => !initialEntries.some((i) => i.id === e.id)
    );
    localStorage.setItem('phd-diary-entries', JSON.stringify(custom));
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString().slice(0, 10);
    const linked = formData.linkedConstructs
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const newEntry: DiaryEntry = {
      id: `custom-${Date.now()}`,
      date: now,
      summary: formData.summary,
      detailedReflection: formData.detailedReflection,
      tags: formData.tags,
      linkedConstructs: linked,
    };
    const updated = [newEntry, ...entries].sort((a, b) =>
      b.date > a.date ? 1 : -1
    );
    setEntries(updated);
    saveToStorage(updated);
    setFormData({ summary: '', detailedReflection: '', tags: [], linkedConstructs: '' });
    setShowForm(false);
  };

  return (
    <div className="diary-page">
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
              placeholder="Brief summary of the entry"
            />
          </label>
          <label>
            Detailed Reflection
            <textarea
              value={formData.detailedReflection}
              onChange={(e) =>
                setFormData((d) => ({ ...d, detailedReflection: e.target.value }))
              }
              rows={4}
              placeholder="Your detailed reflection..."
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
          <button type="submit" className="diary-submit">
            Save Entry
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
      </div>
    </div>
  );
}

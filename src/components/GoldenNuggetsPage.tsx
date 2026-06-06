import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface GoldenNugget {
  id: string;
  content: string;
  author: string | null;
  created_at: string;
  updated_at: string;
}

interface StaticQuote {
  text: string;
  author: string | null;
}

interface GoldenNuggetsPageProps {
  staticQuotes: StaticQuote[];
}

function mapRow(row: {
  id: string;
  content: string;
  author: string | null;
  created_at: string;
  updated_at: string;
}): GoldenNugget {
  return {
    id: row.id,
    content: row.content,
    author: row.author ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export default function GoldenNuggetsPage({ staticQuotes }: GoldenNuggetsPageProps) {
  const [quotes, setQuotes] = useState<GoldenNugget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({ text: '', author: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchQuotes = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('golden_nuggets')
      .select('*')
      .eq('type', 'quote')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setQuotes([]);
    } else {
      setQuotes((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    fetchQuotes();
  }, [fetchQuotes]);

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !quoteForm.text.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('golden_nuggets')
      .insert({ type: 'quote', content: quoteForm.text.trim(), author: quoteForm.author.trim() || null })
      .select('*')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setQuotes((prev) => [mapRow(data), ...prev]);
      setQuoteForm({ text: '', author: '' });
    }
  };

  const startEdit = (item: GoldenNugget) => {
    setEditingId(item.id);
    setEditContent(item.content);
    setEditAuthor(item.author ?? '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editingId) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('golden_nuggets')
      .update({ content: editContent.trim(), author: editAuthor.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', editingId)
      .select('*')
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) {
      setQuotes((prev) => prev.map((n) => (n.id === editingId ? mapRow(data) : n)));
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this item?')) return;
    if (!supabase) return;
    setDeletingId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('golden_nuggets').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setQuotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleImportFromJson = async () => {
    if (!supabase || !staticQuotes.length) return;
    setImporting(true);
    setError(null);
    try {
      for (const item of staticQuotes) {
        await supabase.from('golden_nuggets').insert({
          type: 'quote',
          content: item.text,
          author: item.author ?? null,
        });
      }
      await fetchQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
    setImporting(false);
  };

  const staticQuotesOrdered = [...staticQuotes].reverse();

  const quotesList = (list: GoldenNugget[], editable: boolean) => (
    <ul className="nuggets-list quotes-list">
      {list.map((item) => (
        <li key={item.id} className="nugget-item quote-item">
          {editable && editingId === item.id ? (
            <form className="nuggets-edit-form" onSubmit={handleSaveEdit}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className="nuggets-textarea"
                required
              />
              <input
                type="text"
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                placeholder="Author (optional)"
                className="nuggets-input nuggets-input-author"
              />
              <div className="nuggets-edit-actions">
                <button type="submit" className="nuggets-btn nuggets-btn-primary" disabled={saving}>
                  Save
                </button>
                <button type="button" className="nuggets-btn nuggets-btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="nugget-quote-wrap">
              <blockquote className="nugget-quote">
                <p className="nugget-text">{item.content}</p>
                {item.author && (
                  <footer>
                    <cite className="nugget-author">— {item.author}</cite>
                  </footer>
                )}
              </blockquote>
              {editable && (
                <div className="nugget-item-actions">
                  <button type="button" className="nugget-action" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="nugget-action nugget-action-delete"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  if (!isSupabaseConfigured()) {
    return (
      <div className="golden-nuggets-page">
        <p className="nuggets-setup">Add your Supabase credentials to add, edit, and delete quotes.</p>
        <section className="nuggets-section">
          <h2 className="section-title">Quotes &amp; insights</h2>
          <ul className="nuggets-list quotes-list">
            {staticQuotesOrdered.map((item, i) => (
              <li key={i} className="nugget-item quote-item">
                <blockquote className="nugget-quote">
                  <p className="nugget-text">{item.text}</p>
                  {item.author && (
                    <footer>
                      <cite className="nugget-author">— {item.author}</cite>
                    </footer>
                  )}
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  if (loading) {
    return <p className="nuggets-loading">Loading golden nuggets…</p>;
  }

  const canImport = staticQuotes.length > 0 && quotes.length === 0;

  return (
    <div className="golden-nuggets-page">
      {error && <p className="nuggets-error">{error}</p>}

      {canImport && (
        <div className="nuggets-import-bar">
          <p className="nuggets-import-text">Import the default quotes from the site&apos;s JSON into your list.</p>
          <button
            type="button"
            className="nuggets-import-btn"
            onClick={handleImportFromJson}
            disabled={importing}
          >
            {importing ? 'Importing…' : 'Import from JSON'}
          </button>
        </div>
      )}

      <section className="nuggets-section">
        <h2 className="section-title">Quotes &amp; insights</h2>
        <form className="nuggets-add-form nuggets-add-form-quote" onSubmit={handleAddQuote}>
          <textarea
            value={quoteForm.text}
            onChange={(e) => setQuoteForm((f) => ({ ...f, text: e.target.value }))}
            placeholder="Quote or insight…"
            rows={3}
            className="nuggets-textarea"
            required
          />
          <input
            type="text"
            value={quoteForm.author}
            onChange={(e) => setQuoteForm((f) => ({ ...f, author: e.target.value }))}
            placeholder="Author (optional)"
            className="nuggets-input nuggets-input-author"
          />
          <button type="submit" className="nuggets-add-btn" disabled={saving}>
            {saving ? 'Adding…' : 'Add quote'}
          </button>
        </form>
        {quotesList(quotes, true)}
        {quotes.length === 0 && !loading && <p className="nuggets-empty">No quotes yet. Add one above.</p>}
      </section>
    </div>
  );
}

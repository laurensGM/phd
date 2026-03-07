import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type NuggetType = 'faq' | 'quote';

interface GoldenNugget {
  id: string;
  type: NuggetType;
  content: string;
  author: string | null;
  created_at: string;
  updated_at: string;
}

interface StaticFaq {
  question: string;
  author: string | null;
}

interface StaticQuote {
  text: string;
  author: string | null;
}

interface GoldenNuggetsPageProps {
  staticFaq: StaticFaq[];
  staticQuotes: StaticQuote[];
}

function mapRow(row: { id: string; type: string; content: string; author: string | null; created_at: string; updated_at: string }): GoldenNugget {
  return {
    id: row.id,
    type: row.type as NuggetType,
    content: row.content,
    author: row.author ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export default function GoldenNuggetsPage({ staticFaq, staticQuotes }: GoldenNuggetsPageProps) {
  const [faq, setFaq] = useState<GoldenNugget[]>([]);
  const [quotes, setQuotes] = useState<GoldenNugget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [faqForm, setFaqForm] = useState({ question: '', author: '' });
  const [quoteForm, setQuoteForm] = useState({ text: '', author: '' });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editType, setEditType] = useState<NuggetType | null>(null);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'faq' | 'quotes'>('faq');

  const fetchNuggets = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('golden_nuggets')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setFaq([]);
      setQuotes([]);
    } else {
      const rows = (data ?? []).map(mapRow);
      setFaq(rows.filter((r) => r.type === 'faq'));
      setQuotes(rows.filter((r) => r.type === 'quote'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    fetchNuggets();
  }, [fetchNuggets]);

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !faqForm.question.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('golden_nuggets')
      .insert({ type: 'faq', content: faqForm.question.trim(), author: faqForm.author.trim() || null })
      .select('*')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setFaq((prev) => [mapRow(data), ...prev]);
      setFaqForm({ question: '', author: '' });
    }
  };

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
    setEditType(item.type);
    setEditContent(item.content);
    setEditAuthor(item.author ?? '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditType(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editingId || !editType) return;
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
      const mapped = mapRow(data);
      if (editType === 'faq') setFaq((prev) => prev.map((n) => (n.id === editingId ? mapped : n)));
      else setQuotes((prev) => prev.map((n) => (n.id === editingId ? mapped : n)));
      setEditingId(null);
      setEditType(null);
    }
  };

  const handleDelete = async (id: string, type: NuggetType) => {
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
    if (type === 'faq') setFaq((prev) => prev.filter((n) => n.id !== id));
    else setQuotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleImportFromJson = async () => {
    if (!supabase || (!staticFaq.length && !staticQuotes.length)) return;
    setImporting(true);
    setError(null);
    try {
      for (const item of staticFaq) {
        await supabase.from('golden_nuggets').insert({
          type: 'faq',
          content: item.question,
          author: item.author ?? null,
        });
      }
      for (const item of staticQuotes) {
        await supabase.from('golden_nuggets').insert({
          type: 'quote',
          content: item.text,
          author: item.author ?? null,
        });
      }
      await fetchNuggets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
    setImporting(false);
  };

  const staticFaqOrdered = [...staticFaq].reverse();
  const staticQuotesOrdered = [...staticQuotes].reverse();

  if (!isSupabaseConfigured()) {
    return (
      <div className="golden-nuggets-page">
        <p className="nuggets-setup">Add your Supabase credentials to add, edit, and delete FAQs and quotes.</p>
        <nav className="nuggets-tabs" aria-label="FAQs and Quotes">
          <button
            type="button"
            className={`nuggets-tab ${activeTab === 'faq' ? 'nuggets-tab-active' : ''}`}
            onClick={() => setActiveTab('faq')}
          >
            FAQs
          </button>
          <button
            type="button"
            className={`nuggets-tab ${activeTab === 'quotes' ? 'nuggets-tab-active' : ''}`}
            onClick={() => setActiveTab('quotes')}
          >
            Quotes &amp; insights
          </button>
        </nav>
        {activeTab === 'faq' && (
        <section className="nuggets-section">
          <h2 className="section-title">FAQ</h2>
          <ul className="nuggets-list faq-list">
            {staticFaqOrdered.map((item, i) => (
              <li key={i} className="nugget-item faq-item">
                <span className="nugget-text">&quot;{item.question}&quot;</span>
                {item.author && <cite className="nugget-author">— {item.author}</cite>}
              </li>
            ))}
          </ul>
        </section>
        )}
        {activeTab === 'quotes' && (
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
        )}
      </div>
    );
  }

  if (loading) {
    return <p className="nuggets-loading">Loading golden nuggets…</p>;
  }

  const canImport = (staticFaq.length > 0 || staticQuotes.length > 0) && faq.length === 0 && quotes.length === 0;

  return (
    <div className="golden-nuggets-page">
      {error && <p className="nuggets-error">{error}</p>}

      {canImport && (
        <div className="nuggets-import-bar">
          <p className="nuggets-import-text">Import the default FAQs and quotes from the site’s JSON into your list.</p>
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

      <nav className="nuggets-tabs" aria-label="FAQs and Quotes">
        <button
          type="button"
          className={`nuggets-tab ${activeTab === 'faq' ? 'nuggets-tab-active' : ''}`}
          onClick={() => setActiveTab('faq')}
        >
          FAQs
        </button>
        <button
          type="button"
          className={`nuggets-tab ${activeTab === 'quotes' ? 'nuggets-tab-active' : ''}`}
          onClick={() => setActiveTab('quotes')}
        >
          Quotes &amp; insights
        </button>
      </nav>

      {activeTab === 'faq' && (
      <section className="nuggets-section">
        <h2 className="section-title">FAQ</h2>
        <form className="nuggets-add-form" onSubmit={handleAddFaq}>
          <input
            type="text"
            value={faqForm.question}
            onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
            placeholder="Question…"
            className="nuggets-input"
            required
          />
          <input
            type="text"
            value={faqForm.author}
            onChange={(e) => setFaqForm((f) => ({ ...f, author: e.target.value }))}
            placeholder="Author (optional)"
            className="nuggets-input nuggets-input-author"
          />
          <button type="submit" className="nuggets-add-btn" disabled={saving}>
            {saving ? 'Adding…' : 'Add FAQ'}
          </button>
        </form>
        <ul className="nuggets-list faq-list">
          {faq.map((item) => (
            <li key={item.id} className="nugget-item faq-item">
              {editingId === item.id && editType === 'faq' ? (
                <form className="nuggets-edit-form" onSubmit={handleSaveEdit}>
                  <input
                    type="text"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="nuggets-input"
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
                <>
                  <div className="nugget-item-header">
                    <span className="nugget-text">&quot;{item.content}&quot;</span>
                    <div className="nugget-item-actions">
                      <button type="button" className="nugget-action" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="nugget-action nugget-action-delete"
                        onClick={() => handleDelete(item.id, 'faq')}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {item.author && <cite className="nugget-author">— {item.author}</cite>}
                </>
              )}
            </li>
          ))}
        </ul>
        {faq.length === 0 && !loading && <p className="nuggets-empty">No FAQs yet. Add one above.</p>}
      </section>
      )}

      {activeTab === 'quotes' && (
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
        <ul className="nuggets-list quotes-list">
          {quotes.map((item) => (
            <li key={item.id} className="nugget-item quote-item">
              {editingId === item.id && editType === 'quote' ? (
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
                <>
                  <div className="nugget-quote-wrap">
                    <blockquote className="nugget-quote">
                      <p className="nugget-text">{item.content}</p>
                      {item.author && (
                        <footer>
                          <cite className="nugget-author">— {item.author}</cite>
                        </footer>
                      )}
                    </blockquote>
                    <div className="nugget-item-actions">
                      <button type="button" className="nugget-action" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="nugget-action nugget-action-delete"
                        onClick={() => handleDelete(item.id, 'quote')}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {quotes.length === 0 && !loading && <p className="nuggets-empty">No quotes yet. Add one above.</p>}
      </section>
      )}
    </div>
  );
}

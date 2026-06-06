import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FormatDiaryText } from '../lib/formatDiaryText';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface StaticFaqQuestion {
  question: string;
}

interface FaqPageProps {
  staticQuestions: StaticFaqQuestion[];
}

function mapRow(row: {
  id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}): FaqItem {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeQuestion(q: string): string {
  return q.trim().toLowerCase();
}

export default function FaqPage({ staticQuestions }: FaqPageProps) {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [questionDraft, setQuestionDraft] = useState('');
  const [answerDraft, setAnswerDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('tool_faqs')
      .select('id, question, answer, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
      setItems([]);
    } else {
      setItems((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    fetchItems();
  }, [fetchItems]);

  const existingQuestions = useMemo(
    () => new Set(items.map((item) => normalizeQuestion(item.question))),
    [items]
  );

  const pendingSeedCount = useMemo(
    () => staticQuestions.filter((q) => !existingQuestions.has(normalizeQuestion(q.question))).length,
    [staticQuestions, existingQuestions]
  );

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (!supabase) return;
    setImporting(true);
    setError(null);
    try {
      const known = new Set(items.map((item) => normalizeQuestion(item.question)));

      for (const seed of staticQuestions) {
        const q = seed.question.trim();
        if (!q || known.has(normalizeQuestion(q))) continue;
        await supabase.from('tool_faqs').insert({ question: q, answer: '' });
        known.add(normalizeQuestion(q));
      }

      const { data: legacyFaqs } = await supabase
        .from('golden_nuggets')
        .select('id, content')
        .eq('type', 'faq');

      for (const legacy of legacyFaqs ?? []) {
        const q = legacy.content.trim();
        if (!q || known.has(normalizeQuestion(q))) {
          await supabase.from('golden_nuggets').delete().eq('id', legacy.id);
          continue;
        }
        await supabase.from('tool_faqs').insert({ question: q, answer: '' });
        known.add(normalizeQuestion(q));
        await supabase.from('golden_nuggets').delete().eq('id', legacy.id);
      }

      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
    setImporting(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const question = questionDraft.trim();
    const answer = answerDraft.trim();
    if (!question) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('tool_faqs')
      .insert({ question, answer })
      .select('id, question, answer, created_at, updated_at')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setItems((prev) => [mapRow(data), ...prev]);
      setQuestionDraft('');
      setAnswerDraft('');
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!supabase) return;
    const question = editQuestion.trim();
    const answer = editAnswer.trim();
    if (!question) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('tool_faqs')
      .update({ question, answer, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, question, answer, created_at, updated_at')
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) {
      setItems((prev) => prev.map((item) => (item.id === id ? mapRow(data) : item)));
      setEditingId(null);
      setEditQuestion('');
      setEditAnswer('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    setDeletingId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('tool_faqs').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (editingId === id) {
      setEditingId(null);
      setEditQuestion('');
      setEditAnswer('');
    }
  };

  const startEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setEditQuestion(item.question);
    setEditAnswer(item.answer);
    setOpenIds((prev) => new Set(prev).add(item.id));
  };

  const renderFaqItem = (item: FaqItem, editable: boolean) => (
    <li key={item.id} className="faq-item">
      {editable && editingId === item.id ? (
        <div className="faq-edit">
          <div className="faq-field">
            <label htmlFor={`edit-q-${item.id}`}>Question</label>
            <input
              id={`edit-q-${item.id}`}
              type="text"
              value={editQuestion}
              onChange={(e) => setEditQuestion(e.target.value)}
              className="faq-input"
            />
          </div>
          <div className="faq-field">
            <label htmlFor={`edit-a-${item.id}`}>Answer</label>
            <textarea
              id={`edit-a-${item.id}`}
              value={editAnswer}
              onChange={(e) => setEditAnswer(e.target.value)}
              rows={5}
              className="faq-textarea"
            />
          </div>
          <div className="faq-item-actions">
            <button
              type="button"
              className="faq-btn faq-btn-primary"
              onClick={() => handleSaveEdit(item.id)}
              disabled={saving || !editQuestion.trim()}
            >
              Save
            </button>
            <button
              type="button"
              className="faq-btn faq-btn-secondary"
              onClick={() => {
                setEditingId(null);
                setEditQuestion('');
                setEditAnswer('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="faq-item-header">
            <button
              type="button"
              className="faq-toggle"
              onClick={() => toggleOpen(item.id)}
              aria-expanded={openIds.has(item.id)}
            >
              <span className="faq-chevron" aria-hidden="true">
                {openIds.has(item.id) ? '▼' : '▶'}
              </span>
              <span className="faq-question-text">{item.question}</span>
            </button>
            {editable && (
              <div className="faq-item-actions">
                <button type="button" className="faq-btn faq-btn-secondary" onClick={() => startEdit(item)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="faq-btn faq-btn-delete"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            )}
          </div>
          {openIds.has(item.id) && (
            <div className="faq-answer">
              {item.answer.trim() ? (
                <FormatDiaryText text={item.answer} />
              ) : (
                <span className="faq-answer-empty">No answer yet.</span>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );

  if (!isSupabaseConfigured()) {
    const staticItems: FaqItem[] = staticQuestions.map((q, i) => ({
      id: `static-${i}`,
      question: q.question,
      answer: '',
      created_at: '',
      updated_at: '',
    }));

    return (
      <div className="faq-page">
        <p className="faq-setup">Add Supabase credentials to edit FAQs. Showing default questions below.</p>
        <section className="faq-list-section">
          <h2 className="faq-list-title">Your FAQs</h2>
          <ul className="faq-list">{staticItems.map((item) => renderFaqItem(item, false))}</ul>
        </section>
      </div>
    );
  }

  if (loading) {
    return <p className="faq-loading">Loading…</p>;
  }

  const showImport = pendingSeedCount > 0 || items.length === 0;

  return (
    <div className="faq-page">
      {error && <p className="faq-error">{error}</p>}

      {showImport && (
        <div className="faq-import-bar">
          <p className="faq-import-text">
            Import default questions from golden nuggets (answers can be added later). Any FAQs still stored in golden
            nuggets will move here automatically.
          </p>
          <button type="button" className="faq-submit" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import questions'}
          </button>
        </div>
      )}

      <form className="faq-add-form" onSubmit={handleAdd}>
        <h2 className="faq-form-title">Add FAQ</h2>
        <div className="faq-field">
          <label htmlFor="faq-question">Question</label>
          <input
            id="faq-question"
            type="text"
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            placeholder="What do you want to remember?"
            className="faq-input"
            required
          />
        </div>
        <div className="faq-field">
          <label htmlFor="faq-answer">Answer</label>
          <textarea
            id="faq-answer"
            value={answerDraft}
            onChange={(e) => setAnswerDraft(e.target.value)}
            rows={5}
            placeholder="Your answer…"
            className="faq-textarea"
          />
        </div>
        <p className="faq-format-hint">
          Line breaks and <code>**bold**</code> work in answers when displayed.
        </p>
        <button type="submit" className="faq-submit" disabled={saving || !questionDraft.trim()}>
          {saving ? 'Saving…' : 'Add FAQ'}
        </button>
      </form>

      <section className="faq-list-section">
        <h2 className="faq-list-title">
          Your FAQs
          {items.length > 0 && <span className="faq-count"> ({items.length})</span>}
        </h2>

        {items.length === 0 ? (
          <p className="faq-empty">No FAQs yet. Import the default questions or add one above.</p>
        ) : (
          <ul className="faq-list">{items.map((item) => renderFaqItem(item, true))}</ul>
        )}
      </section>
    </div>
  );
}

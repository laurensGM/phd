import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FormatDiaryText, handleBoldShortcut } from '../lib/formatDiaryText';

type EvaluationSide = 'advantage' | 'inadequacy';

interface EvaluationItem {
  id: string;
  model_id: string;
  side: EvaluationSide;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ModelEvaluationProps {
  modelId: string;
}

function mapRow(row: {
  id: string;
  model_id: string;
  side: string;
  content: string;
  created_at: string;
  updated_at: string;
}): EvaluationItem {
  return {
    id: row.id,
    model_id: row.model_id,
    side: row.side === 'inadequacy' ? 'inadequacy' : 'advantage',
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function EvaluationPanel({
  title,
  side,
  items,
  newContent,
  setNewContent,
  editingId,
  editContent,
  setEditContent,
  saving,
  deletingId,
  onAdd,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  panelClass,
}: {
  title: string;
  side: EvaluationSide;
  items: EvaluationItem[];
  newContent: string;
  setNewContent: (v: string) => void;
  editingId: string | null;
  editContent: string;
  setEditContent: (v: string) => void;
  saving: boolean;
  deletingId: string | null;
  onAdd: (e: React.FormEvent, side: EvaluationSide) => void;
  onStartEdit: (item: EvaluationItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
  panelClass: string;
}) {
  return (
    <div className={`model-eval-panel ${panelClass}`}>
      <h3 className="model-eval-panel-title">{title}</h3>
      <p className="model-eval-format-hint">
        Select text and press <kbd>⌘B</kbd> / <kbd>Ctrl+B</kbd>, or wrap in <code>**double asterisks**</code> for{' '}
        <strong>bold</strong>.
      </p>
      <form className="model-eval-add-form" onSubmit={(e) => onAdd(e, side)}>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => handleBoldShortcut(e, newContent, setNewContent)}
          placeholder={
            side === 'advantage'
              ? 'Add a reason this model is relevant…'
              : 'Add a reason this model is inadequate…'
          }
          rows={2}
          className="model-eval-textarea"
        />
        <button type="submit" className="model-eval-add-btn" disabled={saving || !newContent.trim()}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </form>
      <ul className="model-eval-list">
        {items.map((item) => (
          <li key={item.id} className="model-eval-item">
            {editingId === item.id ? (
              <form className="model-eval-edit-form" onSubmit={onSaveEdit}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => handleBoldShortcut(e, editContent, setEditContent)}
                  rows={3}
                  className="model-eval-textarea"
                  autoFocus
                />
                <div className="model-eval-edit-actions">
                  <button type="submit" className="model-eval-btn model-eval-btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="model-eval-btn model-eval-btn-secondary" onClick={onCancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="model-eval-item-content">
                  <FormatDiaryText text={item.content} />
                </p>
                <div className="model-eval-item-actions">
                  <button type="button" className="model-eval-item-action" onClick={() => onStartEdit(item)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="model-eval-item-action model-eval-item-delete"
                    onClick={() => onDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="model-eval-empty">No items yet.</p>
      )}
    </div>
  );
}

export default function ModelEvaluation({ modelId }: ModelEvaluationProps) {
  const [items, setItems] = useState<EvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newAdvantage, setNewAdvantage] = useState('');
  const [newInadequacy, setNewInadequacy] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchItems = useCallback(async () => {
    if (!supabase || !modelId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('model_evaluation_items')
      .select('*')
      .eq('model_id', modelId)
      .order('created_at', { ascending: true });
    if (fetchError) {
      if (/model_evaluation_items/i.test(fetchError.message)) {
        setError('Run migration 047_model_evaluation_items.sql in Supabase to enable this section.');
      } else {
        setError(fetchError.message);
      }
      setItems([]);
    } else {
      setItems((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, [modelId]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !modelId) {
      setLoading(false);
      return;
    }
    void fetchItems();
  }, [modelId, fetchItems]);

  const handleAdd = async (e: React.FormEvent, side: EvaluationSide) => {
    e.preventDefault();
    const content = side === 'advantage' ? newAdvantage.trim() : newInadequacy.trim();
    if (!supabase || !modelId || !content) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('model_evaluation_items')
      .insert({ model_id: modelId, side, content })
      .select('*')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setItems((prev) => [...prev, mapRow(data)]);
      if (side === 'advantage') setNewAdvantage('');
      else setNewInadequacy('');
    }
  };

  const startEdit = (item: EvaluationItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editingId || !editContent.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('model_evaluation_items')
      .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', editingId)
      .select('*')
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) {
      setItems((prev) => prev.map((item) => (item.id === editingId ? mapRow(data) : item)));
      setEditingId(null);
      setEditContent('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this item?')) return;
    if (!supabase) return;
    setDeletingId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('model_evaluation_items').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
  };

  if (!isSupabaseConfigured()) {
    return (
      <section className="model-eval-section">
        <h3 className="model-eval-section-title">Relevance for your study</h3>
        <p className="model-eval-setup">Configure Supabase to add advantages and inadequacies for this model.</p>
      </section>
    );
  }

  const advantages = items.filter((i) => i.side === 'advantage');
  const inadequacies = items.filter((i) => i.side === 'inadequacy');

  return (
    <section className="model-eval-section">
      <h3 className="model-eval-section-title">Relevance for your study</h3>
      <p className="model-eval-section-desc">
        Why this model fits your PhD — and where it falls short.
      </p>
      {error && <p className="model-eval-error">{error}</p>}
      {loading ? (
        <p className="model-eval-loading">Loading…</p>
      ) : (
        <div className="model-eval-grid">
          <EvaluationPanel
            title="Advantages"
            side="advantage"
            items={advantages}
            newContent={newAdvantage}
            setNewContent={setNewAdvantage}
            editingId={editingId}
            editContent={editContent}
            setEditContent={setEditContent}
            saving={saving}
            deletingId={deletingId}
            onAdd={handleAdd}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={handleSaveEdit}
            onDelete={handleDelete}
            panelClass="model-eval-panel-advantage"
          />
          <EvaluationPanel
            title="Inadequacies"
            side="inadequacy"
            items={inadequacies}
            newContent={newInadequacy}
            setNewContent={setNewInadequacy}
            editingId={editingId}
            editContent={editContent}
            setEditContent={setEditContent}
            saving={saving}
            deletingId={deletingId}
            onAdd={handleAdd}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={handleSaveEdit}
            onDelete={handleDelete}
            panelClass="model-eval-panel-inadequacy"
          />
        </div>
      )}
    </section>
  );
}

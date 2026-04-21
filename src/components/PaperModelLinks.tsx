import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import modelsData from '../data/models.json';

interface ModelOption {
  id: string;
  name: string;
}

const ALL_MODELS: ModelOption[] = (modelsData as { id: string; name?: string }[])
  .map((m) => ({ id: m.id, name: m.name || m.id }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

const modelNameById = new Map(ALL_MODELS.map((m) => [m.id, m.name]));

interface ModelPaperLinkRow {
  id: string;
  model_id: string;
  paper_id: string;
  created_at: string;
}

interface PaperModelLinksProps {
  paperId: string;
  base: string;
}

function sortLinksByModelName(items: (ModelPaperLinkRow & { modelName: string })[]) {
  return [...items].sort((a, b) =>
    a.modelName.localeCompare(b.modelName, undefined, { sensitivity: 'base' })
  );
}

export default function PaperModelLinks({ paperId, base }: PaperModelLinksProps) {
  const [links, setLinks] = useState<(ModelPaperLinkRow & { modelName: string })[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkedModelIds = useMemo(() => new Set(links.map((l) => l.model_id)), [links]);

  const fetchLinks = useCallback(async () => {
    if (!supabase || !paperId) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('model_papers')
      .select('id, model_id, paper_id, created_at')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      setLinks([]);
    } else {
      const rows = (data ?? []) as ModelPaperLinkRow[];
      setLinks(
        sortLinksByModelName(
          rows.map((r) => ({
            ...r,
            modelName: modelNameById.get(r.model_id) ?? r.model_id,
          }))
        )
      );
    }
    setLoading(false);
  }, [paperId]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !paperId) {
      setLoading(false);
      return;
    }
    fetchLinks();
  }, [paperId, fetchLinks]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !paperId || !selectedModelId) return;
    if (linkedModelIds.has(selectedModelId)) return;
    setAdding(true);
    setError(null);
    const { error: insertError } = await supabase.from('model_papers').insert({
      model_id: selectedModelId,
      paper_id: paperId,
    });
    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSelectedModelId('');
    await fetchLinks();
  };

  const handleRemove = async (linkId: string) => {
    if (!supabase) return;
    setRemovingId(linkId);
    setError(null);
    const { error: delError } = await supabase.from('model_papers').delete().eq('id', linkId);
    setRemovingId(null);
    if (delError) {
      setError(delError.message);
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  };

  if (!isSupabaseConfigured()) {
    return (
      <p className="paper-detail-model-links-setup">
        Configure Supabase to link this paper to models.
      </p>
    );
  }

  return (
    <div className="paper-detail-model-links">
      {error && <p className="paper-detail-model-links-error">{error}</p>}

      <form className="paper-detail-model-links-form" onSubmit={handleAdd}>
        <label className="paper-detail-model-links-label" htmlFor={`paper-model-select-${paperId}`}>
          Link to a model
        </label>
        <div className="paper-detail-model-links-row">
          <select
            id={`paper-model-select-${paperId}`}
            className="paper-detail-model-links-select"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            disabled={loading || adding}
          >
            <option value="">— Select a model —</option>
            {ALL_MODELS.map((m) => (
              <option key={m.id} value={m.id} disabled={linkedModelIds.has(m.id)}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="paper-detail-model-links-add"
            disabled={!selectedModelId || adding || linkedModelIds.has(selectedModelId)}
          >
            {adding ? 'Adding…' : 'Add link'}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="paper-detail-model-links-loading">Loading linked models…</p>
      ) : links.length > 0 ? (
        <ul className="paper-detail-model-links-list">
          {links.map((link) => (
            <li key={link.id} className="paper-detail-model-links-item">
              <a href={`${base}models/${link.model_id}/`} className="paper-detail-model-links-model">
                {link.modelName}
              </a>
              <button
                type="button"
                className="paper-detail-model-links-remove"
                onClick={() => handleRemove(link.id)}
                disabled={removingId === link.id}
                title="Remove link"
              >
                {removingId === link.id ? '…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="paper-detail-model-links-empty">No models linked yet. Choose one above.</p>
      )}
    </div>
  );
}

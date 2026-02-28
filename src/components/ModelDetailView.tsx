import React from 'react';
import ModelGraph from './ModelGraph';
import EcmIsDiagram from './EcmIsDiagram';

interface Model {
  id: string;
  name: string;
  abbreviation: string;
  year: number;
  authors: string[];
  description: string;
  constructs: string[];
  constructAbbreviations?: Record<string, string>;
  relationships: { from: string; to: string }[];
  keyCitations: { authors: string; title: string; doi?: string }[];
  diagramType?: string;
  notes?: string;
}

interface ModelDetailViewProps {
  model: Model;
  constructToSlug: Record<string, string>;
  base: string;
}

export default function ModelDetailView({ model, constructToSlug, base }: ModelDetailViewProps) {
  const hasDiagram = model.relationships && model.relationships.length > 0;

  return (
    <div className="model-detail-view">
      <p className="model-desc">{model.description}</p>

      {model.notes && (
        <div className="model-notes">
          <h3>Key points</h3>
          <div className="model-notes-content">{model.notes}</div>
        </div>
      )}

      {hasDiagram && (
        <>
          <h3>Interactive Diagram</h3>
          {model.diagramType === 'ecm-is' ? (
            <EcmIsDiagram />
          ) : (
            <ModelGraph model={model} constructToSlug={constructToSlug} />
          )}
        </>
      )}

      <h3>Core Constructs</h3>
      <ul className="construct-list">
        {model.constructs.map((c) => (
          <li key={c}>
            <a href={`${base}constructs/${constructToSlug[c] || '#'}/`}>
              {model.constructAbbreviations?.[c] || c} — {c}
            </a>
          </li>
        ))}
      </ul>

      {hasDiagram && (
        <>
          <h3>Relationships</h3>
          <ul className="relationship-list">
            {model.relationships.map((r, i) => (
              <li key={`${r.from}-${r.to}-${i}`}>
                <code>{r.from}</code> → <code>{r.to}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Key Citations</h3>
      <ul className="citations-list">
        {model.keyCitations.map((cite, i) => (
          <li key={i}>
            <strong>{cite.authors}</strong> — {cite.title}
            {cite.doi && (
              <a href={`https://doi.org/${cite.doi}`} target="_blank" rel="noopener">
                {' '}
                DOI
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

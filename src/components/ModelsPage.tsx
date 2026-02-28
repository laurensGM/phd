import React, { useState } from 'react';
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

interface ModelsPageProps {
  models: Model[];
  constructToSlug: Record<string, string>;
  base: string;
}

export default function ModelsPage({ models, constructToSlug, base }: ModelsPageProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="models-page">
      <div className="models-card-grid">
        {models.map((model) => {
          const isExpanded = expandedId === model.id;
          return (
            <div
              key={model.id}
              className={`model-teaser-card ${isExpanded ? 'expanded' : ''}`}
              id={model.id}
            >
              <button
                type="button"
                className="model-teaser-header"
                onClick={() => setExpandedId(isExpanded ? null : model.id)}
                aria-expanded={isExpanded}
              >
                <h2 className="model-teaser-title">
                  {model.name} <span className="model-teaser-abbrev">({model.abbreviation})</span>
                </h2>
                <p className="model-teaser-meta">
                  {model.authors.join(', ')} ({model.year})
                </p>
                <div className="model-teaser-constructs">
                  {model.constructs.map((c) => (
                    <span key={c} className="model-teaser-tag">
                      {model.constructAbbreviations?.[c] || c}
                    </span>
                  ))}
                </div>
                <span className="model-teaser-chevron" aria-hidden>
                  {isExpanded ? '−' : '+'}
                </span>
              </button>

              {isExpanded && (
                <div className="model-teaser-body">
                  <p className="model-desc">{model.description}</p>
                  {model.notes && (
                    <div className="model-notes">
                      <h3>Key points</h3>
                      <div className="model-notes-content">{model.notes}</div>
                    </div>
                  )}

                  {model.relationships && model.relationships.length > 0 && (
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

                  {model.relationships && model.relationships.length > 0 && (
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

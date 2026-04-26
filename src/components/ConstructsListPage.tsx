import React, { useMemo, useState } from 'react';

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';

interface Construct {
  id: string;
  name: string;
  abbreviation?: string;
  definition: string;
  sourcePaper?: string;
  theoreticalDomain?: string;
  relatedModels?: string[];
}

interface ModelOption {
  id: string;
  name: string;
  abbreviation?: string;
}

interface UmbrellaConstruct {
  id: string;
  name: string;
  constructIds: string[];
}

interface ConstructsListPageProps {
  constructs: Construct[];
  umbrellaConstructs: UmbrellaConstruct[];
  models: ModelOption[];
}

export default function ConstructsListPage({ constructs, umbrellaConstructs, models }: ConstructsListPageProps) {
  const [filterUmbrellaId, setFilterUmbrellaId] = useState('');
  const [filterLetter, setFilterLetter] = useState('');
  const [filterModelId, setFilterModelId] = useState('');
  const [filterImportance, setFilterImportance] = useState<'all' | 'top' | 'secondary'>('all');

  const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);
  const modelOptions = useMemo(
    () =>
      [...models].sort((a, b) =>
        (a.abbreviation || a.name).localeCompare(b.abbreviation || b.name, undefined, {
          sensitivity: 'base',
        })
      ),
    [models]
  );

  const topConstructNames = useMemo(
    () =>
      new Set(
        [
          'Satisfaction',
          'Perceived Usefulness',
          'Confirmation',
          'Facilitating Conditions',
          'Task-Technology Fit',
          'Continuance Intention',
        ].map((n) => n.trim().toLowerCase())
      ),
    []
  );

  const secondaryConstructNames = useMemo(
    () =>
      new Set(
        [
          'Trust',
          'Habit',
          'Social Influence',
          'Self-Efficacy',
          'Perceived Enjoyment',
          'Price Value',
        ].map((n) => n.trim().toLowerCase())
      ),
    []
  );

  const getConstructPriority = (name: string): 'top' | 'secondary' | 'default' => {
    const key = name.trim().toLowerCase();
    if (topConstructNames.has(key)) return 'top';
    if (secondaryConstructNames.has(key)) return 'secondary';
    return 'default';
  };

  const constructIdToUmbrella = useMemo(() => {
    const m = new Map<string, UmbrellaConstruct>();
    umbrellaConstructs.forEach((u) => {
      u.constructIds.forEach((cid) => m.set(cid, u));
    });
    return m;
  }, [umbrellaConstructs]);

  const filteredConstructs = useMemo(() => {
    const normalize = (v: string) => v.trim().toLowerCase();
    const sortedByName = (items: Construct[]) =>
      [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const selectedModel = modelOptions.find((m) => m.id === filterModelId);

    const umbrellaFiltered = (() => {
      if (!filterUmbrellaId) return constructs;
      const umbrella = umbrellaConstructs.find((u) => u.id === filterUmbrellaId);
      if (!umbrella) return constructs;
      const set = new Set(umbrella.constructIds);
      return constructs.filter((c) => set.has(c.id));
    })();

    const modelFiltered = (() => {
      if (!selectedModel) return umbrellaFiltered;
      const accepted = new Set([
        normalize(selectedModel.id),
        normalize(selectedModel.name),
        normalize(selectedModel.abbreviation ?? ''),
      ]);
      return umbrellaFiltered.filter((c) =>
        (c.relatedModels ?? []).some((m) => accepted.has(normalize(m)))
      );
    })();

    const importanceFiltered = (() => {
      if (filterImportance === 'all') return modelFiltered;
      return modelFiltered.filter((c) => getConstructPriority(c.name) === filterImportance);
    })();

    const letterFiltered = filterLetter
      ? importanceFiltered.filter((c) =>
          c.name.trim().toUpperCase().startsWith(filterLetter)
        )
      : importanceFiltered;

    return sortedByName(letterFiltered);
  }, [constructs, umbrellaConstructs, modelOptions, filterUmbrellaId, filterLetter, filterModelId, filterImportance]);

  return (
    <div className="constructs-page">
      <div className="constructs-letter-filter" aria-label="Filter constructs by first letter">
        <span className="constructs-letter-label">Starts with:</span>
        <button
          type="button"
          className={`constructs-letter-chip ${filterLetter === '' ? 'active' : ''}`}
          onClick={() => setFilterLetter('')}
        >
          All
        </button>
        {alphabet.map((letter) => (
          <button
            key={letter}
            type="button"
            className={`constructs-letter-chip ${filterLetter === letter ? 'active' : ''}`}
            onClick={() => setFilterLetter(letter)}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="constructs-umbrella-list">
        <span className="constructs-umbrella-label">Umbrella constructs:</span>
        <button
          type="button"
          className={`constructs-umbrella-chip ${filterUmbrellaId === '' ? 'active' : ''}`}
          onClick={() => setFilterUmbrellaId('')}
        >
          All
        </button>
        {umbrellaConstructs.map((u) => (
          <button
            key={u.id}
            type="button"
            className={`constructs-umbrella-chip ${filterUmbrellaId === u.id ? 'active' : ''}`}
            onClick={() => setFilterUmbrellaId((prev) => (prev === u.id ? '' : u.id))}
          >
            {u.name}
          </button>
        ))}
      </div>

      <div className="constructs-model-list">
        <span className="constructs-model-label">Models:</span>
        <button
          type="button"
          className={`constructs-model-chip ${filterModelId === '' ? 'active' : ''}`}
          onClick={() => setFilterModelId('')}
        >
          All
        </button>
        {modelOptions.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`constructs-model-chip ${filterModelId === m.id ? 'active' : ''}`}
            onClick={() => setFilterModelId((prev) => (prev === m.id ? '' : m.id))}
          >
            {m.abbreviation || m.name}
          </button>
        ))}
      </div>

      <div className="constructs-importance-list">
        <span className="constructs-importance-label">Priority:</span>
        <button
          type="button"
          className={`constructs-importance-chip ${filterImportance === 'all' ? 'active' : ''}`}
          onClick={() => setFilterImportance('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`constructs-importance-chip ${filterImportance === 'top' ? 'active' : ''}`}
          onClick={() => setFilterImportance('top')}
        >
          Top 5 + CI
        </button>
        <button
          type="button"
          className={`constructs-importance-chip ${filterImportance === 'secondary' ? 'active' : ''}`}
          onClick={() => setFilterImportance('secondary')}
        >
          Secondary Important
        </button>
      </div>
      <div className="constructs-grid">
        {filteredConstructs.map((construct) => {
          const umbrella = constructIdToUmbrella.get(construct.id);
          const priority = getConstructPriority(construct.name);
          const cardClassName =
            priority === 'top' && construct.name.trim().toLowerCase() === 'continuance intention'
              ? 'construct-card construct-card-ci'
              : priority === 'top'
                ? 'construct-card construct-card-top'
                : priority === 'secondary'
                  ? 'construct-card construct-card-secondary'
                  : 'construct-card';
          return (
            <article key={construct.id} className={cardClassName}>
              {umbrella && (
                <span className="construct-card-umbrella">{umbrella.name}</span>
              )}
              <h2>
                <a href={`${BASE}constructs/${construct.id}/`}>{construct.name}</a>
              </h2>
              {construct.abbreviation && <span className="abbrev">{construct.abbreviation}</span>}
              <p className="definition">{construct.definition}</p>
              {construct.sourcePaper && <p className="source">Source: {construct.sourcePaper}</p>}
              <div className="meta">
                {construct.theoreticalDomain && <span>Domain: {construct.theoreticalDomain}</span>}
                {construct.relatedModels && construct.relatedModels.length > 0 && (
                  <span className="construct-card-theory-tags">
                    {construct.relatedModels.map((model) => (
                      <span key={`${construct.id}-${model}`} className="construct-theory-tag">
                        {model}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {filteredConstructs.length === 0 && (
        <p className="constructs-empty">No constructs match the selected filters.</p>
      )}
    </div>
  );
}

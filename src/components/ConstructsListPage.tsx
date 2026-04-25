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

interface UmbrellaConstruct {
  id: string;
  name: string;
  constructIds: string[];
}

interface ConstructsListPageProps {
  constructs: Construct[];
  umbrellaConstructs: UmbrellaConstruct[];
}

export default function ConstructsListPage({ constructs, umbrellaConstructs }: ConstructsListPageProps) {
  const [filterUmbrellaId, setFilterUmbrellaId] = useState('');

  const constructIdToUmbrella = useMemo(() => {
    const m = new Map<string, UmbrellaConstruct>();
    umbrellaConstructs.forEach((u) => {
      u.constructIds.forEach((cid) => m.set(cid, u));
    });
    return m;
  }, [umbrellaConstructs]);

  const filteredConstructs = useMemo(() => {
    const sortedByName = (items: Construct[]) =>
      [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    if (!filterUmbrellaId) return sortedByName(constructs);
    const umbrella = umbrellaConstructs.find((u) => u.id === filterUmbrellaId);
    if (!umbrella) return sortedByName(constructs);
    const set = new Set(umbrella.constructIds);
    return sortedByName(constructs.filter((c) => set.has(c.id)));
  }, [constructs, umbrellaConstructs, filterUmbrellaId]);

  return (
    <div className="constructs-page">
      <div className="constructs-umbrella-list">
        <span className="constructs-umbrella-label">Umbrella constructs:</span>
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
      <div className="constructs-filter-row">
        <label htmlFor="umbrella-filter">
          Filter by umbrella construct
          <select
            id="umbrella-filter"
            className="constructs-umbrella-select"
            value={filterUmbrellaId}
            onChange={(e) => setFilterUmbrellaId(e.target.value)}
          >
            <option value="">All constructs</option>
            {umbrellaConstructs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="constructs-grid">
        {filteredConstructs.map((construct) => {
          const umbrella = constructIdToUmbrella.get(construct.id);
          return (
            <article key={construct.id} className="construct-card">
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
                  <span>Used in: {construct.relatedModels.join(', ')}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {filteredConstructs.length === 0 && (
        <p className="constructs-empty">No constructs match the selected umbrella.</p>
      )}
    </div>
  );
}

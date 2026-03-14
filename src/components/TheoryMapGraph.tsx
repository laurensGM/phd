import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import cytoscape from 'cytoscape';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';

interface Construct {
  id: string;
  name: string;
  abbreviation?: string;
}

interface Model {
  id: string;
  name: string;
  abbreviation: string;
  constructs: string[];
  constructAbbreviations?: Record<string, string>;
  relationships?: { from: string; to: string }[];
}

interface PaperSummary {
  id: string;
  title: string | null;
}

interface TheoryMapGraphProps {
  constructs: Construct[];
  models: Model[];
}

function buildAbbrToName(constructAbbreviations: Record<string, string> | undefined): Map<string, string> {
  const m = new Map<string, string>();
  if (!constructAbbreviations) return m;
  for (const [name, abbr] of Object.entries(constructAbbreviations)) {
    m.set(abbr, name);
  }
  return m;
}

function nameToConstructId(name: string, constructs: Construct[]): string | null {
  const c = constructs.find(
    (x) => x.name === name || x.name.toLowerCase() === name.toLowerCase()
  );
  return c ? c.id : null;
}

export default function TheoryMapGraph({ constructs: constructsProp, models: modelsProp }: TheoryMapGraphProps) {
  const [staticData, setStaticData] = useState<{ constructs: Construct[]; models: Model[] } | null>(null);
  const constructs = Array.isArray(constructsProp) && constructsProp.length > 0
    ? constructsProp
    : (staticData?.constructs ?? []);
  const models = Array.isArray(modelsProp) && modelsProp.length > 0
    ? modelsProp
    : (staticData?.models ?? []);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<ReturnType<typeof cytoscape> | null>(null);
  const [showPapers, setShowPapers] = useState(true);
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [snippetLinks, setSnippetLinks] = useState<{ paperId: string; constructIds: string[]; modelIds: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ((Array.isArray(constructsProp) && constructsProp.length > 0) && (Array.isArray(modelsProp) && modelsProp.length > 0)) return;
    let cancelled = false;
    Promise.all([
      import('../data/constructs.json').then((m) => m.default),
      import('../data/models.json').then((m) => m.default),
    ]).then(([c, m]) => {
      if (!cancelled) setStaticData({ constructs: c as Construct[], models: m as Model[] });
    });
    return () => { cancelled = true; };
  }, [constructsProp, modelsProp]);

  const constructById = useMemo(() => {
    const m = new Map<string, Construct>();
    constructs.forEach((c) => m.set(c.id, c));
    return m;
  }, [constructs]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [papersRes, snippetsRes] = await Promise.all([
          supabase.from('saved_papers').select('id, title'),
          supabase.from('snippets').select('paper_id, construct_ids, model_ids, construct_id, model_id'),
        ]);
        if (cancelled) return;
        if (papersRes.error) {
          setError(papersRes.error.message);
          setPapers([]);
          setSnippetLinks([]);
        } else {
          setPapers((papersRes.data ?? []).map((p) => ({ id: p.id, title: p.title })));
        }
        if (snippetsRes.error) {
          setSnippetLinks([]);
        } else {
          const links = (snippetsRes.data ?? []).map((s: any) => {
            let cids = Array.isArray(s.construct_ids) ? s.construct_ids : [];
            let mids = Array.isArray(s.model_ids) ? s.model_ids : [];
            if (s.construct_id && !cids.includes(s.construct_id)) cids = [...cids, s.construct_id];
            if (s.model_id && !mids.includes(s.model_id)) mids = [...mids, s.model_id];
            return { paperId: s.paper_id, constructIds: cids, modelIds: mids };
          });
          setSnippetLinks(links);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const elements = useMemo(() => {
    const nodes: cytoscape.ElementDefinition[] = [];
    const edges: cytoscape.ElementDefinition[] = [];
    const edgeIds = new Set<string>();

    constructs.forEach((c) => {
      nodes.push({
        group: 'nodes',
        data: {
          id: `construct-${c.id}`,
          label: c.name,
          type: 'construct',
          href: `${BASE}constructs/${c.id}/`,
        },
      });
    });

    models.forEach((m) => {
      nodes.push({
        group: 'nodes',
        data: {
          id: `model-${m.id}`,
          label: m.name,
          type: 'model',
          href: `${BASE}models/${m.id}/`,
        },
      });

      const abbrToName = buildAbbrToName(m.constructAbbreviations);

      (m.relationships ?? []).forEach((rel) => {
        const fromName = abbrToName.get(rel.from);
        const toName = abbrToName.get(rel.to);
        const fromId = fromName ? nameToConstructId(fromName, constructs) : null;
        const toId = toName ? nameToConstructId(toName, constructs) : null;
        if (fromId && toId) {
          const eid = `influences-${fromId}-${toId}-${m.id}`;
          if (!edgeIds.has(eid)) {
            edgeIds.add(eid);
            edges.push({
              group: 'edges',
              data: {
                id: eid,
                source: `construct-${fromId}`,
                target: `construct-${toId}`,
                type: 'influences',
                label: 'influences',
              },
            });
          }
        }
      });

      (m.constructs ?? []).forEach((constructName) => {
        const cid = nameToConstructId(constructName, constructs);
        if (cid) {
          const eid = `model-construct-${m.id}-${cid}`;
          if (!edgeIds.has(eid)) {
            edgeIds.add(eid);
            edges.push({
              group: 'edges',
              data: {
                id: eid,
                source: `model-${m.id}`,
                target: `construct-${cid}`,
                type: 'uses',
                label: 'uses',
              },
            });
          }
        }
      });
    });

    papers.forEach((p) => {
      nodes.push({
        group: 'nodes',
        data: {
          id: `paper-${p.id}`,
          label: (p.title && p.title.length > 50 ? p.title.slice(0, 47) + '…' : p.title) || 'Untitled',
          type: 'paper',
          href: `${BASE}papers/detail/?id=${p.id}`,
          fullTitle: p.title,
        },
      });
    });

    snippetLinks.forEach((link) => {
      link.constructIds.forEach((cid) => {
        const eid = `paper-construct-${link.paperId}-${cid}`;
        if (!edgeIds.has(eid)) {
          edgeIds.add(eid);
          edges.push({
            group: 'edges',
            data: {
              id: eid,
              source: `paper-${link.paperId}`,
              target: `construct-${cid}`,
              type: 'supports',
              label: 'supported by',
            },
          });
        }
      });
      link.modelIds.forEach((mid) => {
        const eid = `paper-model-${link.paperId}-${mid}`;
        if (!edgeIds.has(eid)) {
          edgeIds.add(eid);
          edges.push({
            group: 'edges',
            data: {
              id: eid,
              source: `paper-${link.paperId}`,
              target: `model-${mid}`,
              type: 'supports',
              label: 'supported by',
            },
          });
        }
      });
    });

    return [...nodes, ...edges];
  }, [constructs, models, papers, snippetLinks]);

  const initCy = useCallback(() => {
    const container = containerRef.current;
    if (!container || elements.length === 0) return;

    const nodeCount = elements.filter((e) => e.group === 'nodes').length;
    if (nodeCount === 0) return;

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const cy = cytoscape({
      container,
      elements: showPapers ? elements : elements.filter((el) => {
        if (el.group === 'edges') {
          const d = el.data as { source?: string; target?: string; type?: string };
          if (d.type === 'supports') return false;
          if (d.source?.startsWith('paper-') || d.target?.startsWith('paper-')) return false;
          return true;
        }
        return !(el.data as { id?: string }).id?.startsWith('paper-');
      }),
      style: [
        {
          selector: 'node[type="construct"]',
          style: {
            label: 'data(label)',
            'background-color': '#712038',
            color: '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'text-wrap': 'ellipsis',
            'text-max-width': '120px',
            shape: 'round-rectangle',
            padding: '8px',
          },
        },
        {
          selector: 'node[type="model"]',
          style: {
            label: 'data(label)',
            'background-color': '#2d5a27',
            color: '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'text-wrap': 'ellipsis',
            'text-max-width': '100px',
            shape: 'hexagon',
            padding: '8px',
          },
        },
        {
          selector: 'node[type="paper"]',
          style: {
            label: 'data(label)',
            'background-color': '#4a5568',
            color: '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '9px',
            'text-wrap': 'ellipsis',
            'text-max-width': '140px',
            shape: 'ellipse',
            padding: '6px',
          },
        },
        {
          selector: 'node.highlight',
          style: { 'border-width': 3, 'border-color': '#c9a227' },
        },
        {
          selector: 'node.dimmed',
          style: { opacity: 0.25 },
        },
        {
          selector: 'edge[type="influences"]',
          style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': '#712038',
            'target-arrow-color': '#712038',
            width: 2,
          },
        },
        {
          selector: 'edge[type="uses"]',
          style: {
            'curve-style': 'bezier',
            'line-style': 'dashed',
            'line-color': '#2d5a27',
            width: 1.5,
          },
        },
        {
          selector: 'edge[type="supports"]',
          style: {
            'curve-style': 'bezier',
            'line-style': 'dotted',
            'line-color': '#4a5568',
            width: 1,
          },
        },
        {
          selector: 'edge.dimmed',
          style: { opacity: 0.2 },
        },
      ],
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    cy.layout({ name: 'cose', padding: 40, animate: false, nodeRepulsion: 8000 }).run();

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const all = cy.elements();
      all.removeClass('highlight dimmed');
      const neighborhood = node.neighborhood();
      node.addClass('highlight');
      neighborhood.addClass('highlight');
      const others = all.not(node).not(neighborhood);
      others.addClass('dimmed');
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlight dimmed');
      }
    });

    cy.on('dbltap', 'node', (evt) => {
      const node = evt.target;
      const href = node.data('href');
      if (href) window.location.href = href;
    });

    cyRef.current = cy;
  }, [elements, showPapers]);

  useEffect(() => {
    if (loading) return;
    const raf = requestAnimationFrame(() => {
      initCy();
    });
    return () => {
      cancelAnimationFrame(raf);
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [loading, initCy]);

  const handleShowPapersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowPapers(e.target.checked);
  };

  if (loading) {
    return <div className="theory-map-loading">Loading graph data…</div>;
  }

  return (
    <div className="theory-map-container">
      <div className="theory-map-toolbar">
        <label className="theory-map-toggle">
          <input type="checkbox" checked={showPapers} onChange={handleShowPapersChange} />
          <span>Show papers</span>
        </label>
        <span className="theory-map-legend">
          <span className="theory-map-legend-node theory-map-legend-construct" /> Construct
          <span className="theory-map-legend-node theory-map-legend-model" /> Model
          <span className="theory-map-legend-node theory-map-legend-paper" /> Paper
        </span>
      </div>
      {error && <p className="theory-map-error">{error}</p>}
      <div ref={containerRef} className="theory-map-cy" style={{ height: '500px', minHeight: '500px' }} />
      <p className="theory-map-hint">Click a node to highlight its connections. Drag to pan, scroll to zoom.</p>
    </div>
  );
}

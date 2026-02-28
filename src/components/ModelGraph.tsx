import React, { useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  Handle,
  Position,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;
const LEVEL_GAP = 80;
const NODE_GAP = 24;

interface ModelGraphProps {
  model: {
    constructs: string[];
    constructAbbreviations?: Record<string, string>;
    relationships: { from: string; to: string }[];
  };
  constructToSlug: Record<string, string>;
}

function constructToId(name: string, abbrevMap?: Record<string, string>): string {
  if (abbrevMap?.[name]) return abbrevMap[name];
  return name.replace(/\s+/g, '-').slice(0, 15);
}

/** Layered layout: assign each node a level (0 = no incoming edges), then position left-to-right by level. */
function getLayeredLayout(
  constructList: string[],
  relationships: { from: string; to: string }[],
  abbrevMap: Record<string, string>
): Map<string, { x: number; y: number }> {
  const id = (n: string) => constructToId(n, abbrevMap);
  const ids = new Set(constructList.map((c) => id(c)));
  const inDegree: Record<string, number> = {};
  const predecessors: Record<string, string[]> = {};
  ids.forEach((i) => {
    inDegree[i] = 0;
    predecessors[i] = [];
  });
  relationships.forEach((r) => {
    if (ids.has(r.from) && ids.has(r.to) && r.from !== r.to) {
      inDegree[r.to] = (inDegree[r.to] ?? 0) + 1;
      if (!predecessors[r.to].includes(r.from)) predecessors[r.to].push(r.from);
    }
  });

  const level: Record<string, number> = {};
  const getLevel = (nodeId: string): number => {
    if (level[nodeId] != null) return level[nodeId];
    const preds = predecessors[nodeId] || [];
    if (preds.length === 0) {
      level[nodeId] = 0;
      return 0;
    }
    const l = 1 + Math.max(...preds.map(getLevel));
    level[nodeId] = l;
    return l;
  };
  ids.forEach((i) => getLevel(i));

  const byLevel = new Map<number, string[]>();
  ids.forEach((i) => {
    const L = level[i];
    if (!byLevel.has(L)) byLevel.set(L, []);
    byLevel.get(L)!.push(i);
  });

  const positions = new Map<string, { x: number; y: number }>();
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  levels.forEach((lev) => {
    const nodes = byLevel.get(lev)!;
    const totalH = nodes.length * NODE_HEIGHT + (nodes.length - 1) * NODE_GAP;
    nodes.forEach((nodeId, idx) => {
      const x = lev * (NODE_WIDTH + LEVEL_GAP) + 20;
      const y = idx * (NODE_HEIGHT + NODE_GAP) + 20;
      positions.set(nodeId, { x, y });
    });
  });

  return positions;
}

function ConstructBoxNode({
  data,
}: {
  data: { label: string; fullName: string; href: string };
}) {
  return (
    <div className="model-diagram-box">
      <Handle type="target" position={Position.Left} className="model-diagram-handle" />
      <a href={data.href} className="model-diagram-box-link">
        <span className="model-diagram-box-abbrev">{data.label}</span>
        <span className="model-diagram-box-name">{data.fullName}</span>
      </a>
      <Handle type="source" position={Position.Right} className="model-diagram-handle" />
    </div>
  );
}

const nodeTypes = { construct: ConstructBoxNode };

export default function ModelGraph({ model, constructToSlug }: ModelGraphProps) {
  const abbrevMap = model.constructAbbreviations || {};
  const constructList = model.constructs;

  const positionMap = useMemo(
    () => getLayeredLayout(constructList, model.relationships, abbrevMap),
    [constructList, model.relationships, abbrevMap]
  );

  const initialNodes: Node[] = useMemo(() => {
    return constructList.map((name) => {
      const id = constructToId(name, abbrevMap);
      const pos = positionMap.get(id) ?? { x: 20, y: 20 };
      const slug = constructToSlug[name];
      return {
        id,
        data: {
          label: abbrevMap[name] || name,
          fullName: name,
          href: slug ? `${import.meta.env.BASE_URL}constructs/${slug}/` : '#',
        },
        position: pos,
        type: 'construct',
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    });
  }, [constructList, abbrevMap, constructToSlug, positionMap]);

  const initialEdges: Edge[] = useMemo(() => {
    return model.relationships.map((r, i) => ({
      id: `e${i}`,
      source: r.from,
      target: r.to,
      markerEnd: { type: MarkerType.ArrowClosed },
      type: 'smoothstep',
      style: { strokeWidth: 2, stroke: 'var(--color-ink-muted)' },
    }));
  }, [model.relationships]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (initialNodes.length === 0) {
    return (
      <div className="model-graph-wrapper model-diagram-root model-diagram-empty">
        <p>No constructs to display.</p>
      </div>
    );
  }

  return (
    <div
      className="model-graph-wrapper model-diagram-root"
      style={{
        width: '100%',
        height: 480,
        minHeight: 480,
        position: 'relative',
        background: 'var(--color-bg-alt, #f0e9e0)',
        borderRadius: 12,
        border: '1px solid var(--color-border, #e0d6cc)',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        style={{ width: '100%', height: '100%' }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

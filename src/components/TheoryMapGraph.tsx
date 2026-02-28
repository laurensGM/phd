import React, { useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

function ConstructLinkNode({ data }: { data: { label: string; href: string } }) {
  return (
    <div className="theory-map-construct-node">
      <Handle type="target" position={Position.Left} />
      <a href={data.href} className="theory-map-link">{data.label}</a>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { constructLink: ConstructLinkNode };

interface Model {
  id: string;
  name: string;
  abbreviation: string;
  constructs: string[];
}

interface TheoryMapGraphProps {
  models: Model[];
  constructToSlug: Record<string, string>;
}

export default function TheoryMapGraph({ models, constructToSlug }: TheoryMapGraphProps) {
  const sharedConstructs = useMemo(() => {
    const counts: Record<string, string[]> = {};
    models.forEach((m) => {
      m.constructs.forEach((c) => {
        if (!counts[c]) counts[c] = [];
        counts[c].push(m.abbreviation);
      });
    });
    return Object.entries(counts).filter(([, mods]) => mods.length > 1);
  }, [models]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let y = 20;

    models.forEach((m, i) => {
      nodes.push({
        id: m.id,
        data: { label: m.abbreviation },
        position: { x: 20, y: y + i * 80 },
        type: 'default',
        style: {
          background: 'var(--color-accent)',
          color: 'white',
          fontWeight: 600,
          border: '2px solid var(--color-accent-hover)',
        },
      });
    });

    y += models.length * 80 + 40;
    sharedConstructs.forEach(([construct, mods], i) => {
      const slug = constructToSlug[construct];
      const nodeId = `construct-${construct.replace(/\s+/g, '-')}`;
      nodes.push({
        id: nodeId,
        data: {
          label: construct,
          href: slug ? `${import.meta.env.BASE_URL}constructs/${slug}/` : '#',
        },
        position: { x: 120, y: y + i * 60 },
        type: 'constructLink',
        style: {
          background: 'var(--color-bg-alt)',
          border: '1px solid var(--color-border)',
        },
      });
      mods.forEach((abbrev) => {
        const modelId = models.find((x) => x.abbreviation === abbrev)?.id;
        if (modelId) {
          edges.push({
            id: `e-${modelId}-${nodeId}`,
            source: modelId,
            target: nodeId,
            markerEnd: { type: MarkerType.ArrowClosed },
          });
        }
      });
    });

    return { nodes, edges };
  }, [models, sharedConstructs, constructToSlug]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div style={{ width: '100%', height: 500, border: '1px solid var(--color-border)', borderRadius: 8 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

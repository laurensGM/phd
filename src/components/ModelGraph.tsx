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

interface ModelGraphProps {
  model: {
    constructs: string[];
    constructAbbreviations?: Record<string, string>;
    relationships: { from: string; to: string }[];
  };
  constructToSlug: Record<string, string>;
}

function ConstructNode({ data }: { data: { label: string; href: string } }) {
  return (
    <div className="react-flow__construct-node">
      <Handle type="target" position={Position.Top} />
      <a href={data.href} className="construct-node-link">
        {data.label}
      </a>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { construct: ConstructNode };

function constructToId(name: string, abbrevMap?: Record<string, string>): string {
  if (abbrevMap?.[name]) return abbrevMap[name];
  return name.replace(/\s+/g, '-').slice(0, 15);
}

export default function ModelGraph({ model, constructToSlug }: ModelGraphProps) {
  const abbrevMap = model.constructAbbreviations || {};
  const constructList = model.constructs;

  const initialNodes: Node[] = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(constructList.length));
    return constructList.map((name, i) => {
      const id = constructToId(name, abbrevMap);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const slug = constructToSlug[name];
      return {
        id,
        data: {
          label: abbrevMap[name] || name,
          href: slug ? `${import.meta.env.BASE_URL}constructs/${slug}/` : '#',
        },
        position: { x: col * 180 + 20, y: row * 100 + 20 },
        type: 'construct',
      };
    });
  }, [model, constructToSlug]);

  const initialEdges: Edge[] = useMemo(() => {
    return model.relationships.map((r, i) => ({
      id: `e${i}`,
      source: r.from,
      target: r.to,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
  }, [model.relationships]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="model-graph-wrapper" style={{ width: '100%', height: 420 }}>
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

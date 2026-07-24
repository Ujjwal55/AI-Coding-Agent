"use client";

import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "@/components/CustomNode";

const nodeTypes = {
  custom: CustomNode,
};

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  locked?: boolean;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onInit: (instance: ReactFlowInstance) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
}

export default function WorkflowCanvas({
  nodes,
  edges,
  locked = false,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onInit,
  onDrop,
  onDragOver,
}: WorkflowCanvasProps) {
  return (
    <div className="relative min-h-0 flex-1 bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={locked ? () => undefined : onNodesChange}
        onEdgesChange={locked ? () => undefined : onEdgesChange}
        onConnect={locked ? () => undefined : onConnect}
        onInit={onInit}
        onDrop={locked ? () => undefined : onDrop}
        onDragOver={locked ? (e) => e.preventDefault() : onDragOver}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        elementsSelectable
        fitView
        className="h-full w-full"
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

"use client";

import { LIBRARY_NODE_TYPES } from "@/application/nodeRegistry";
import { Plus } from "lucide-react";

interface NodeLibraryProps {
  locked?: boolean;
  onDragStart: (
    event: React.DragEvent,
    nodeType: string,
    label: string,
  ) => void;
  onAddNode?: (nodeType: string, label: string) => void;
}

export default function NodeLibrary({
  locked = false,
  onDragStart,
  onAddNode,
}: NodeLibraryProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">Node Library</h2>
        <span className="text-[10px] font-semibold uppercase text-slate-400">
          L2
        </span>
      </div>
      <div className="space-y-2 overflow-y-auto">
        {LIBRARY_NODE_TYPES.map((node) => (
          <div
            key={node.type}
            draggable={!locked}
            onDragStart={(e) => {
              if (locked) return;
              onDragStart(e, node.type, node.label);
            }}
            onClick={() => {
              if (locked) return;
              onAddNode?.(node.type, node.label);
            }}
            title={locked ? "Workflow is running" : "Click to add node to canvas or drag"}
            className={`group flex items-center justify-between rounded border border-slate-200 bg-slate-100 p-2.5 text-sm font-medium text-slate-700 transition-all ${
              locked
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 active:scale-[0.98]"
            }`}
          >
            <span>{node.libraryLabel}</span>
            <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-sky-600 transition-opacity" />
          </div>
        ))}
      </div>
    </aside>
  );
}

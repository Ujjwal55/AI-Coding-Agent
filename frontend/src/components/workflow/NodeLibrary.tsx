"use client";

import { LIBRARY_NODE_TYPES } from "@/application/nodeRegistry";

interface NodeLibraryProps {
  locked?: boolean;
  onDragStart: (
    event: React.DragEvent,
    nodeType: string,
    label: string,
  ) => void;
}

export default function NodeLibrary({
  locked = false,
  onDragStart,
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
            className={`rounded border border-slate-200 bg-slate-100 p-2.5 text-sm font-medium text-slate-700 transition-colors ${
              locked
                ? "cursor-not-allowed opacity-60"
                : "cursor-grab hover:bg-slate-200 active:cursor-grabbing"
            }`}
          >
            {node.libraryLabel}
          </div>
        ))}
      </div>
    </aside>
  );
}

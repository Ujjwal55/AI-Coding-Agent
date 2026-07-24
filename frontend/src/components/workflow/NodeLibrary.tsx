"use client";

import { LIBRARY_NODE_TYPES } from "@/application/nodeRegistry";
import {
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Play,
  Plus,
  ScanSearch,
  Settings,
  Split,
  Target,
  User,
} from "lucide-react";

interface NodeLibraryProps {
  locked?: boolean;
  onDragStart: (
    event: React.DragEvent,
    nodeType: string,
    label: string,
  ) => void;
  onAddNode?: (nodeType: string, label: string) => void;
}

const libraryIcons: Record<string, React.ReactNode> = {
  objective: <Target className="h-4 w-4 text-purple-600" />,
  criteria: <Settings className="h-4 w-4 text-pink-600" />,
  code_understanding: <ScanSearch className="h-4 w-4 text-cyan-600" />,
  planner: <Cpu className="h-4 w-4 text-blue-600" />,
  plan_review: <ClipboardCheck className="h-4 w-4 text-sky-600" />,
  executor: <Play className="h-4 w-4 text-green-600" />,
  validator: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  decision: <Split className="h-4 w-4 text-indigo-600" />,
  human_gate: <User className="h-4 w-4 text-amber-600" />,
};

const libraryTint: Record<string, string> = {
  objective: "border-purple-200 bg-purple-50 hover:border-purple-300",
  criteria: "border-pink-200 bg-pink-50 hover:border-pink-300",
  code_understanding: "border-cyan-200 bg-cyan-50 hover:border-cyan-300",
  planner: "border-blue-200 bg-blue-50 hover:border-blue-300",
  plan_review: "border-sky-200 bg-sky-50 hover:border-sky-300",
  executor: "border-green-200 bg-green-50 hover:border-green-300",
  validator: "border-emerald-200 bg-emerald-50 hover:border-emerald-300",
  decision: "border-indigo-200 bg-indigo-50 hover:border-indigo-300",
  human_gate: "border-amber-200 bg-amber-50 hover:border-amber-300",
};

export default function NodeLibrary({
  locked = false,
  onDragStart,
  onAddNode,
}: NodeLibraryProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-3">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-800">Node Library</h2>
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
            title={
              locked
                ? "Workflow is running"
                : "Click to add node to canvas or drag"
            }
            className={`group flex items-center justify-between rounded-md border p-2.5 text-sm font-medium text-slate-800 transition-all ${
              libraryTint[node.type] || "border-slate-200 bg-slate-50"
            } ${
              locked
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:shadow-sm active:scale-[0.98]"
            }`}
          >
            <span className="flex items-center gap-2">
              {libraryIcons[node.type] || (
                <Settings className="h-4 w-4 text-slate-500" />
              )}
              {node.libraryLabel}
            </span>
            <Plus className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </aside>
  );
}

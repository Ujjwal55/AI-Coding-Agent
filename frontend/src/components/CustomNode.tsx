import React from "react";
import { Handle, Position } from "@xyflow/react";
import {
  CheckCircle2,
  Settings,
  Play,
  StopCircle,
  User,
  Target,
  Cpu,
  Split,
  Loader2,
  XCircle,
  Clock,
} from "lucide-react";
import type { NodeRunStatus } from "@/domain/types";

const iconMap: Record<string, React.ReactNode> = {
  objective: <Target className="h-4 w-4 text-purple-600" />,
  criteria: <Settings className="h-4 w-4 text-pink-600" />,
  planner: <Cpu className="h-4 w-4 text-blue-600" />,
  executor: <Play className="h-4 w-4 text-green-600" />,
  validator: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  human_gate: <User className="h-4 w-4 text-amber-600" />,
  decision: <Split className="h-4 w-4 text-indigo-600" />,
  end: <StopCircle className="h-4 w-4 text-red-600" />,
};

const statusStyleMap: Record<string, string> = {
  completed: "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md ring-2 ring-emerald-400/50",
  in_progress: "border-blue-500 bg-blue-50 text-blue-900 shadow-md ring-2 ring-blue-400/50 animate-pulse",
  running: "border-blue-500 bg-blue-50 text-blue-900 shadow-md ring-2 ring-blue-400/50 animate-pulse",
  failed: "border-red-500 bg-red-50 text-red-900 shadow-md ring-2 ring-red-400/50",
  waiting: "border-amber-500 bg-amber-50 text-amber-900 shadow-md ring-2 ring-amber-400/50",
  pending: "border-slate-300 bg-white text-slate-800",
};

const statusBadgeMap: Record<string, React.ReactNode> = {
  completed: (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded">
      <CheckCircle2 className="h-3 w-3" /> DONE
    </span>
  ),
  in_progress: (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded animate-pulse">
      <Loader2 className="h-3 w-3 animate-spin" /> RUNNING
    </span>
  ),
  running: (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded animate-pulse">
      <Loader2 className="h-3 w-3 animate-spin" /> RUNNING
    </span>
  ),
  failed: (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-red-200 text-red-800 rounded">
      <XCircle className="h-3 w-3" /> FAILED
    </span>
  ),
  waiting: (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded">
      <Clock className="h-3 w-3" /> PAUSED
    </span>
  ),
  pending: null,
};

export default function CustomNode({ data, isConnectable }: any) {
  const type = data?.nodeType || "planner";
  const status = data?.status || "pending";
  const icon = iconMap[type] || <Settings className="h-4 w-4 text-slate-600" />;
  const style = statusStyleMap[status] || "border-slate-300 bg-white text-slate-800";

  return (
    <div
      className={`min-w-[170px] rounded-md border-2 px-4 py-2.5 shadow-sm transition-all duration-200 ${style}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="h-2.5 w-2.5 !bg-slate-400"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {String(type).replace("_", " ")}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {data?.label || type}
            </span>
          </div>
        </div>
        <div>{statusBadgeMap[status]}</div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="h-2.5 w-2.5 !bg-slate-400"
      />
    </div>
  );
}

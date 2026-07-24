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
  Circle,
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

const colorMap: Record<string, string> = {
  objective: "border-purple-200 bg-purple-50",
  criteria: "border-pink-200 bg-pink-50",
  planner: "border-blue-200 bg-blue-50",
  executor: "border-green-200 bg-green-50",
  validator: "border-emerald-200 bg-emerald-50",
  human_gate: "border-amber-200 bg-amber-50",
  decision: "border-indigo-200 bg-indigo-50",
  end: "border-red-200 bg-red-50",
};

const statusIcon: Record<NodeRunStatus, React.ReactNode> = {
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-600" />,
  waiting: <Clock className="h-3.5 w-3.5 text-sky-600" />,
  pending: <Circle className="h-3.5 w-3.5 text-slate-300" />,
};

const statusRing: Record<NodeRunStatus, string> = {
  completed: "ring-2 ring-emerald-300",
  running: "ring-2 ring-amber-300",
  failed: "ring-2 ring-red-300",
  waiting: "ring-2 ring-sky-300",
  pending: "",
};

export default function CustomNode({ data, isConnectable }: any) {
  const type = data.nodeType || "planner";
  const status = (data.status as NodeRunStatus) || "pending";
  const icon = iconMap[type] || <Settings className="h-4 w-4 text-slate-600" />;
  const colors = colorMap[type] || "border-slate-200 bg-white";

  return (
    <div
      className={`min-w-[150px] rounded-md border-2 px-4 py-2 shadow-sm ${colors} ${statusRing[status]}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="h-2 w-2 !bg-slate-400"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {String(type).replace("_", " ")}
            </span>
            <span className="text-sm font-medium text-slate-900">
              {data.label}
            </span>
          </div>
        </div>
        <div title={status}>{statusIcon[status]}</div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="h-2 w-2 !bg-slate-400"
      />
    </div>
  );
}

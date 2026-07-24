import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  CheckCircle2,
  Settings,
  Play,
  StopCircle,
  User,
  Target,
  Cpu,
  Split,
  ScanSearch,
  ClipboardCheck,
  Loader2,
  XCircle,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  objective: <Target className="w-4 h-4 text-purple-600" />,
  criteria: <Settings className="w-4 h-4 text-pink-600" />,
  code_understanding: <ScanSearch className="w-4 h-4 text-cyan-600" />,
  planner: <Cpu className="w-4 h-4 text-blue-600" />,
  plan_review: <ClipboardCheck className="w-4 h-4 text-sky-600" />,
  executor: <Play className="w-4 h-4 text-green-600" />,
  validator: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  human_gate: <User className="w-4 h-4 text-amber-600" />,
  decision: <Split className="w-4 h-4 text-indigo-600" />,
  end: <StopCircle className="w-4 h-4 text-red-600" />,
};

const colorMap: Record<string, string> = {
  objective: 'border-purple-200 bg-purple-50',
  criteria: 'border-pink-200 bg-pink-50',
  code_understanding: 'border-cyan-200 bg-cyan-50',
  planner: 'border-blue-200 bg-blue-50',
  plan_review: 'border-sky-200 bg-sky-50',
  executor: 'border-green-200 bg-green-50',
  validator: 'border-emerald-200 bg-emerald-50',
  human_gate: 'border-amber-200 bg-amber-50',
  decision: 'border-indigo-200 bg-indigo-50',
  end: 'border-red-200 bg-red-50',
};

// Ring + accent applied on top of the base color to reflect live run status.
const statusRing: Record<string, string> = {
  running: 'ring-2 ring-amber-400 shadow-amber-100',
  completed: 'ring-2 ring-emerald-400',
  failed: 'ring-2 ring-red-400',
  waiting: 'ring-2 ring-sky-400 animate-pulse',
  pending: '',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'running') {
    return <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />;
  }
  if (status === 'completed') {
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  }
  if (status === 'failed') {
    return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  }
  if (status === 'waiting') {
    return <User className="w-3.5 h-3.5 text-sky-500" />;
  }
  return null;
}

interface CustomNodeProps {
  data?: { nodeType?: string; label?: string; status?: string };
  isConnectable?: boolean;
}

export default function CustomNode({ data, isConnectable }: CustomNodeProps) {
  const type = data?.nodeType || 'planner';
  const status = data?.status || 'pending';
  const icon = iconMap[type] || <Settings className="w-4 h-4 text-slate-600" />;
  const colors = colorMap[type] || 'border-slate-200 bg-white';
  const ring = statusRing[status] || '';

  return (
    <div
      className={`px-4 py-2 shadow-sm rounded-md border-2 ${colors} ${ring} min-w-[160px] transition-all`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2 !bg-slate-400"
      />

      <div className="flex items-center gap-2">
        {icon}
        <div className="flex flex-1 flex-col">
          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
            {type.replace(/_/g, ' ')}
          </span>
          <span className="text-sm font-medium text-slate-900">
            {data?.label || 'Node'}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-2 h-2 !bg-slate-400"
      />
    </div>
  );
}

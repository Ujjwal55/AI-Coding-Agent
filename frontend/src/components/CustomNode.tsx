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
  Split 
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  objective: <Target className="w-4 h-4 text-purple-600" />,
  criteria: <Settings className="w-4 h-4 text-pink-600" />,
  planner: <Cpu className="w-4 h-4 text-blue-600" />,
  executor: <Play className="w-4 h-4 text-green-600" />,
  validator: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  human_gate: <User className="w-4 h-4 text-amber-600" />,
  decision: <Split className="w-4 h-4 text-indigo-600" />,
  end: <StopCircle className="w-4 h-4 text-red-600" />,
};

const colorMap: Record<string, string> = {
  objective: 'border-purple-200 bg-purple-50',
  criteria: 'border-pink-200 bg-pink-50',
  planner: 'border-blue-200 bg-blue-50',
  executor: 'border-green-200 bg-green-50',
  validator: 'border-emerald-200 bg-emerald-50',
  human_gate: 'border-amber-200 bg-amber-50',
  decision: 'border-indigo-200 bg-indigo-50',
  end: 'border-red-200 bg-red-50',
};

export default function CustomNode({ data, isConnectable }: any) {
  const type = data?.nodeType || 'planner';
  const icon = iconMap[type] || <Settings className="w-4 h-4 text-slate-600" />;
  const colors = colorMap[type] || 'border-slate-200 bg-white';

  return (
    <div className={`px-4 py-2 shadow-sm rounded-md border-2 ${colors} min-w-[150px]`}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-2 h-2 !bg-slate-400" />
      
      <div className="flex items-center gap-2">
        {icon}
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{type.replace('_', ' ')}</span>
          <span className="text-sm font-medium text-slate-900">{data?.label || 'Node'}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-2 h-2 !bg-slate-400" />
    </div>
  );
}

import React from 'react';
import { Clock, DollarSign, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SubTask } from '../types';

interface TaskCardProps {
  task: SubTask;
  index: number;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const getSensitivityColor = (sens: 'high' | 'low') => {
    return sens === 'high' 
      ? 'border-amber-500/25 bg-amber-500/5 text-amber-500' 
      : 'border-zinc-800 bg-zinc-900/50 text-zinc-400';
  };

  const getBackendLabel = (backend: string) => {
    switch (backend) {
      case 'local_qwen3': return 'LOCAL';
      case 'groq': return 'GROQ';
      case 'gemini': return 'GEMINI';
      default: return backend.toUpperCase();
    }
  };

  const getStatusBorder = (status?: string) => {
    switch (status) {
      case 'running': return 'border-accent/40 bg-[#0d0d0d]';
      case 'completed': return 'border-zinc-800/80 bg-zinc-950/20';
      case 'error': return 'border-rose-950 bg-rose-950/5';
      default: return 'border-zinc-900/60 opacity-60';
    }
  };

  return (
    <div className={`border rounded p-3.5 flex flex-col justify-between transition-all duration-300 h-72 ${getStatusBorder(task.status)}`}>
      {/* Top Header info */}
      <div>
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-900/50">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-xs text-zinc-400 uppercase tracking-wider">{task.id}</span>
            <span className="text-[9px] font-mono border border-zinc-800 text-zinc-500 px-1 rounded-sm">
              {getBackendLabel(task.backend)}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 select-none">
            <span className={`text-[8px] font-mono px-1 py-0.5 rounded-sm border uppercase ${getSensitivityColor(task.sensitivity)}`}>
              {task.sensitivity}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-300 font-sans leading-relaxed line-clamp-2 select-none mb-3" title={task.description}>
          {task.description}
        </p>

        {/* Blocking Dependencies message */}
        {task.status === 'pending' && task.depends_on.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono italic animate-pulse py-1">
            <Clock className="w-3 h-3" />
            <span>Waiting for: {task.depends_on.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Output streaming box */}
      <div className="flex-1 border border-zinc-950 bg-[#070707] p-2.5 rounded text-[11px] font-mono text-zinc-400 overflow-y-auto mb-3 select-text select-none">
        {task.status === 'running' && !task.output && (
          <span className="text-zinc-600 italic cursor-blink">Initializing pipeline...</span>
        )}
        {task.output ? (
          <div className={task.status === 'running' ? 'cursor-blink whitespace-pre-wrap' : 'whitespace-pre-wrap'}>
            {task.output}
          </div>
        ) : task.status === 'pending' ? (
          <span className="text-zinc-700 italic">Queue standby</span>
        ) : null}
      </div>

      {/* Footer Metrics */}
      <div className="flex items-center justify-between border-t border-zinc-900/50 pt-2 text-[10px] font-mono text-zinc-500 select-none">
        <div className="flex items-center gap-3">
          {task.status === 'completed' && (
            <>
              <div className="flex items-center gap-1 text-zinc-400">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>{task.latency_ms}ms</span>
              </div>
              {task.cost_usd > 0 && (
                <div className="flex items-center gap-0.5 text-zinc-400">
                  <DollarSign className="w-3 h-3 text-zinc-500" />
                  <span>{task.cost_usd.toFixed(6)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Status markers */}
        <div className="flex items-center">
          {task.status === 'completed' ? (
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-[9px] uppercase tracking-wider">DONE</span>
            </span>
          ) : task.status === 'running' ? (
            <span className="flex items-center gap-1.5 text-accent">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-[9px] uppercase tracking-wider">ACTIVE</span>
            </span>
          ) : task.status === 'error' ? (
            <span className="flex items-center gap-1 text-rose-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-[9px] uppercase tracking-wider font-bold">FAIL</span>
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-zinc-800" title="Queued" />
          )}
        </div>
      </div>
    </div>
  );
};
export default TaskCard;

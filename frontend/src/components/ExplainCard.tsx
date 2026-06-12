import React, { useState } from 'react';
import { HelpCircle, X, Cpu, Cloud, Lock, Zap } from 'lucide-react';
import { TaskResult, SubTask } from '../types';

interface ExplainCardProps {
  tasks: SubTask[];
  audit: TaskResult[];
  redactedKeys: string[];
}

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}
function fmtCost(usd: number): string {
  if (usd === 0) return 'free';
  if (usd < 0.001) return `$${(usd * 100).toFixed(4)}¢`;
  return `$${usd.toFixed(4)}`;
}

const BACKEND_LABEL: Record<string, string> = {
  local_qwen3: 'your laptop (Qwen3)',
  groq: 'Groq',
  gemini: 'Gemini',
};

export const ExplainCard: React.FC<ExplainCardProps> = ({ tasks, audit, redactedKeys }) => {
  const [open, setOpen] = useState(false);

  if (audit.length === 0) return null;

  const totalCost = audit.reduce((s, r) => s + r.cost_usd, 0);
  const localCount = audit.filter(r => r.backend === 'local_qwen3').length;
  const cloudCount = audit.length - localCount;

  // Build human-readable step list
  const steps: { icon: React.ReactNode; text: string }[] = [];

  steps.push({
    icon: <Zap className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />,
    text: `Split your question into ${tasks.length} part${tasks.length !== 1 ? 's' : ''}, run in parallel`,
  });

  const localTasks = audit.filter(r => r.backend === 'local_qwen3');
  if (localTasks.length > 0) {
    const totalTokens = localTasks.reduce((s, r) => s + r.token_count, 0);
    steps.push({
      icon: <Cpu className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />,
      text: `Processed ${localTasks.length} task${localTasks.length !== 1 ? 's' : ''} locally on your machine — free, private (${totalTokens.toLocaleString()} tokens)`,
    });
  }

  const cloudTasks = audit.filter(r => r.backend !== 'local_qwen3');
  cloudTasks.forEach(r => {
    const label = BACKEND_LABEL[r.backend] ?? r.backend;
    const withheld = r.redacted_keys.length > 0
      ? ` · ${r.redacted_keys.length} secret${r.redacted_keys.length !== 1 ? 's' : ''} withheld`
      : '';
    steps.push({
      icon: <Cloud className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />,
      text: `Asked ${label} for analysis (${fmtCost(r.cost_usd)} · ${fmt(r.latency_ms)}${withheld})`,
    });
  });

  steps.push({
    icon: <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />,
    text: `Combined everything locally. ${redactedKeys.length > 0 ? `Your secrets (${redactedKeys.join(', ')}) never left your machine.` : 'Your data stayed private.'}`,
  });

  return (
    <div className="relative">
      {/* ? trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        id="explain-btn"
        className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer ${
          open
            ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <HelpCircle className="w-3 h-3" />
        WHAT JUST HAPPENED?
      </button>

      {/* Dropdown card */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-900 bg-[#0d0d0d]">
            <span className="text-[11px] font-mono font-semibold text-zinc-200 uppercase tracking-wider">
              What Prism just did
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Steps */}
          <div className="px-4 py-3 space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300 leading-relaxed">
                <span className="pt-0.5">→</span>
                {step.icon}
                <span>{step.text}</span>
              </div>
            ))}
          </div>

          {/* Footer summary */}
          <div className="px-4 py-2.5 border-t border-zinc-900 bg-[#0d0d0d]">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span>
                {localCount} local · {cloudCount} cloud
              </span>
              <span className={totalCost === 0 ? 'text-emerald-500' : 'text-zinc-400'}>
                Total cost: {fmtCost(totalCost)}
              </span>
            </div>
            {redactedKeys.length > 0 && (
              <p className="text-[10px] font-mono text-emerald-500 mt-1">
                Your secrets never left your machine.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplainCard;

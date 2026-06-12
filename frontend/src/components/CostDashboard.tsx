import React, { useMemo, useState } from 'react';
import { X, DollarSign, TrendingDown, Copy, Check, Shield } from 'lucide-react';
import { HistorySession } from '../types';

interface CostDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistorySession[];
}

/** GPT-4o pricing: $15/M input tokens ≈ $0.000015/token */
const GPT4O_RATE_PER_TOKEN = 0.000015;

interface SessionCostRow {
  label: string;
  localTokens: number;
  cloudTokens: number;
  cloudCostPaid: number;   // actual cost_usd from audit
  gpt4oCost: number;       // what you'd have paid if all-GPT-4o
}

export const CostDashboard: React.FC<CostDashboardProps> = ({ isOpen, onClose, history }) => {
  const [copied, setCopied] = useState(false);

  const rows: SessionCostRow[] = useMemo(() =>
    history.slice(-10).map((session, i) => {
      const localTokens = session.results
        .filter(r => r.backend === 'local_qwen3')
        .reduce((s, r) => s + r.token_count, 0);
      const cloudTokens = session.results
        .filter(r => r.backend !== 'local_qwen3')
        .reduce((s, r) => s + r.token_count, 0);
      const cloudCostPaid = session.results.reduce((s, r) => s + r.cost_usd, 0);
      const totalTokens = localTokens + cloudTokens;
      const gpt4oCost = totalTokens * GPT4O_RATE_PER_TOKEN;

      return {
        label: `#${history.length - (history.length - 1 - i)}`,
        localTokens,
        cloudTokens,
        cloudCostPaid,
        gpt4oCost,
      };
    }),
  [history]);

  const totals = useMemo(() => {
    const paid = rows.reduce((s, r) => s + r.cloudCostPaid, 0);
    const gpt4o = rows.reduce((s, r) => s + r.gpt4oCost, 0);
    const saved = Math.max(0, gpt4o - paid);
    const localToks = rows.reduce((s, r) => s + r.localTokens, 0);
    const cloudToks = rows.reduce((s, r) => s + r.cloudTokens, 0);
    const pct = gpt4o > 0 ? Math.round((saved / gpt4o) * 100) : 0;
    return { paid, gpt4o, saved, localToks, cloudToks, pct };
  }, [rows]);

  const maxCost = Math.max(...rows.map(r => r.gpt4oCost), 0.000001);

  const handleCopyStats = async () => {
    const md = [
      `## Prism Cost Summary`,
      `- Sessions run: ${history.length}`,
      `- Total API cost paid: $${totals.paid.toFixed(5)}`,
      `- GPT-4o equivalent: $${totals.gpt4o.toFixed(5)}`,
      `- Saved: $${totals.saved.toFixed(5)} (${totals.pct}%)`,
      `- Local (private) tokens: ${totals.localToks.toLocaleString()}`,
      `- Cloud tokens: ${totals.cloudToks.toLocaleString()}`,
    ].join('\n');

    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-lg z-50 bg-[#0a0a0a] border-l border-border flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-mono font-semibold text-zinc-200 uppercase tracking-wider">
              Cost & Savings
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-600">
              <DollarSign className="w-8 h-8" />
              <p className="text-sm font-mono">No sessions yet. Run a query to see cost data.</p>
            </div>
          ) : (
            <>
              {/* Big number cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">You Paid (Prism)</p>
                  <p className="text-2xl font-bold text-zinc-200 mt-1 font-mono">${totals.paid.toFixed(4)}</p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-0.5">Groq + Gemini actual charges</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">GPT-4o Equivalent</p>
                  <p className="text-2xl font-bold text-zinc-400 mt-1 font-mono">${totals.gpt4o.toFixed(4)}</p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-0.5">Same tokens @ $0.000015/tok</p>
                </div>
              </div>

              {/* Savings highlight */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-mono">Total saved vs. all-GPT-4o</p>
                  <p className="text-3xl font-bold text-emerald-400 font-mono">
                    ${totals.saved.toFixed(4)}
                    <span className="text-sm text-emerald-600 ml-2">({totals.pct}%)</span>
                  </p>
                </div>
              </div>

              {/* Local vs Cloud token breakdown */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 space-y-2">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Token Distribution</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
                      <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5 text-teal-500" /> Local (free)</span>
                      <span className="text-zinc-300">{totals.localToks.toLocaleString()} tok</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${totals.localToks + totals.cloudToks > 0 ? (totals.localToks / (totals.localToks + totals.cloudToks)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
                      <span className="text-sky-400">Cloud (Groq + Gemini)</span>
                      <span className="text-zinc-300">{totals.cloudToks.toLocaleString()} tok</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-2">
                      <div
                        className="bg-sky-500 h-2 rounded-full transition-all"
                        style={{ width: `${totals.localToks + totals.cloudToks > 0 ? (totals.cloudToks / (totals.localToks + totals.cloudToks)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-session bar chart (last 10) */}
              {rows.length > 0 && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">
                    Last {rows.length} Sessions — Cost Comparison
                  </p>
                  <div className="space-y-2">
                    {rows.map((row, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                          <span>Session {row.label}</span>
                          <span className="text-zinc-400">${row.cloudCostPaid.toFixed(5)} paid · ${row.gpt4oCost.toFixed(5)} GPT-4o</span>
                        </div>
                        {/* GPT-4o bar (full width reference) */}
                        <div className="relative h-4 bg-zinc-900 rounded overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-zinc-700/50 rounded"
                            style={{ width: `${maxCost > 0 ? (row.gpt4oCost / maxCost) * 100 : 0}%` }}
                          />
                          <div
                            className="absolute inset-y-0 left-0 bg-sky-600 rounded"
                            style={{ width: `${maxCost > 0 ? (row.cloudCostPaid / maxCost) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="flex gap-3 text-[9px] font-mono text-zinc-600">
                          <span><span className="inline-block w-2 h-2 bg-sky-600 rounded-sm mr-1" />Prism cost</span>
                          <span><span className="inline-block w-2 h-2 bg-zinc-700 rounded-sm mr-1" />GPT-4o equivalent</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy stats card */}
              <div className="border border-zinc-800 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-zinc-300 font-semibold">Copy Summary</p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-0.5">Paste into a README or share with your team</p>
                </div>
                <button
                  onClick={handleCopyStats}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs font-mono text-zinc-300 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy .md'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CostDashboard;

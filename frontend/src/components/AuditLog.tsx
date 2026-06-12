import React, { useState } from 'react';
import { ShieldAlert, Download, ChevronDown, ChevronUp, BarChart } from 'lucide-react';
import { TaskResult } from '../types';

interface AuditLogProps {
  audit: TaskResult[];
  sessionId: string;
}

export const AuditLog: React.FC<AuditLogProps> = ({ audit, sessionId }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (audit.length === 0) return null;

  // Calculations
  const totalCost = audit.reduce((sum, r) => sum + r.cost_usd, 0);
  const totalTokens = audit.reduce((sum, r) => sum + r.token_count, 0);
  const maxLatency = Math.max(...audit.map(r => r.latency_ms), 0);
  
  // Unique keys redacted
  const allRedactedKeys = Array.from(new Set(audit.flatMap(r => r.redacted_keys)));
  const keysCount = allRedactedKeys.length;

  const handleExportCSV = () => {
    const headers = ['Task ID', 'Backend', 'Latency (ms)', 'Tokens', 'Cost (USD)', 'Redacted Keys'];
    const rows = audit.map(r => [
      r.task_id.toUpperCase(),
      r.backend,
      r.latency_ms,
      r.token_count,
      r.cost_usd.toFixed(6),
      r.redacted_keys.join('; ') || 'None'
    ]);

    // Add footer sum row
    rows.push([
      'TOTAL / MAX',
      '--',
      maxLatency,
      totalTokens,
      totalCost.toFixed(6),
      allRedactedKeys.join('; ') || 'None'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `prism_audit_${sessionId.substring(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="border border-border bg-card rounded-md overflow-hidden animate-fadeIn select-none">
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[#0d0d0d] px-4 py-2 text-xs font-mono text-zinc-400 border-b border-border hover:bg-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart className="w-3.5 h-3.5 text-zinc-500" />
          <span>MESH PERFORMANCE AUDIT & TELEMETRY</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] text-zinc-600">COST: ${totalCost.toFixed(5)}</span>
          <span className="text-zinc-700">|</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Audit Log Table */}
      {isOpen && (
        <div className="p-3 bg-[#0c0c0c] space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500 uppercase tracking-widest text-[9px] h-7">
                  <th className="pb-1.5 font-normal">Task</th>
                  <th className="pb-1.5 font-normal">Backend Route</th>
                  <th className="pb-1.5 font-normal text-right">Latency</th>
                  <th className="pb-1.5 font-normal text-right">Tokens</th>
                  <th className="pb-1.5 font-normal text-right">Cost</th>
                  <th className="pb-1.5 font-normal pl-6">Redacted Payloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/40 text-zinc-300">
                {audit.map((row) => (
                  <tr key={row.task_id} className="h-8 hover:bg-zinc-950/40">
                    <td className="font-bold text-accent">{row.task_id.toUpperCase()}</td>
                    <td>{row.backend}</td>
                    <td className="text-right text-zinc-400">{row.latency_ms}ms</td>
                    <td className="text-right text-zinc-400">{row.token_count}</td>
                    <td className="text-right font-bold text-zinc-400">${row.cost_usd.toFixed(6)}</td>
                    <td className="pl-6 text-[10px] text-zinc-500">
                      {row.redacted_keys.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-amber-500/70" />
                          <span className="text-amber-500/80 font-bold">{row.redacted_keys.join(', ')}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-700">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer Total Row */}
              <tfoot>
                <tr className="border-t border-zinc-800 text-[10px] text-zinc-400 h-9 font-bold bg-zinc-950/30">
                  <td>TOTAL / MAX</td>
                  <td>--</td>
                  <td className="text-right text-zinc-100">{maxLatency}ms</td>
                  <td className="text-right text-zinc-100">{totalTokens}</td>
                  <td className="text-right text-emerald-500">${totalCost.toFixed(6)}</td>
                  <td className="pl-6 text-zinc-500">
                    {keysCount > 0 ? `Redacted ${keysCount} items (${allRedactedKeys.join(', ')})` : 'No interceptions'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Export Action */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-[10px] font-mono text-zinc-400 hover:text-zinc-100 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>EXPORT AUDIT CSV</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default AuditLog;

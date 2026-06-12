import React, { useState } from 'react';
import { X, Trash2, Play, Calendar, Clock, DollarSign, Layers } from 'lucide-react';
import { HistorySession } from '../types';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistorySession[];
  onSelectSession: (session: HistorySession) => void;
  onReRun: (session: HistorySession) => void;
  onDelete: (sessionId: string) => void;
  onClearAll: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  history,
  onSelectSession,
  onReRun,
  onDelete,
  onClearAll,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      
      let interval = Math.floor(seconds / 31536000);
      if (interval >= 1) return `${interval}y ago`;
      interval = Math.floor(seconds / 2592000);
      if (interval >= 1) return `${interval}mo ago`;
      interval = Math.floor(seconds / 86400);
      if (interval >= 1) return `${interval}d ago`;
      interval = Math.floor(seconds / 3600);
      if (interval >= 1) return `${interval}h ago`;
      interval = Math.floor(seconds / 60);
      if (interval >= 1) return `${interval}m ago`;
      return 'just now';
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="fixed inset-y-0 left-0 w-80 bg-card border-r border-border z-50 flex flex-col shadow-2xl animate-fadeIn select-none">
      {/* Header */}
      <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          <span className="text-xs font-mono font-semibold text-zinc-200 uppercase tracking-wider">Session History</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Query List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {history.length > 0 && (
          <div className="flex justify-end mb-2 select-none">
            <button
              onClick={() => {
                if (window.confirm('Delete all history records? This cannot be undone.')) {
                  onClearAll();
                }
              }}
              className="text-[9px] font-mono text-zinc-500 hover:text-rose-500 transition-colors flex items-center gap-1 border border-zinc-900 bg-zinc-950 px-2 py-1 rounded"
            >
              <Trash2 className="w-3 h-3" />
              <span>CLEAR ALL</span>
            </button>
          </div>
        )}

        {history.map((session) => {
          const isExpanded = expandedId === session.session_id;
          const totalCost = session.results.reduce((sum, r) => sum + r.cost_usd, 0);
          const maxLatency = Math.max(...session.results.map(r => r.latency_ms), 0);

          return (
            <div
              key={session.session_id}
              className={`border rounded flex flex-col transition-all duration-200 ${
                isExpanded ? 'border-zinc-700 bg-zinc-950/20' : 'border-zinc-900 bg-[#0d0d0d] hover:border-zinc-800'
              }`}
            >
              {/* Card Summary click block */}
              <div
                onClick={() => toggleExpand(session.session_id)}
                className="p-3 cursor-pointer space-y-2 select-none"
              >
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {getRelativeTime(session.created_at)}
                  </span>
                  <span className="font-semibold">{session.results.length} TASKS</span>
                </div>
                
                <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                  {session.query}
                </p>

                {/* Micro metrics bar */}
                <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-500 pt-1">
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5 text-zinc-600" />
                    {maxLatency}ms
                  </span>
                  <span className="flex items-center gap-0.5 text-emerald-600">
                    <DollarSign className="w-2.5 h-2.5 text-zinc-600" />
                    ${totalCost.toFixed(5)}
                  </span>
                </div>
              </div>

              {/* Expanded content view */}
              {isExpanded && (
                <div className="border-t border-zinc-900 bg-[#080808] p-3 space-y-3 animate-fadeIn text-xs select-text">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Full query prompt:</span>
                    <p className="text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-900/40 leading-relaxed font-sans">{session.query}</p>
                  </div>

                  {session.synthesis && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Synthesis Output:</span>
                      <div className="max-h-24 overflow-y-auto text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-900/40 text-[11px] font-mono whitespace-pre-wrap">
                        {session.synthesis}
                      </div>
                    </div>
                  )}

                  {/* Actions inside card */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-900 select-none">
                    <button
                      onClick={() => onDelete(session.session_id)}
                      className="text-[10px] font-mono text-zinc-500 hover:text-rose-500 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>DELETE</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectSession(session)}
                        className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[10px] font-mono rounded transition-colors"
                      >
                        VIEW IN WORKSPACE
                      </button>
                      <button
                        onClick={() => onReRun(session)}
                        className="px-2 py-0.5 bg-zinc-100 hover:bg-white text-black text-[10px] font-mono rounded flex items-center gap-1 font-semibold transition-colors"
                      >
                        <Play className="w-3 h-3 fill-black" />
                        <span>RE-RUN</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {history.length === 0 && (
          <div className="h-40 flex items-center justify-center text-xs text-zinc-600 italic font-mono text-center px-4">
            No queries recorded yet.
          </div>
        )}
      </div>
    </div>
  );
};
export default HistoryPanel;

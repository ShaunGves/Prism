import React from 'react';
import { Settings, History, BarChart2, RotateCcw, DollarSign, MessageSquare, Terminal } from 'lucide-react';
import { HealthStatus } from '../hooks/useHealth';
import { SessionStats, TimingMetrics } from '../types';

type AppMode = 'query' | 'chat';

interface TopBarProps {
  health: HealthStatus;
  stats: SessionStats;
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onToggleAnalytics: () => void;
  showAnalytics: boolean;
  timingMetrics?: TimingMetrics | null;
  onReset?: () => void;
  onOpenCostDashboard?: () => void;
  appMode?: AppMode;
  onModeChange?: (mode: AppMode) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  health,
  stats,
  wsStatus,
  onOpenSettings,
  onOpenHistory,
  onToggleAnalytics,
  showAnalytics,
  timingMetrics,
  onReset,
  onOpenCostDashboard,
  appMode = 'chat',
  onModeChange,
}) => {
  const getStatusColor = (status: 'disconnected' | 'connecting' | 'connected' | 'error') => {
    switch (status) {
      case 'connected': return 'bg-emerald-500';
      case 'connecting': return 'bg-amber-500';
      case 'error': return 'bg-rose-500';
      default: return 'bg-zinc-600';
    }
  };

  const fmtMs = (ms: number) => (ms / 1000).toFixed(1) + 's';

  return (
    <header className="h-14 border-b border-border bg-[#0a0a0a] px-4 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Brand + History + Mode Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenHistory}
          className="p-1.5 rounded hover:bg-zinc-900 border border-transparent hover:border-border transition-all duration-200 text-zinc-400 hover:text-zinc-100"
          title="Query History"
        >
          <History className="w-4.5 h-4.5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-sans font-bold text-sm tracking-widest text-zinc-100">PRISM</span>
          <span className="px-1.5 py-0.5 text-[9px] font-mono bg-zinc-900 border border-border text-zinc-400 uppercase tracking-widest rounded-sm">v1.3</span>
        </div>

        {/* Mode toggle: CHAT / QUERY */}
        {onModeChange && (
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => onModeChange('chat')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono transition-all ${
                appMode === 'chat'
                  ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Chat mode"
            >
              <MessageSquare className="w-3 h-3" />
              CHAT
            </button>
            <button
              onClick={() => onModeChange('query')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono transition-all ${
                appMode === 'query'
                  ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Query mode — full technical view"
            >
              <Terminal className="w-3 h-3" />
              QUERY
            </button>
          </div>
        )}
      </div>

      {/* Middle: Health Indicators */}
      <div className="hidden md:flex items-center gap-6 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${getStatusColor(wsStatus)}`} />
          <span className="text-zinc-500 font-sans">WS:</span>
          <span className="text-zinc-200">{wsStatus}</span>
        </div>
        <div className="h-4 w-[1px] bg-zinc-800" />

        {/* Model health */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title={health.local_qwen3.online ? `Latency: ${health.local_qwen3.latency_ms}ms` : 'Offline'}>
            <span className={`h-2 w-2 rounded-full ${health.local_qwen3.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>LOCAL</span>
            <span className="text-[9px] text-zinc-600 font-mono">
              ({health.local_qwen3.online ? `${health.local_qwen3.latency_ms}ms` : 'offline'})
            </span>
          </div>

          <div className="flex items-center gap-1.5" title={health.groq.online ? `Latency: ${health.groq.latency_ms}ms` : 'Offline'}>
            <span className={`h-2 w-2 rounded-full ${health.groq.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>GROQ</span>
            <span className="text-[9px] text-zinc-600 font-mono">
              ({health.groq.online ? `${health.groq.latency_ms}ms` : 'offline'})
            </span>
          </div>

          <div className="flex items-center gap-1.5" title={health.gemini.online ? `Latency: ${health.gemini.latency_ms}ms` : 'Offline'}>
            <span className={`h-2 w-2 rounded-full ${health.gemini.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>GEMINI</span>
            <span className="text-[9px] text-zinc-600 font-mono">
              ({health.gemini.online ? `${health.gemini.latency_ms}ms` : 'offline'})
            </span>
          </div>
        </div>
      </div>

      {/* Right: Metrics & Settings */}
      <div className="flex items-center gap-4">
        {/* Real-time Session Stats */}
        <div className="flex items-center gap-5 text-xs text-zinc-400 font-mono border-r border-border pr-4 h-8">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans">Queries</span>
            <span className="font-bold text-zinc-200">{stats.totalQueries}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans">Cost</span>
            <span className="font-bold text-zinc-200">${stats.totalCost.toFixed(5)}</span>
          </div>

          {/* Timing trio — shown after a run completes */}
          {timingMetrics ? (
            <>
              <div className="flex flex-col items-end" title="Sum of all task latencies if run sequentially">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans">Sequential</span>
                <span className="font-bold text-zinc-400">{fmtMs(timingMetrics.sequentialMs)}</span>
              </div>
              <div className="flex flex-col items-end" title="Actual wall-clock time">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans">Parallel</span>
                <span className="font-bold text-blue-400">{fmtMs(timingMetrics.parallelMs)}</span>
              </div>
              <div className="flex flex-col items-end" title="Time saved by parallel execution">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans">Saved</span>
                <span className="font-bold text-emerald-400">
                  {fmtMs(timingMetrics.savedMs)}
                  <span className="text-[9px] text-emerald-600 ml-1">({timingMetrics.savedPct.toFixed(0)}%)</span>
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans">Saved</span>
              <span className="font-bold text-emerald-500">{(stats.totalLatencySaved / 1000).toFixed(2)}s</span>
            </div>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
              className="p-1.5 rounded hover:bg-zinc-900 border border-transparent hover:border-border transition-all duration-200 text-zinc-500 hover:text-zinc-100"
              title="Reset session (clears tasks & synthesis, keeps history)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {onOpenCostDashboard && (
            <button
              onClick={onOpenCostDashboard}
              className="p-1.5 rounded hover:bg-zinc-900 border border-transparent hover:border-border transition-all duration-200 text-zinc-400 hover:text-zinc-100"
              title="Cost & Savings Dashboard"
            >
              <DollarSign className="w-4.5 h-4.5" />
            </button>
          )}

          <button
            onClick={onToggleAnalytics}
            className={`p-1.5 rounded border transition-all duration-200 ${
              showAnalytics
                ? 'bg-zinc-900 border-border text-zinc-100'
                : 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
            }`}
            title="Analytics"
          >
            <BarChart2 className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded hover:bg-zinc-900 border border-transparent hover:border-border transition-all duration-200 text-zinc-400 hover:text-zinc-100"
            title="Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
export default TopBar;

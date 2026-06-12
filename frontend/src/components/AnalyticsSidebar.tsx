import React from 'react';
import { X, Shield, Cpu, Clock, DollarSign } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { TaskResult, SubTask } from '../types';

interface AnalyticsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  audit: TaskResult[];
  tasks: SubTask[];
  stats: {
    totalQueries: number;
    totalCost: number;
    totalLatencySaved: number;
  };
}

export const AnalyticsSidebar: React.FC<AnalyticsSidebarProps> = ({
  isOpen,
  onClose,
  audit,
  tasks,
  stats,
}) => {
  if (!isOpen) return null;

  // 1. Calculate Backend Utilization
  const utilization = {
    local: audit.filter(r => r.backend === 'local_qwen3').length,
    groq: audit.filter(r => r.backend === 'groq').length,
    gemini: audit.filter(r => r.backend === 'gemini').length,
  };

  const totalTasks = audit.length || 1;

  // 2. Cost breakdown donut data
  const localCost = 0;
  const groqCost = audit.filter(r => r.backend === 'groq').reduce((sum, r) => sum + r.cost_usd, 0);
  const geminiCost = audit.filter(r => r.backend === 'gemini').reduce((sum, r) => sum + r.cost_usd, 0);
  const totalCost = groqCost + geminiCost;

  const costData = [
    { name: 'Local (Free)', value: 100 && totalCost === 0 ? 1 : 0, cost: 0, color: '#10b981' },
    { name: 'Groq', value: groqCost, cost: groqCost, color: '#6366f1' },
    { name: 'Gemini', value: geminiCost, cost: geminiCost, color: '#f59e0b' },
  ].filter(d => d.value > 0 || d.cost > 0);

  // 3. Reconstruct Latency Waterfall using Topological Order
  const getWaterfallData = () => {
    const timeline: Record<string, { start: number; end: number }> = {};
    const resolved = new Set<string>();
    let loops = 0;

    // Resolve start/end times iteratively based on dependency schedules
    while (resolved.size < audit.length && loops < 50) {
      loops++;
      audit.forEach(task => {
        if (resolved.has(task.task_id)) return;
        
        const subtask = tasks.find(t => t.id === task.task_id);
        const dependsOn = subtask?.depends_on || [];
        const depsResolved = dependsOn.every(depId => depId in timeline);

        if (depsResolved) {
          const start = dependsOn.length === 0
            ? 0
            : Math.max(...dependsOn.map(depId => timeline[depId].end));
          
          timeline[task.task_id] = {
            start,
            end: start + task.latency_ms
          };
          resolved.add(task.task_id);
        }
      });
    }

    return audit.map(task => {
      const t = timeline[task.task_id] || { start: 0, end: task.latency_ms };
      return {
        name: task.task_id.toUpperCase(),
        // Range representation [start, end] for Recharts waterfall rendering
        range: [t.start, t.end],
        start: t.start,
        end: t.end,
        duration: task.latency_ms,
        backend: task.backend === 'local_qwen3' ? 'LOCAL' : task.backend.toUpperCase(),
      };
    }).sort((a, b) => a.start - b.start);
  };

  const waterfallData = getWaterfallData();

  // 4. Intercepts list
  const uniqueRedacted = Array.from(new Set(audit.flatMap(r => r.redacted_keys)));

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-card border-l border-border z-50 flex flex-col shadow-2xl animate-fadeIn select-none">
      {/* Header */}
      <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" />
          <span className="text-xs font-mono font-semibold text-zinc-200 uppercase tracking-wider">Session Analytics</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Session Stats Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border bg-[#0a0a0a] p-3 rounded">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-sans">Queries Run</span>
            <span className="text-xl font-bold font-mono text-zinc-200">{stats.totalQueries}</span>
          </div>
          <div className="border border-border bg-[#0a0a0a] p-3 rounded">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest block font-sans">Total Latency Saved</span>
            <span className="text-xl font-bold font-mono text-emerald-500">{(stats.totalLatencySaved / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {/* Cost Breakdown Donut */}
        <div className="border border-border bg-[#0a0a0a] p-3 rounded flex flex-col">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono mb-2 border-b border-zinc-900 pb-1">
            Cost Distribution
          </span>
          {costData.length > 0 ? (
            <div className="h-32 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={3}
                    dataKey="cost"
                  >
                    {costData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #222', fontSize: '10px', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#ccc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[9px] text-zinc-500 uppercase">Total</span>
                <span className="text-xs font-bold font-mono text-zinc-300">${totalCost.toFixed(5)}</span>
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-zinc-600 italic font-mono">
              No cloud runs charged.
            </div>
          )}
          {/* Legend */}
          <div className="flex flex-col gap-1.5 text-[9px] font-mono text-zinc-400 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                <span>Local (Free)</span>
              </div>
              <span className="text-zinc-500">$0.000000</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-indigo-500" />
                <span>Groq (Llama)</span>
              </div>
              <span className="text-zinc-300">${groqCost.toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-amber-500" />
                <span>Gemini (Flash)</span>
              </div>
              <span className="text-zinc-300">${geminiCost.toFixed(6)}</span>
            </div>
          </div>
        </div>

        {/* Latency Waterfall Chart */}
        <div className="border border-border bg-[#0a0a0a] p-3 rounded flex flex-col">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono mb-2 border-b border-zinc-900 pb-1">
            Task Latency Waterfall (Timeline)
          </span>
          {waterfallData.length > 0 ? (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={waterfallData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <XAxis type="number" stroke="#444" fontSize={8} tickFormatter={(val) => `${val}ms`} />
                  <YAxis dataKey="name" type="category" stroke="#444" fontSize={8} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #222', fontSize: '9px', fontFamily: 'monospace' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value: any) => [`${value[1] - value[0]}ms`, 'Span']}
                  />
                  <Bar dataKey="range" fill="#6366f1" radius={[0, 2, 2, 0]}>
                    {waterfallData.map((entry, index) => {
                      // Different bar colors for each task route
                      let color = '#3f3f46';
                      if (entry.backend.includes('LOCAL')) color = '#10b981';
                      else if (entry.backend.includes('GROQ')) color = '#6366f1';
                      else if (entry.backend.includes('GEMINI')) color = '#f59e0b';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-zinc-600 italic font-mono">
              No tasks executed.
            </div>
          )}
        </div>

        {/* Backend Utilization ratios */}
        <div className="border border-border bg-[#0a0a0a] p-3 rounded flex flex-col">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono mb-2.5 border-b border-zinc-900 pb-1">
            Backend utilization
          </span>
          <div className="space-y-2 text-[10px] font-mono text-zinc-400">
            <div>
              <div className="flex justify-between mb-1">
                <span>LOCAL QWEN3</span>
                <span>{utilization.local} tasks ({Math.round((utilization.local / totalTasks) * 100)}%)</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded-sm overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(utilization.local / totalTasks) * 100}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>GROQ LLAMA3</span>
                <span>{utilization.groq} tasks ({Math.round((utilization.groq / totalTasks) * 100)}%)</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded-sm overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${(utilization.groq / totalTasks) * 100}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>GEMINI FLASH</span>
                <span>{utilization.gemini} tasks ({Math.round((utilization.gemini / totalTasks) * 100)}%)</span>
              </div>
              <div className="w-full h-1 bg-zinc-900 rounded-sm overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${(utilization.gemini / totalTasks) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Redactions list */}
        <div className="border border-border bg-[#0a0a0a] p-3 rounded flex flex-col">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono mb-2 border-b border-zinc-900 pb-1">
            Privacy Intercepts
          </span>
          <div className="flex items-center justify-between text-xs font-mono mb-2 text-zinc-300">
            <span>Redacted keys:</span>
            <span className="font-bold text-amber-500">{uniqueRedacted.length}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {uniqueRedacted.map(key => (
              <span key={key} className="px-1.5 py-0.5 border border-zinc-900 bg-zinc-950 text-[9px] font-mono text-zinc-400 rounded-sm">
                {key}
              </span>
            ))}
            {uniqueRedacted.length === 0 && (
              <span className="text-[10px] text-zinc-700 italic font-mono">No keys intercepted this session.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default AnalyticsSidebar;

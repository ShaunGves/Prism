import React, { useState } from 'react';
import { Play, X, Trash2, Plus, RefreshCw, Layers } from 'lucide-react';
import { DecompositionResult, SubTask } from '../types';

interface DecompPreviewProps {
  initialDecomp: DecompositionResult;
  onExecute: (overrideDecomp: DecompositionResult) => void;
  onCancel: () => void;
}

export const DecompPreview: React.FC<DecompPreviewProps> = ({
  initialDecomp,
  onExecute,
  onCancel,
}) => {
  const [tasks, setTasks] = useState<SubTask[]>(initialDecomp.tasks);
  const [hint, setHint] = useState<string>(initialDecomp.synthesis_hint);

  const handleTaskChange = (index: number, key: keyof SubTask, value: any) => {
    setTasks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleAddTask = () => {
    const newId = `t${tasks.length + 1}`;
    const newTask: SubTask = {
      id: newId,
      description: 'New sub-task description...',
      sensitivity: 'low',
      complexity: 'medium',
      backend: 'groq',
      depends_on: [],
      context_keys: [],
    };
    setTasks([...tasks, newTask]);
  };

  const handleDeleteTask = (index: number) => {
    const taskId = tasks[index].id;
    setTasks((prev) => {
      // 1. Remove task
      let filtered = prev.filter((_, idx) => idx !== index);
      // 2. Clean dependencies referencing this task
      filtered = filtered.map(t => ({
        ...t,
        depends_on: t.depends_on.filter(dep => dep !== taskId),
        context_keys: t.context_keys.filter(dep => dep !== taskId),
      }));
      return filtered;
    });
  };

  const toggleDependency = (taskIndex: number, depTaskId: string) => {
    const task = tasks[taskIndex];
    const hasDep = task.depends_on.includes(depTaskId);
    
    let newDepends = [...task.depends_on];
    let newContext = [...task.context_keys];

    if (hasDep) {
      newDepends = newDepends.filter(d => d !== depTaskId);
      newContext = newContext.filter(d => d !== depTaskId);
    } else {
      newDepends.push(depTaskId);
      newContext.push(depTaskId); // Usually context keys follow dependencies
    }

    handleTaskChange(taskIndex, 'depends_on', newDepends);
    handleTaskChange(taskIndex, 'context_keys', newContext);
  };

  const handleExecute = () => {
    onExecute({
      tasks,
      synthesis_hint: hint,
    });
  };

  return (
    <div className="border border-border bg-card rounded-md p-4 w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-wider text-zinc-100 uppercase">Cognitive Mesh Decomposition</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-2.5 py-1 text-xs border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 rounded font-mono transition-colors cursor-pointer"
          >
            CANCEL
          </button>
        </div>
      </div>

      {/* Task Grid cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {tasks.map((task, idx) => (
          <div key={task.id} className="border border-border bg-[#0d0d0d] p-3 rounded flex flex-col justify-between">
            {/* Card Top */}
            <div>
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-2">
                <span className="font-mono font-bold text-xs text-accent uppercase tracking-wider">{task.id}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={task.sensitivity}
                    onChange={(e) => handleTaskChange(idx, 'sensitivity', e.target.value)}
                    className="bg-transparent text-[10px] text-zinc-400 border border-zinc-800 rounded px-1 py-0.5 focus:outline-none focus:border-zinc-700 cursor-pointer font-mono"
                  >
                    <option value="low" className="bg-card">LOW SENSITIVITY</option>
                    <option value="high" className="bg-card text-amber-500">HIGH SENSITIVITY</option>
                  </select>
                  <button
                    onClick={() => handleDeleteTask(idx)}
                    className="p-1 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded text-zinc-500 hover:text-rose-500 transition-colors"
                    title="Remove Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Task Description */}
              <textarea
                value={task.description}
                onChange={(e) => handleTaskChange(idx, 'description', e.target.value)}
                className="w-full h-16 bg-transparent text-xs text-zinc-300 placeholder-zinc-700 border border-transparent focus:border-zinc-900 focus:bg-[#090909] p-1 rounded resize-none focus:outline-none leading-relaxed"
                placeholder="Subtask description..."
              />
            </div>

            {/* Routing & Dependencies */}
            <div className="mt-3 pt-3 border-t border-zinc-900 space-y-2.5">
              {/* Backend Routing override */}
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-zinc-500 uppercase tracking-widest">Model Route:</span>
                <select
                  value={task.backend}
                  onChange={(e) => handleTaskChange(idx, 'backend', e.target.value)}
                  className="bg-zinc-950 text-zinc-200 border border-zinc-800 rounded px-1.5 py-0.5 focus:outline-none focus:border-zinc-700 font-mono cursor-pointer"
                >
                  <option value="local_qwen3" className="bg-card">LOCAL (Qwen3)</option>
                  <option value="groq" className="bg-card">GROQ (Llama3)</option>
                  <option value="gemini" className="bg-card">GEMINI (Flash)</option>
                </select>
              </div>

              {/* Dependency checklist */}
              <div className="text-[10px] font-mono">
                <div className="text-zinc-500 uppercase tracking-widest mb-1.5">Depends On:</div>
                <div className="flex flex-wrap gap-1.5">
                  {tasks
                    .filter(t => t.id !== task.id)
                    .map(t => {
                      const isDep = task.depends_on.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleDependency(idx, t.id)}
                          className={`px-1.5 py-0.5 rounded border transition-colors ${
                            isDep
                              ? 'bg-zinc-100 border-zinc-100 text-black font-semibold'
                              : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                          }`}
                        >
                          {isDep ? `✓ ${t.id.toUpperCase()}` : `+ ${t.id.toUpperCase()}`}
                        </button>
                      );
                    })}

                  {tasks.filter(t => t.id !== task.id).length === 0 && (
                    <span className="text-zinc-700 italic">None available</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add Task placeholder */}
        <button
          onClick={handleAddTask}
          className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-transparent rounded p-6 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer h-full min-h-[160px]"
        >
          <Plus className="w-5 h-5 mb-1.5" />
          <span className="text-xs font-mono uppercase tracking-widest">Add Sub-Task</span>
        </button>
      </div>

      {/* Synthesis Hint Override */}
      <div className="mb-4">
        <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Synthesis Guidance:</label>
        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          className="w-full bg-[#0d0d0d] border border-zinc-900 hover:border-zinc-800 focus:border-zinc-700 px-3 py-1.5 rounded text-xs text-zinc-300 focus:outline-none"
        />
      </div>

      {/* Final execute trigger */}
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <button
          onClick={handleExecute}
          className="px-4 py-1.5 text-xs font-mono font-semibold bg-zinc-100 hover:bg-white text-black rounded flex items-center gap-1.5 transition-colors cursor-pointer select-none"
        >
          <Play className="w-3.5 h-3.5" />
          <span>EXECUTE COGNITIVE MESH</span>
        </button>
      </div>
    </div>
  );
};
export default DecompPreview;

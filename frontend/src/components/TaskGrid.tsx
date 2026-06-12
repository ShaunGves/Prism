import React from 'react';
import TaskCard from './TaskCard';
import { SubTask } from '../types';

interface TaskGridProps {
  tasks: SubTask[];
}

export const TaskGrid: React.FC<TaskGridProps> = ({ tasks }) => {
  const runningCount = tasks.filter(t => t.status === 'running').length;

  return (
    <div className="space-y-4">
      {/* Parallel stream indicator */}
      {runningCount >= 2 && (
        <div className="w-full h-2.5 bg-zinc-950 border border-border relative rounded-sm flex items-center justify-center select-none overflow-hidden">
          <div className="absolute inset-y-0 left-0 right-0 bg-accent/10 animate-pulse" />
          <div className="absolute inset-y-0 left-0 bg-accent/20 transition-all duration-300" style={{ width: `${(runningCount / tasks.length) * 100}%` }} />
          <div className="relative z-10 bg-background px-2.5 py-0.5 border border-border text-[8px] font-mono text-accent uppercase tracking-widest flex items-center gap-1.5 rounded-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
            </span>
            <span>RUNNING IN PARALLEL — {runningCount} active pipelines</span>
          </div>
        </div>
      )}

      {/* Grid container with stagger */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task, idx) => (
          <div
            key={task.id}
            style={{
              animationDelay: `${idx * 80}ms`,
            }}
            className="animate-fadeIn"
          >
            <TaskCard task={task} index={idx} />
          </div>
        ))}
      </div>
    </div>
  );
};
export default TaskGrid;

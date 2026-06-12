import React from 'react';
import { SubTask } from '../types';

interface DependencyGraphProps {
  tasks: SubTask[];
}

interface NodePosition {
  id: string;
  label: string;
  x: number;
  y: number;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  // 1. Calculate dependency levels (topological ranks)
  const levels: Record<string, number> = {};
  const visited = new Set<string>();

  const getLevel = (taskId: string): number => {
    if (taskId in levels) return levels[taskId];
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.depends_on.length === 0) {
      levels[taskId] = 0;
      return 0;
    }
    
    // Simple cycle guard
    if (visited.has(taskId)) return 0;
    visited.add(taskId);

    const maxDepLevel = Math.max(...task.depends_on.map(depId => getLevel(depId)));
    visited.delete(taskId);

    const level = maxDepLevel + 1;
    levels[taskId] = level;
    return level;
  };

  tasks.forEach(t => getLevel(t.id));

  // 2. Group tasks by level to calculate coordinates
  const tasksByLevel: Record<number, string[]> = {};
  Object.entries(levels).forEach(([id, lvl]) => {
    if (!tasksByLevel[lvl]) tasksByLevel[lvl] = [];
    tasksByLevel[lvl].push(id);
  });

  const width = 240;
  const height = 110;
  const paddingX = 40;
  const paddingY = 20;

  const maxLevel = Math.max(...Object.values(levels), 0);
  const colWidth = (width - paddingX * 2) / Math.max(maxLevel, 1);

  // 3. Map nodes to coordinates
  const nodes: NodePosition[] = [];
  const nodeMap: Record<string, NodePosition> = {};

  Object.entries(tasksByLevel).forEach(([levelStr, taskIds]) => {
    const lvl = parseInt(levelStr, 10);
    const x = paddingX + lvl * colWidth;
    const rowHeight = (height - paddingY * 2) / taskIds.length;

    taskIds.forEach((id, rowIdx) => {
      const y = paddingY + rowIdx * rowHeight + rowHeight / 2;
      const taskObj = tasks.find(t => t.id === id);
      const status = taskObj?.status || 'pending';
      const node = { id, label: id.toUpperCase(), x, y, status };
      nodes.push(node);
      nodeMap[id] = node;
    });
  });

  // 4. Generate edges
  const edges: { from: NodePosition; to: NodePosition; key: string }[] = [];
  tasks.forEach(task => {
    task.depends_on.forEach(depId => {
      const fromNode = nodeMap[depId];
      const toNode = nodeMap[task.id];
      if (fromNode && toNode) {
        edges.push({ from: fromNode, to: toNode, key: `${depId}->${task.id}` });
      }
    });
  });

  const getNodeColor = (status: NodePosition['status']) => {
    switch (status) {
      case 'completed': return { border: 'stroke-emerald-500', bg: 'fill-emerald-950/40', text: 'fill-emerald-400' };
      case 'running': return { border: 'stroke-accent animate-pulse', bg: 'fill-accent/10', text: 'fill-accent' };
      case 'error': return { border: 'stroke-rose-600', bg: 'fill-rose-950/20', text: 'fill-rose-400' };
      default: return { border: 'stroke-zinc-800', bg: 'fill-zinc-950', text: 'fill-zinc-600' };
    }
  };

  return (
    <div className="border border-border bg-card rounded p-3 select-none flex flex-col items-center">
      <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-2 border-b border-zinc-900 pb-1 w-full text-left">
        Mesh Topology (DAG)
      </div>
      <svg width={width} height={height} className="overflow-visible font-mono">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" className="fill-zinc-800" />
          </marker>
        </defs>

        {/* Draw edges */}
        {edges.map(edge => (
          <line
            key={edge.key}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            strokeWidth="1"
            className="stroke-zinc-800"
            markerEnd="url(#arrow)"
          />
        ))}

        {/* Draw nodes */}
        {nodes.map(node => {
          const colors = getNodeColor(node.status);
          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r="12"
                strokeWidth="1.5"
                className={`${colors.border} ${colors.bg}`}
              />
              <text
                x={node.x}
                y={node.y + 3}
                textAnchor="middle"
                fontSize="9px"
                fontWeight="bold"
                className={colors.text}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
export default DependencyGraph;

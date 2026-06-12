import { TaskResult } from '../types';

export const estimateCost = (backend: string, tokens: number): number => {
  const rates: Record<string, number> = {
    local_qwen3: 0.0,
    groq: 0.00000059,
    gemini: 0.000000075,
  };
  return rates[backend] ? rates[backend] * tokens : 0;
};

export const calculateTotalSessionCost = (results: TaskResult[]): number => {
  return results.reduce((sum, r) => sum + r.cost_usd, 0);
};

export const calculateLatencySaved = (results: TaskResult[], sessionDurationMs: number): number => {
  const sequentialLatency = results.reduce((sum, r) => sum + r.latency_ms, 0);
  // Latency saved is the difference between running them sequentially vs in parallel
  return Math.max(0, sequentialLatency - sessionDurationMs);
};

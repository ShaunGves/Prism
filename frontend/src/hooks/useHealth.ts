import { useState, useEffect } from 'react';

export interface BackendHealth {
  online: boolean;
  latency_ms: number;
  error?: string;
}

export interface HealthStatus {
  local_qwen3: BackendHealth;
  groq: BackendHealth;
  gemini: BackendHealth;
}

const DEFAULT_HEALTH: HealthStatus = {
  local_qwen3: { online: false, latency_ms: 0 },
  groq: { online: false, latency_ms: 0 },
  gemini: { online: false, latency_ms: 0 },
};

export const useHealth = (wsUrl: string) => {
  const [health, setHealth] = useState<HealthStatus>(DEFAULT_HEALTH);

  const checkHealth = async () => {
    try {
      // Derive HTTP URL from WS URL (e.g. ws://localhost:8000/ws -> http://localhost:8000/health)
      const base = wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
      const resp = await fetch(`${base}/health`);
      if (resp.ok) {
        const data = await resp.json();
        setHealth(data);
      } else {
        throw new Error('Health check failed');
      }
    } catch (e) {
      setHealth({
        local_qwen3: { online: false, latency_ms: 0, error: String(e) },
        groq: { online: false, latency_ms: 0, error: String(e) },
        gemini: { online: false, latency_ms: 0, error: String(e) },
      });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [wsUrl]);

  return { health, checkHealth };
};
export default useHealth;

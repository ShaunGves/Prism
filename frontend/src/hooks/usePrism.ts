import { useState, useEffect, useRef } from 'react';
import { SubTask, TaskResult, DecompositionResult, PrismEvent, Settings, TimingMetrics } from '../types';
import { calculateTotalSessionCost, calculateLatencySaved } from '../lib/cost';

export const usePrism = (wsUrl: string, settings: Settings) => {
  const [tasks, setTasks] = useState<SubTask[]>([]);
  const [synthesisText, setSynthesisText] = useState<string>('');
  const [synthesisStatus, setSynthesisStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [audit, setAudit] = useState<TaskResult[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [session_id, setSessionId] = useState<string>('');
  const [sessionDurationMs, setSessionDurationMs] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [timingMetrics, setTimingMetrics] = useState<TimingMetrics | null>(null);

  // Decomposition preview state
  const [decompPreview, setDecompPreview] = useState<DecompositionResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Connect & reconnect handlers
  const connect = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    
    setWsStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
    };

    ws.onerror = () => {
      setWsStatus('error');
    };

    ws.onmessage = (event) => {
      const data: PrismEvent = JSON.parse(event.data);
      handleWsEvent(data);
    };
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  useEffect(() => {
    connect();
    return () => {
      disconnect();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [wsUrl]);

  // Handle incoming events
  const handleWsEvent = (event: PrismEvent) => {
    switch (event.type) {
      case 'decomp_complete':
        setSessionId(event.session_id);
        setTasks(
          event.tasks.map((t) => ({
            ...t,
            status: 'pending',
            output: '',
            latency_ms: 0,
            cost_usd: 0,
            redacted_keys: [],
          }))
        );
        break;

      case 'task_start':
        setTasks((prev) =>
          prev.map((t) =>
            t.id === event.task_id
              ? { ...t, status: 'running', redacted_keys: event.redacted_keys }
              : t
          )
        );
        break;

      case 'task_chunk':
        setTasks((prev) =>
          prev.map((t) =>
            t.id === event.task_id
              ? { ...t, output: (t.output || '') + event.chunk }
              : t
          )
        );
        break;

      case 'task_complete':
        setTasks((prev) =>
          prev.map((t) =>
            t.id === event.task_id
              ? {
                  ...t,
                  status: 'completed',
                  latency_ms: event.latency_ms,
                  cost_usd: event.cost_usd,
                  redacted_keys: event.redacted_keys,
                }
              : t
          )
        );
        break;

      case 'task_error':
        setTasks((prev) =>
          prev.map((t) =>
            t.id === event.task_id
              ? { ...t, status: 'error', output: (t.output || '') + `\n[ERROR: ${event.error}]` }
              : t
          )
        );
        break;

      case 'synthesis_start':
        setSynthesisStatus('running');
        break;

      case 'synthesis_chunk':
        setSynthesisText((prev) => prev + event.chunk);
        break;

      case 'synthesis_complete':
        setSynthesisStatus('completed');
        setAudit(event.audit);
        setIsExecuting(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        // Calculate timing metrics
        const parallelMs = Date.now() - startTimeRef.current;
        const sequentialMs = event.audit.reduce((sum, r) => sum + r.latency_ms, 0);
        const savedMs = Math.max(0, sequentialMs - parallelMs);
        const savedPct = sequentialMs > 0 ? (savedMs / sequentialMs) * 100 : 0;
        setTimingMetrics({ sequentialMs, parallelMs, savedMs, savedPct });
        setSessionDurationMs(parallelMs);
        break;

      case 'error':
        console.error('Prism backend execution error:', event.message);
        setSynthesisStatus('completed');
        setIsExecuting(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        alert(`Execution error: ${event.message}`);
        break;
    }
  };

  const getDecompositionPreview = async (query: string, context: Record<string, any>) => {
    setIsPreviewLoading(true);
    setDecompPreview(null);
    try {
      const baseHttp = wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
      const resp = await fetch(`${baseHttp}/decompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context,
          temperature: settings.decompTemp,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setDecompPreview(data);
      } else {
        throw new Error('Decomposition fetch failed');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to decompose query. Check local LLM URL configuration.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const executeQuery = (query: string, context: Record<string, any>, decompOverride?: DecompositionResult | null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect();
      alert('Reconnecting to Prism backend... Please try again in a moment.');
      return;
    }

    setIsExecuting(true);
    setTasks([]);
    setSynthesisText('');
    setSynthesisStatus('idle');
    setAudit([]);
    setSessionDurationMs(0);
    setTimingMetrics(null);
    setDecompPreview(null);

    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setSessionDurationMs(Date.now() - startTimeRef.current);
    }, 50);

    const payload: Record<string, any> = {
      type: 'query',
      query,
      context,
      settings: {
        groq_model: settings.groqModel,
        gemini_model: settings.geminiModel,
        max_tokens_local: settings.maxTokensLocal,
        max_tokens_groq: settings.maxTokensGroq,
        max_tokens_gemini: settings.maxTokensGemini,
        temperature: settings.decompTemp,
      },
    };

    if (decompOverride) {
      payload.decomp_override = decompOverride;
      // Pre-populate tasks on frontend immediately
      setTasks(
        decompOverride.tasks.map((t) => ({
          ...t,
          status: 'pending',
          output: '',
          latency_ms: 0,
          cost_usd: 0,
          redacted_keys: [],
        }))
      );
    }

    wsRef.current.send(JSON.stringify(payload));
  };

  return {
    tasks,
    setTasks,
    synthesisText,
    setSynthesisText,
    synthesisStatus,
    setSynthesisStatus,
    audit,
    setAudit,
    isExecuting,
    session_id,
    sessionDurationMs,
    wsStatus,
    connect,
    decompPreview,
    setDecompPreview,
    isPreviewLoading,
    getDecompositionPreview,
    executeQuery,
    timingMetrics,
  };
};
export default usePrism;

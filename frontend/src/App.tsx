import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePrism } from './hooks/usePrism';
import { useHistory } from './hooks/useHistory';
import { useHealth } from './hooks/useHealth';
import { loadSettings, saveSettings } from './lib/storage';
import { calculateLatencySaved } from './lib/cost';
import { DEFAULT_WS_URL } from './lib/ws';
import { Settings, SessionStats, HistorySession, SubTask, TaskResult } from './types';

// Components
import { TopBar } from './components/TopBar';
import { QueryInput } from './components/QueryInput';
import { ChatInput } from './components/ChatInput';
import { ChatView, ChatMessage } from './components/ChatView';
import { DecompPreview } from './components/DecompPreview';
import { TaskGrid } from './components/TaskGrid';
import { PrivacyGateBanner } from './components/PrivacyGateBanner';
import { PrivacyShieldCard } from './components/PrivacyShieldCard';
import { DependencyGraph } from './components/DependencyGraph';
import { SynthesisPanel } from './components/SynthesisPanel';
import { AuditLog } from './components/AuditLog';
import { AnalyticsSidebar } from './components/AnalyticsSidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { FileDropZone } from './components/FileDropZone';
import { CostDashboard } from './components/CostDashboard';

type AppMode = 'query' | 'chat';

// Derive HTTP base from the WebSocket URL
const HTTP_BASE = DEFAULT_WS_URL.replace(/^ws(s?)/, 'http$1').replace(/\/ws$/, '');

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isCostDashboardOpen, setIsCostDashboardOpen] = useState(false);

  // App mode: 'query' (technical full view) | 'chat' (conversational)
  const [appMode, setAppMode] = useState<AppMode>('chat');

  // ── Chat state — completely independent of query pipeline ──────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMsgIdRef = useRef(0);
  const chatAbortRef = useRef<AbortController | null>(null);

  // ── Query state ────────────────────────────────────────────────────────────
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentContext, setCurrentContext] = useState<Record<string, any>>({});
  const [contextInput, setContextInput] = useState('');

  // 1. Hooks
  const {
    tasks,
    synthesisText,
    synthesisStatus,
    audit,
    isExecuting,
    session_id,
    sessionDurationMs,
    wsStatus,
    decompPreview,
    setDecompPreview,
    isPreviewLoading,
    getDecompositionPreview,
    executeQuery,
    timingMetrics,
    setTasks,
    setSynthesisText,
    setSynthesisStatus,
    setAudit,
  } = usePrism(DEFAULT_WS_URL, settings);

  const { health } = useHealth(DEFAULT_WS_URL);
  const { history, saveSessionToHistory, deleteSessionFromHistory, clearHistory } = useHistory(DEFAULT_WS_URL);

  // 2. Session Metrics calculation
  const [stats, setStats] = useState<SessionStats>({
    totalQueries: 0,
    totalCost: 0,
    totalLatencySaved: 0,
  });

  useEffect(() => {
    if (history.length > 0) {
      let costSum = 0;
      let latencySavedSum = 0;
      history.forEach((session) => {
        costSum += session.results.reduce((sum, r) => sum + r.cost_usd, 0);
        const seq = session.results.reduce((sum, r) => sum + r.latency_ms, 0);
        const maxSingle = Math.max(...session.results.map(r => r.latency_ms), 0);
        latencySavedSum += Math.max(0, seq - maxSingle);
      });
      setStats({
        totalQueries: history.length,
        totalCost: costSum,
        totalLatencySaved: latencySavedSum,
      });
    }
  }, [history]);

  // 3. Save completed QUERY session to history
  useEffect(() => {
    if (synthesisStatus === 'completed' && session_id && !isExecuting) {
      const saveHistory = async () => {
        await saveSessionToHistory({
          session_id,
          query: currentQuery,
          context: currentContext,
          results: audit,
          synthesis: synthesisText,
        });
        if (settings.autoExport) {
          triggerAutoCsvExport();
        }
        setContextInput('');
      };
      saveHistory();
    }
  }, [synthesisStatus, isExecuting]);

  const triggerAutoCsvExport = () => {
    const headers = ['Task ID', 'Backend', 'Latency (ms)', 'Tokens', 'Cost (USD)', 'Redacted Keys'];
    const rows = audit.map(r => [
      r.task_id.toUpperCase(),
      r.backend,
      r.latency_ms,
      r.token_count,
      r.cost_usd.toFixed(6),
      r.redacted_keys.join('; ') || 'None'
    ]);
    const maxLatency = Math.max(...audit.map(r => r.latency_ms), 0);
    const totalCost = audit.reduce((sum, r) => sum + r.cost_usd, 0);
    const totalTokens = audit.reduce((sum, r) => sum + r.token_count, 0);
    rows.push(['TOTAL / MAX', '--', maxLatency, totalTokens, totalCost.toFixed(6), '']);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `prism_auto_audit_${session_id.substring(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /** Submit in Query mode — goes through full WebSocket pipeline */
  const handleQuerySubmit = (query: string, context: Record<string, any>) => {
    setCurrentQuery(query);
    setCurrentContext(context);

    if (settings.showPreview) {
      getDecompositionPreview(query, context);
    } else {
      executeQuery(query, context, null);
    }
  };

  /**
   * Submit in Chat mode — calls POST /chat directly.
   * NEVER touches the WebSocket pipeline. Fully independent.
   */
  const handleChatSend = useCallback(async (message: string) => {
    if (isChatLoading) return;

    // Cancel any in-flight request
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    chatAbortRef.current = new AbortController();

    const userMsgId = `u-${++chatMsgIdRef.current}`;
    const assistantMsgId = `a-${++chatMsgIdRef.current}`;

    // Build history for context (last 20 messages, skip empty assistants)
    const history = chatMessages
      .filter(m => m.content.trim())
      .slice(-20)
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    // Add bubbles immediately
    setChatMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: message },
      { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true },
    ]);

    setIsChatLoading(true);

    try {
      const resp = await fetch(`${HTTP_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
        signal: chatAbortRef.current.signal,
      });

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      // Stream SSE chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              accumulated = `Error: ${parsed.error}`;
            } else if (parsed.chunk) {
              accumulated += parsed.chunk;
            }
            setChatMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: accumulated } : m
              )
            );
          } catch {
            // skip malformed chunks
          }
        }
      }

      // Mark stream complete
      setChatMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (err: any) {
      if (err.name === 'AbortError') return; // user cancelled
      setChatMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: 'Could not reach the model. Is llama-server running on port 11434?', isStreaming: false }
            : m
        )
      );
    } finally {
      setIsChatLoading(false);
    }
  }, [chatMessages, isChatLoading]);

  const handleExecuteMesh = (overrideDecomp: any) => {
    executeQuery(currentQuery, currentContext, overrideDecomp);
  };

  const handleSelectHistorySession = (session: HistorySession) => {
    setCurrentQuery(session.query);
    setCurrentContext(session.context);
    setIsHistoryOpen(false);
  };

  const handleReRunSession = (session: HistorySession) => {
    setCurrentQuery(session.query);
    setCurrentContext(session.context);
    setIsHistoryOpen(false);
    executeQuery(session.query, session.context, null);
  };

  const handleSaveSettings = (updated: Settings) => {
    setSettings(updated);
    saveSettings(updated);
  };

  /** Reset visible session state */
  const handleReset = () => {
    // Cancel any in-flight chat request
    if (chatAbortRef.current) chatAbortRef.current.abort();
    setTasks([]);
    setSynthesisText('');
    setSynthesisStatus('idle');
    setAudit([]);
    setDecompPreview(null);
    setCurrentQuery('');
    setCurrentContext({});
    setContextInput('');
    setChatMessages([]);
    setIsChatLoading(false);
  };

  /** File drop callback: pre-fills context + suggested query */
  const handleFileAnalyzed = (text: string, suggestedQuery: string) => {
    setContextInput(JSON.stringify({ code: text }, null, 2));
    setCurrentQuery(suggestedQuery);
  };

  const allRedactedKeys = Array.from(new Set(tasks.flatMap(t => t.redacted_keys || [])));

  return (
    // h-screen + overflow-hidden = hard viewport lock so flex children fill correctly
    <div className="bg-background text-zinc-100 h-screen flex flex-col font-sans select-none overflow-hidden">
      {/* Global file drop zone (invisible overlay) */}
      <FileDropZone
        backendUrl={HTTP_BASE}
        onFileAnalyzed={handleFileAnalyzed}
      />

      {/* Top persistent navbar */}
      <TopBar
        health={health}
        stats={stats}
        wsStatus={wsStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onToggleAnalytics={() => setShowAnalytics(!showAnalytics)}
        showAnalytics={showAnalytics}
        timingMetrics={timingMetrics}
        onReset={handleReset}
        onOpenCostDashboard={() => setIsCostDashboardOpen(true)}
        appMode={appMode}
        onModeChange={setAppMode}
      />

      {/* Main area — fills remaining viewport height exactly */}
      <div className="flex-1 flex w-full min-h-0 relative overflow-hidden">

        {/* ─── CHAT MODE ────────────────────────────────────────────────── */}
        {appMode === 'chat' ? (
          <main className="flex-1 flex flex-col min-h-0 w-full max-w-3xl mx-auto">

            {/* Scrollable message thread */}
            <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl">⬡</div>
                  <p className="text-zinc-400 text-sm">Ask Prism anything.</p>
                  <p className="text-zinc-600 text-xs">Switch to Query mode for the full parallel pipeline.</p>
                </div>
              ) : (
                <ChatView messages={chatMessages} isExecuting={isChatLoading} />
              )}
            </div>

            {/* Input — always pinned to bottom */}
            <div className="flex-shrink-0 border-t border-zinc-800 bg-[#0a0a0a] px-4 py-3">
              <ChatInput onSend={handleChatSend} isLoading={isChatLoading} />
            </div>
          </main>

        ) : (
          /* ─── QUERY MODE ───────────────────────────────────────────────── */
          <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-6xl mx-auto w-full pb-20">

            {/* Query prompt input + Secret Scanner tabs */}
            <QueryInput
              onSubmit={handleQuerySubmit}
              isLoading={isExecuting || isPreviewLoading}
              onHistoryOpen={() => setIsHistoryOpen(true)}
              backendUrl={DEFAULT_WS_URL}
              contextInput={contextInput}
              setContextInput={setContextInput}
            />

            {/* Decomposition preview (editable before executing) */}
            {decompPreview && (
              <DecompPreview
                initialDecomp={decompPreview}
                onExecute={handleExecuteMesh}
                onCancel={() => setDecompPreview(null)}
              />
            )}

            {isPreviewLoading && (
              <div className="border border-border bg-card rounded p-6 flex flex-col items-center justify-center space-y-2 select-none animate-pulse">
                <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
                <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                  Analyzing query semantics &amp; building DAG...
                </span>
              </div>
            )}

            {/* Task grid + dependency graph */}
            {tasks.length > 0 && (
              <div className="space-y-4">
                <PrivacyGateBanner redactedKeys={allRedactedKeys} />
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <TaskGrid tasks={tasks} />
                  </div>
                  <div className="w-full lg:w-[260px] flex-shrink-0">
                    <DependencyGraph tasks={tasks} />
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Shield — shown after completion if secrets were redacted */}
            {synthesisStatus === 'completed' && allRedactedKeys.length > 0 && (
              <PrivacyShieldCard redactedKeys={allRedactedKeys} audit={audit} />
            )}

            {/* Synthesis output */}
            <SynthesisPanel
              synthesisText={synthesisText}
              status={synthesisStatus}
              sessionId={session_id}
              query={currentQuery}
              context={currentContext}
              audit={audit}
              tasks={tasks}
              redactedKeys={allRedactedKeys}
            />

            {/* Telemetry audit log */}
            <AuditLog audit={audit} sessionId={session_id} />

          </main>
        )}

        {/* ── Slide-out drawers (shared across both modes) ─────────────── */}
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSave={handleSaveSettings}
        />

        <HistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          history={history}
          onSelectSession={handleSelectHistorySession}
          onReRun={handleReRunSession}
          onDelete={deleteSessionFromHistory}
          onClearAll={clearHistory}
        />

        <AnalyticsSidebar
          isOpen={showAnalytics}
          onClose={() => setShowAnalytics(false)}
          audit={audit}
          tasks={tasks}
          stats={stats}
        />

        <CostDashboard
          isOpen={isCostDashboardOpen}
          onClose={() => setIsCostDashboardOpen(false)}
          history={history}
        />
      </div>
    </div>
  );
}

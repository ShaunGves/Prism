import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Code, BookOpen, Send, AlertTriangle, Shield } from 'lucide-react';
import { SecretScanner } from './SecretScanner';

interface Preset {
  id: string;
  name: string;
  label?: string;
  query: string;
  context: Record<string, any>;
}

interface QueryInputProps {
  onSubmit: (query: string, context: Record<string, any>) => void;
  isLoading: boolean;
  onHistoryOpen: () => void;
  backendUrl: string;
  contextInput: string;
  setContextInput: (val: string) => void;
}

const EXAMPLE_PILLS = [
  { label: "Explain a ZeroDivisionError and fix it", query: "Explain why this code throws a ZeroDivisionError, then write a robust fix with edge-case handling", context: { code: "def avg(items):\n    return sum(i['val'] for i in items) / len(items)" } },
  { label: "Audit a slow query pattern", query: "Find performance bottlenecks in this database access pattern and suggest optimized implementations", context: { code: "for user in db.query('SELECT id FROM users'):\n    profile = db.query(f'SELECT * FROM profiles WHERE user_id = {user.id}')" } },
  { label: "Design a microservices split", query: "Propose a microservices decomposition for this monolith, estimate migration effort, and flag risk areas", context: { description: "Django monolith with auth, billing, notifications, search — 200k LOC, 5 devs" } },
];

export const QueryInput: React.FC<QueryInputProps> = ({
  onSubmit,
  isLoading,
  onHistoryOpen,
  backendUrl,
  contextInput,
  setContextInput,
}) => {
  const [mode, setMode] = useState<'query' | 'scanner'>('query');
  const [query, setQuery] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [contextError, setContextError] = useState<string | null>(null);

  // Track previous value of contextInput to auto-collapse drawer when cleared externally
  const prevContextInputRef = useRef(contextInput);
  useEffect(() => {
    if (prevContextInputRef.current.trim() && !contextInput.trim()) {
      setShowContext(false);
      setContextError(null);
    }
    prevContextInputRef.current = contextInput;
  }, [contextInput]);

  // Deduce context filename for the persistent amber pill
  const getContextFilename = (): string => {
    if (!contextInput.trim()) return '';
    try {
      const parsed = JSON.parse(contextInput);
      if (parsed.filename) return parsed.filename;
      if (parsed.file) return parsed.file;
      if (parsed.code) {
        const match = parsed.code.match(/(?:def|async def)\s+(\w+)\(/);
        if (match && match[1]) return `${match[1]}.py`;
        return 'snippet.py';
      }
      if (parsed.aws_access_key || parsed.auth_header) return 'credentials.json';
      return 'context.json';
    } catch (e) {
      const match = contextInput.match(/(?:def|async def)\s+(\w+)\(/);
      if (match && match[1]) return `${match[1]}.py`;
      return 'raw_text.txt';
    }
  };

  // Fetch presets from backend API on mount
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const baseHttp = backendUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
        const resp = await fetch(`${baseHttp}/presets`);
        if (resp.ok) {
          const data = await resp.json();
          setPresets(data);
        }
      } catch (e) {
        console.warn('Could not fetch presets from API');
      }
    };
    fetchPresets();
  }, [backendUrl]);

  // Handle key shortcut (Cmd+Enter or Ctrl+Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleExecute();
    }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPresetId(id);
    const preset = presets.find(p => p.id === id);
    if (preset) {
      setQuery(preset.query);
      setContextInput(JSON.stringify(preset.context, null, 2));
      setShowContext(true);
      setContextError(null);
    }
  };

  const handleExecute = () => {
    if (!query.trim()) return;

    let parsedContext = {};
    if (contextInput.trim()) {
      try {
        parsedContext = JSON.parse(contextInput);
        setContextError(null);
      } catch (e) {
        parsedContext = { raw_text: contextInput };
      }
    }

    onSubmit(query, parsedContext);
  };

  const handlePillClick = (pill: typeof EXAMPLE_PILLS[0]) => {
    setQuery(pill.query);
    setContextInput(JSON.stringify(pill.context, null, 2));
    setShowContext(true);
    setSelectedPresetId('');
  };

  return (
    <div className="border border-border bg-card rounded-md overflow-hidden flex flex-col w-full">
      {/* Mode toggle tabs */}
      <div className="flex border-b border-border bg-[#0a0a0a] select-none">
        <button
          id="tab-query-gateway"
          onClick={() => setMode('query')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-all relative ${
            mode === 'query' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          QUERY GATEWAY
          {mode === 'query' && (
            <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-accent" />
          )}
        </button>
        <button
          id="tab-secret-scanner"
          onClick={() => setMode('scanner')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-all relative ${
            mode === 'scanner' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          SECRET SCANNER
          {mode === 'scanner' && (
            <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-accent" />
          )}
        </button>

        {/* Preset selector — only in query mode */}
        {mode === 'query' && (
          <div className="ml-auto flex items-center gap-1.5 pr-4">
            {contextInput.trim() && (
              <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 text-amber-500 text-[10px] font-mono rounded flex items-center gap-1.5 font-medium shadow-sm">
                <Code className="w-3.5 h-3.5 text-amber-500" />
                <span>CONTEXT: {getContextFilename()}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextInput('');
                    setContextError(null);
                  }}
                  className="hover:text-amber-300 font-bold focus:outline-none cursor-pointer transition-colors"
                  title="Clear Context"
                >
                  ✕
                </button>
              </span>
            )}
            <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={selectedPresetId}
              onChange={handlePresetChange}
              className="bg-transparent text-[10px] text-zinc-300 border border-zinc-800 rounded px-1.5 py-0.5 focus:outline-none focus:border-zinc-700 font-mono cursor-pointer"
            >
              <option value="" disabled className="bg-card">LOAD PRESET...</option>
              {presets.map(p => (
                <option key={p.id} value={p.id} className="bg-card">{p.label || p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content area switches between modes */}
      {mode === 'scanner' ? (
        <div className="p-0">
          <SecretScanner backendUrl={backendUrl} />
        </div>
      ) : (
        <>
          {/* Main split panels */}
          <div className={`flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border bg-[#0e0e0e]`}>
            {/* Main query prompt area */}
            <div className="flex-1 flex flex-col p-3">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Decompose user intent into parallel pipelines... (Cmd+Enter to execute)"
                className="w-full h-32 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:ring-0 leading-relaxed font-sans"
                disabled={isLoading}
              />

              {/* Empty state — example pills */}
              {!query.trim() && !isLoading && (
                <div className="mt-2 pt-2 border-t border-zinc-900">
                  <p className="text-[10px] text-zinc-600 font-mono mb-2 uppercase tracking-widest">
                    Decomposes queries → routes sub-tasks in parallel → synthesizes locally
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLE_PILLS.map((pill) => (
                      <button
                        key={pill.label}
                        onClick={() => handlePillClick(pill)}
                        className="text-[10px] font-mono px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-600 bg-zinc-950 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Context drawer */}
            {showContext && (
              <div className="w-full md:w-[40%] flex flex-col p-3 bg-[#0c0c0c]">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-900 select-none">
                  <span className="text-[10px] font-mono text-zinc-500 tracking-wider flex items-center gap-1">
                    <Code className="w-3 h-3 text-zinc-400" /> ATTACHED_CONTEXT (JSON OR TEXT)
                  </span>
                  <button
                    onClick={() => setShowContext(false)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
                  >
                    HIDE
                  </button>
                </div>
                <textarea
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  placeholder='{ "key": "value" } or raw paste...'
                  className="w-full h-28 bg-transparent text-xs font-mono text-zinc-300 placeholder-zinc-700 resize-none focus:outline-none focus:ring-0 leading-relaxed"
                  disabled={isLoading}
                />
                {contextError && (
                  <span className="text-[9px] text-rose-500 font-mono mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> {contextError}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bottom control bar */}
          <div className="flex items-center justify-between border-t border-border bg-[#0d0d0d] px-4 py-2.5 select-none">
            <div className="flex items-center gap-3">
              {!showContext && (
                <button
                  onClick={() => setShowContext(true)}
                  className="text-[10px] font-mono border border-zinc-800 hover:border-zinc-700 bg-zinc-950 px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  + ATTACH CONTEXT
                </button>
              )}
              <button
                onClick={onHistoryOpen}
                className="text-[10px] font-mono border border-zinc-800 hover:border-zinc-700 bg-zinc-950 px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                VIEW HISTORY
              </button>
            </div>

            <button
              onClick={handleExecute}
              disabled={isLoading || !query.trim()}
              id="execute-query-btn"
              className={`px-3.5 py-1 text-xs font-mono rounded flex items-center gap-1.5 transition-all select-none ${
                isLoading || !query.trim()
                  ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                  : 'bg-zinc-100 hover:bg-white text-black font-semibold cursor-pointer'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
                  <span>RUNNING...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>EXECUTE</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
export default QueryInput;

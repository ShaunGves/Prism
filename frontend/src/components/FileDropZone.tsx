import React, { useState, useEffect, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle, X, ShieldAlert } from 'lucide-react';
import { ScanResult } from '../types';

interface FileAnalysisResult {
  filename: string;
  text_content: string;
  safe: boolean;
  scan_result: ScanResult;
  suggested_query: string;
}

interface FileDropZoneProps {
  backendUrl: string;
  onFileAnalyzed: (text: string, suggestedQuery: string) => void;
}

type DropState = 'idle' | 'dragging' | 'loading' | 'result';

const ALLOWED_EXTENSIONS = ['.txt', '.py', '.js', '.ts', '.md', '.json', '.yaml', '.yml', '.csv', '.env'];

export const FileDropZone: React.FC<FileDropZoneProps> = ({ backendUrl, onFileAnalyzed }) => {
  const [dropState, setDropState] = useState<DropState>('idle');
  const [result, setResult] = useState<FileAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragCounter, setDragCounter] = useState(0); // use counter to avoid flicker on child elements

  // Register global drag listeners
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      setDragCounter(c => c + 1);
      setDropState('dragging');
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter(c => {
        const next = c - 1;
        if (next <= 0) {
          setDropState(prev => (prev === 'dragging' ? 'idle' : prev));
          return 0;
        }
        return next;
      });
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter(0);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [backendUrl]);

  const handleFile = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Supported: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setDropState('result');
      return;
    }

    setDropState('loading');
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const resp = await fetch(`${backendUrl}/analyze-file`, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'File analysis failed');
      }

      const data: FileAnalysisResult = await resp.json();
      setResult(data);
      setDropState('result');
    } catch (e: any) {
      setError(e.message || 'Failed to analyze file');
      setDropState('result');
    }
  }, [backendUrl]);

  const handleAnalyze = () => {
    if (result) {
      onFileAnalyzed(result.text_content, result.suggested_query);
      setDropState('idle');
      setResult(null);
    }
  };

  const handleDismiss = () => {
    setDropState('idle');
    setResult(null);
    setError(null);
    setDragCounter(0);
  };

  // Nothing to show
  if (dropState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleDismiss}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
      >
        {dropState === 'dragging' && (
          <div className="border-2 border-dashed border-zinc-600 bg-zinc-950/90 rounded-2xl p-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center animate-pulse">
              <Upload className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-200">Drop to Analyze</p>
              <p className="text-sm text-zinc-500 mt-1 font-mono">
                {ALLOWED_EXTENSIONS.join('  ')}
              </p>
            </div>
            <p className="text-xs text-zinc-600 font-mono">
              Privacy gate will scan for secrets before any cloud model sees it
            </p>
          </div>
        )}

        {dropState === 'loading' && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-10 text-center space-y-4">
            <div className="w-10 h-10 mx-auto border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
            <p className="text-sm text-zinc-400 font-mono">Scanning file for secrets...</p>
          </div>
        )}

        {dropState === 'result' && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900">
              <div className="flex items-center gap-2">
                {error ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : result?.safe ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-sm font-mono font-semibold text-zinc-200">
                  {error ? 'Error' : result?.filename}
                </span>
              </div>
              <button onClick={handleDismiss} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {error ? (
                <p className="text-sm text-rose-400 font-mono">{error}</p>
              ) : result && (
                <>
                  {result.safe ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">No secrets detected</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          File is clean. It will be attached as context for your next query.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-200">
                          {result.scan_result.total} secret{result.scan_result.total !== 1 ? 's' : ''} found
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          The privacy gate will automatically redact these before any cloud model sees them.
                          Your local Qwen3 processes the raw file.
                        </p>
                        {/* Severity summary */}
                        <div className="flex gap-3 mt-2">
                          {result.scan_result.summary.critical > 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400">
                              {result.scan_result.summary.critical} CRITICAL
                            </span>
                          )}
                          {result.scan_result.summary.high > 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              {result.scan_result.summary.high} HIGH
                            </span>
                          )}
                          {result.scan_result.summary.medium > 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400">
                              {result.scan_result.summary.medium} MEDIUM
                            </span>
                          )}
                        </div>
                        {/* Top 5 findings */}
                        <div className="mt-2 space-y-1 font-mono text-[10px]">
                          {result.scan_result.secrets_found.slice(0, 5).map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-zinc-500">
                              <span className="text-zinc-700">L{s.line}</span>
                              <span className={
                                s.severity === 'critical' ? 'text-rose-400' :
                                s.severity === 'high' ? 'text-amber-400' : 'text-sky-400'
                              }>{s.type}</span>
                              <span className="text-zinc-700">{s.preview}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggested query preview */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Suggested query</p>
                    <p className="text-xs text-zinc-300">{result.suggested_query}</p>
                  </div>
                </>
              )}
            </div>

            {/* Footer actions */}
            {!error && result && (
              <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-zinc-800 bg-zinc-950/60">
                <button
                  onClick={handleDismiss}
                  className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAnalyze}
                  className="px-4 py-1.5 bg-zinc-100 hover:bg-white text-black text-xs font-mono font-semibold rounded transition-colors cursor-pointer"
                >
                  {result.safe ? 'Use as Context' : 'Analyze Anyway'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileDropZone;

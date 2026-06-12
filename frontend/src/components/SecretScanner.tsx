import React, { useState, useRef, useCallback } from 'react';
import {
  Shield, Upload, FileText, AlertTriangle, CheckCircle,
  Download, Copy, Loader2, FolderSearch, ChevronDown, ChevronUp,
} from 'lucide-react';
import { ScanResult } from '../types';

interface SecretScannerProps {
  backendUrl: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-slate-400',
};
const SEVERITY_TEXT: Record<string, string> = {
  critical: 'text-rose-400',
  high: 'text-amber-400',
  medium: 'text-slate-400',
};

/** Auto-scan response shape from GET /scan/auto */
interface AutoScanResult {
  root: string;
  files_scanned: number;
  files_with_secrets: number;
  total_secrets: number;
  safe: boolean;
  summary: { critical: number; high: number; medium: number };
  results: ScanResult[];
}

function FindingRow({ s }: { s: ScanResult['secrets_found'][0] }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-colors">
      <span className={`h-2 w-2 rounded-full shrink-0 ${SEVERITY_COLOR[s.severity] ?? 'bg-slate-500'}`} />
      <span className="font-mono text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 shrink-0">
        {s.type}
      </span>
      <span className={`font-mono text-[10px] shrink-0 ${SEVERITY_TEXT[s.severity] ?? 'text-slate-300'}`}>
        {s.preview}
      </span>
      <span className="flex-1" />
      <span className="font-mono text-[9px] text-zinc-600 shrink-0">L{s.line}</span>
    </div>
  );
}

function SummaryPills({ summary }: { summary: { critical: number; high: number; medium: number } }) {
  return (
    <div className="flex gap-2 text-[10px] font-mono flex-wrap">
      {summary.critical > 0 && (
        <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400">
          {summary.critical} critical
        </span>
      )}
      {summary.high > 0 && (
        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400">
          {summary.high} high
        </span>
      )}
      {summary.medium > 0 && (
        <span className="px-2 py-0.5 rounded bg-slate-500/15 border border-slate-500/30 text-slate-400">
          {summary.medium} medium
        </span>
      )}
    </div>
  );
}

export const SecretScanner: React.FC<SecretScannerProps> = ({ backendUrl }) => {
  // input mode: 'paste' = manual paste/upload | 'auto' = server-side project scan
  const [inputMode, setInputMode] = useState<'paste' | 'auto'>('auto');

  // ── paste/upload state ──────────────────────────────────────────────────
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [pasteResult, setPasteResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── auto-scan state ──────────────────────────────────────────────────────
  const [autoResult, setAutoResult] = useState<AutoScanResult | null>(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [rootPath, setRootPath] = useState('.');   // user-editable path

  // ── shared ──────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  const baseHttp = backendUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');

  // ── paste/upload handlers ────────────────────────────────────────────────
  const handleFile = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setContent(e.target?.result as string ?? '');
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handlePasteScan = async () => {
    if (!content.trim()) return;
    setIsScanning(true);
    setPasteResult(null);
    try {
      const resp = await fetch(`${baseHttp}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: filename || 'unknown' }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setPasteResult(await resp.json());
    } catch (e) {
      alert('Scan failed. Is the Prism backend running?');
    } finally {
      setIsScanning(false);
    }
  };

  // ── auto-scan handler ────────────────────────────────────────────────────
  const handleAutoScan = async () => {
    setIsAutoScanning(true);
    setAutoResult(null);
    setExpandedFile(null);
    try {
      const url = `${baseHttp}/scan/auto?root=${encodeURIComponent(rootPath)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setAutoResult(await resp.json());
    } catch (e) {
      alert('Auto-scan failed. Is the Prism backend running?');
    } finally {
      setIsAutoScanning(false);
    }
  };

  // ── shared: git hook + copy ──────────────────────────────────────────────
  const handleDownloadHook = async () => {
    const resp = await fetch(`${baseHttp}/scan/hook`);
    if (!resp.ok) return;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pre-commit';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    const data = inputMode === 'auto' ? autoResult : pasteResult;
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── derived ──────────────────────────────────────────────────────────────
  const pasteHeaderColor = pasteResult
    ? pasteResult.safe ? 'text-emerald-400'
      : pasteResult.summary.critical > 0 ? 'text-rose-400'
        : pasteResult.summary.high > 0 ? 'text-amber-400'
          : 'text-slate-300'
    : 'text-zinc-300';

  const autoHeaderColor = autoResult
    ? autoResult.safe ? 'text-emerald-400'
      : autoResult.summary.critical > 0 ? 'text-rose-400'
        : autoResult.summary.high > 0 ? 'text-amber-400'
          : 'text-slate-300'
    : 'text-zinc-300';

  const hasActions = (inputMode === 'auto' && autoResult && !autoResult.safe)
    || (inputMode === 'paste' && pasteResult && !pasteResult.safe);

  return (
    <div className="flex flex-col w-full">

      {/* ── mode toggle ──────────────────────────────────────────────────── */}
      <div className="flex border-b border-zinc-900 bg-[#0b0b0b] select-none">
        <button
          onClick={() => setInputMode('auto')}
          className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono uppercase tracking-wider relative transition-colors ${
            inputMode === 'auto' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <FolderSearch className="w-3.5 h-3.5" />
          SCAN PROJECT
          {inputMode === 'auto' && <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-accent" />}
        </button>
        <button
          onClick={() => setInputMode('paste')}
          className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono uppercase tracking-wider relative transition-colors ${
            inputMode === 'paste' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          PASTE / UPLOAD
          {inputMode === 'paste' && <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-accent" />}
        </button>
      </div>

      {/* ── body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border min-h-[280px]">

        {/* LEFT PANEL — input */}
        <div className="flex-1 flex flex-col p-4 gap-3">

          {inputMode === 'auto' ? (
            /* AUTO SCAN input */
            <>
              <p className="text-[10px] font-mono text-zinc-500 leading-relaxed">
                Prism will walk the server's working directory and scan all
                common secret-bearing files — <span className="text-zinc-400">.env</span>,{' '}
                <span className="text-zinc-400">config.yaml</span>,{' '}
                <span className="text-zinc-400">*.pem</span>,{' '}
                <span className="text-zinc-400">docker-compose.yml</span>, etc.
                <br />No file content is sent to the browser until a secret is found.
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                  Project root (relative to backend working dir)
                </label>
                <input
                  type="text"
                  value={rootPath}
                  onChange={(e) => setRootPath(e.target.value)}
                  placeholder="."
                  className="w-full bg-[#0c0c0c] border border-zinc-900 hover:border-zinc-700 focus:border-zinc-600 px-3 py-1.5 rounded text-xs font-mono text-zinc-300 focus:outline-none transition-colors"
                />
              </div>

              {/* What gets scanned */}
              <div className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-[10px] font-mono text-zinc-500 leading-5">
                <span className="text-zinc-400 block mb-1">Scans for:</span>
                {['.env · .env.*', 'config.yaml · config.json', 'secrets.yaml · secrets.json',
                  '*.pem · *.key', 'docker-compose.yml', 'terraform.tfvars',
                  'settings.py · application.properties'].map(p => (
                  <span key={p} className="block">· {p}</span>
                ))}
                <span className="block mt-1 text-zinc-700">Skips: node_modules · .git · __pycache__ · venv · dist</span>
              </div>

              <button
                onClick={handleAutoScan}
                disabled={isAutoScanning}
                id="auto-scan-btn"
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded text-xs font-mono font-semibold transition-all mt-auto ${
                  isAutoScanning
                    ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                    : 'bg-zinc-100 hover:bg-white text-black cursor-pointer'
                }`}
              >
                {isAutoScanning ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> SCANNING PROJECT...</>
                ) : (
                  <><FolderSearch className="w-3.5 h-3.5" /> SCAN PROJECT</>
                )}
              </button>
            </>
          ) : (
            /* PASTE / UPLOAD input */
            <>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span className="text-xs font-mono">
                  {filename ? (
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      {filename}
                    </span>
                  ) : (
                    'Drop .env · .json · .yaml · .py · any text file — or click to browse'
                  )}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
              </div>

              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="filename (e.g. .env)"
                className="w-full bg-[#0c0c0c] border border-zinc-900 hover:border-zinc-700 focus:border-zinc-600 px-3 py-1.5 rounded text-xs font-mono text-zinc-300 focus:outline-none transition-colors"
              />

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"Paste file content here...\n\nAWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nSECRET_KEY='mysecret123456789012'\nDATABASE_URL=postgres://user:pass@host/db"}
                className="flex-1 min-h-[140px] bg-[#0b0b0b] border border-zinc-900 hover:border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300 placeholder-zinc-700 resize-none focus:outline-none focus:border-zinc-700 leading-relaxed transition-colors"
              />

              <button
                onClick={handlePasteScan}
                disabled={isScanning || !content.trim()}
                id="scan-file-btn"
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded text-xs font-mono font-semibold transition-all ${
                  isScanning || !content.trim()
                    ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                    : 'bg-zinc-100 hover:bg-white text-black cursor-pointer'
                }`}
              >
                {isScanning ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> SCANNING...</>
                ) : (
                  <><Shield className="w-3.5 h-3.5" /> SCAN FILE</>
                )}
              </button>
            </>
          )}
        </div>

        {/* RIGHT PANEL — results */}
        <div className="flex-1 flex flex-col p-4 bg-[#0c0c0c] gap-3">

          {/* ── AUTO SCAN results ─────────────────────────────────────── */}
          {inputMode === 'auto' && (
            !autoResult ? (
              <div className="flex-1 flex items-center justify-center text-zinc-700 text-xs font-mono">
                Results appear here after scan
              </div>
            ) : autoResult.safe ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
                <span className="text-emerald-400 font-mono font-semibold text-sm tracking-wider">
                  PROJECT IS CLEAN
                </span>
                <span className="text-xs text-zinc-500 font-mono text-center">
                  {autoResult.files_scanned} file{autoResult.files_scanned !== 1 ? 's' : ''} scanned — no secrets found
                </span>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <span className={`font-mono font-bold text-sm tracking-wider ${autoHeaderColor}`}>
                    <AlertTriangle className="inline w-4 h-4 mr-1.5 mb-0.5" />
                    {autoResult.total_secrets} SECRET{autoResult.total_secrets !== 1 ? 'S' : ''} IN{' '}
                    {autoResult.files_with_secrets} FILE{autoResult.files_with_secrets !== 1 ? 'S' : ''}
                  </span>
                  <span className="text-[9px] text-zinc-600 font-mono shrink-0">
                    {autoResult.files_scanned} files scanned
                  </span>
                </div>

                <SummaryPills summary={autoResult.summary} />

                {/* Per-file accordion */}
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[320px] pr-1">
                  {autoResult.results.map((fileResult) => {
                    const isOpen = expandedFile === fileResult.filename;
                    const fileSev = fileResult.summary.critical > 0 ? 'critical'
                      : fileResult.summary.high > 0 ? 'high' : 'medium';
                    return (
                      <div key={fileResult.filename} className="border border-zinc-900 rounded overflow-hidden">
                        {/* File header — click to expand */}
                        <button
                          onClick={() => setExpandedFile(isOpen ? null : fileResult.filename)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 bg-zinc-950 hover:bg-zinc-900 transition-colors text-left"
                        >
                          <span className={`h-2 w-2 rounded-full shrink-0 ${SEVERITY_COLOR[fileSev]}`} />
                          <span className="font-mono text-[10px] text-zinc-300 flex-1 truncate">
                            {fileResult.filename}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-600 shrink-0">
                            {fileResult.total} secret{fileResult.total !== 1 ? 's' : ''}
                          </span>
                          {isOpen
                            ? <ChevronUp className="w-3 h-3 text-zinc-600 shrink-0" />
                            : <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0" />}
                        </button>

                        {/* Findings */}
                        {isOpen && (
                          <div className="px-3 py-2 space-y-1.5 bg-[#0a0a0a]">
                            {fileResult.secrets_found.map((s, i) => (
                              <FindingRow key={i} s={s} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-zinc-900">
                  <button
                    onClick={handleDownloadHook}
                    id="download-git-hook-btn"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono border border-zinc-800 hover:border-zinc-600 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> GENERATE GIT HOOK
                  </button>
                  <button
                    onClick={handleCopyReport}
                    id="copy-auto-report-btn"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono border border-zinc-800 hover:border-zinc-600 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> {copied ? 'COPIED!' : 'COPY REPORT'}
                  </button>
                </div>
              </>
            )
          )}

          {/* ── PASTE results ─────────────────────────────────────────── */}
          {inputMode === 'paste' && (
            !pasteResult ? (
              <div className="flex-1 flex items-center justify-center text-zinc-700 text-xs font-mono">
                Results appear here after scan
              </div>
            ) : pasteResult.safe ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
                <span className="text-emerald-400 font-mono font-semibold text-sm tracking-wider">
                  NO SECRETS DETECTED
                </span>
                <span className="text-xs text-zinc-500 font-mono">{pasteResult.filename} — clean</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className={`font-mono font-bold text-sm tracking-wider ${pasteHeaderColor}`}>
                    <AlertTriangle className="inline w-4 h-4 mr-1.5 mb-0.5" />
                    {pasteResult.total} SECRET{pasteResult.total !== 1 ? 'S' : ''} DETECTED
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{pasteResult.filename}</span>
                </div>

                <SummaryPills summary={pasteResult.summary} />

                <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[300px] pr-1">
                  {pasteResult.secrets_found.map((s, i) => (
                    <FindingRow key={i} s={s} />
                  ))}
                </div>

                <div className="flex gap-2 pt-1 border-t border-zinc-900">
                  <button
                    onClick={handleDownloadHook}
                    id="download-git-hook-btn"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono border border-zinc-800 hover:border-zinc-600 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> GENERATE GIT HOOK
                  </button>
                  <button
                    onClick={handleCopyReport}
                    id="copy-report-btn"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono border border-zinc-800 hover:border-zinc-600 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> {copied ? 'COPIED!' : 'COPY REPORT'}
                  </button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default SecretScanner;

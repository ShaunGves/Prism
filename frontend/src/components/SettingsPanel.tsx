import React, { useState } from 'react';
import { X, Lock, Sliders, ToggleLeft, ToggleRight, Sparkles, Activity } from 'lucide-react';
import { Settings } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localUrl, setLocalUrl] = useState(settings.localUrl);
  const [groqKey, setGroqKey] = useState(settings.groqKey);
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey);
  const [groqModel, setGroqModel] = useState(settings.groqModel);
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel);
  const [maxTokensLocal, setMaxTokensLocal] = useState(settings.maxTokensLocal);
  const [maxTokensGroq, setMaxTokensGroq] = useState(settings.maxTokensGroq);
  const [maxTokensGemini, setMaxTokensGemini] = useState(settings.maxTokensGemini);
  const [costLimit, setCostLimit] = useState(settings.costLimit);
  const [decompTemp, setDecompTemp] = useState(settings.decompTemp);
  const [showPreview, setShowPreview] = useState(settings.showPreview);
  const [autoExport, setAutoExport] = useState(settings.autoExport);

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const baseHttp = localUrl.replace(/\/v1$/, '');
      const resp = await fetch(`${baseHttp}/health`, { method: 'GET' }).catch(() => {
        // Fallback completions check
        return fetch(`${localUrl}/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'ping', max_tokens: 1 }),
        });
      });
      if (resp.ok) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('failed');
      }
    } catch (e) {
      setConnectionStatus('failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleApply = () => {
    const updated: Settings = {
      localUrl,
      groqKey,
      geminiKey,
      groqModel,
      geminiModel,
      maxTokensLocal,
      maxTokensGroq,
      maxTokensGemini,
      costLimit,
      decompTemp,
      showPreview,
      autoExport,
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-card border-l border-border z-50 flex flex-col shadow-2xl animate-fadeIn select-none">
      {/* Header */}
      <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-accent" />
          <span className="text-xs font-mono font-semibold text-zinc-200 uppercase tracking-wider">Engine Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Local LLM settings */}
        <div className="space-y-2.5">
          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono block border-b border-zinc-900 pb-1">
            Local LLM configuration
          </label>
          <div className="space-y-1.5">
            <span className="text-[10px] text-zinc-400 font-mono">Endpoint URL:</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-900 focus:border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-300 focus:outline-none font-mono"
              />
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              >
                {testingConnection ? '...' : 'TEST'}
              </button>
            </div>
            {connectionStatus === 'success' && (
              <span className="text-[9px] text-emerald-500 font-mono flex items-center gap-1">
                <Activity className="w-3 h-3" /> Connection active
              </span>
            )}
            {connectionStatus === 'failed' && (
              <span className="text-[9px] text-rose-500 font-mono">Connection offline</span>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Max tokens limit:</span>
              <span className="text-zinc-300">{maxTokensLocal}</span>
            </div>
            <input
              type="range"
              min={256}
              max={8192}
              step={256}
              value={maxTokensLocal}
              onChange={(e) => setMaxTokensLocal(parseInt(e.target.value, 10))}
              className="w-full accent-accent h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Cloud Credentials */}
        <div className="space-y-2.5">
          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono block border-b border-zinc-900 pb-1">
            Cloud Provider Keys
          </label>
          <div className="space-y-1.5">
            <span className="text-[10px] text-zinc-400 font-mono">Groq API Key:</span>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="sk-groq-..."
              className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-300 focus:outline-none font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] text-zinc-400 font-mono">Gemini API Key:</span>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-300 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Model Selections */}
        <div className="space-y-2.5">
          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono block border-b border-zinc-900 pb-1">
            Model Selection overrides
          </label>
          <div className="space-y-1.5">
            <span className="text-[10px] text-zinc-400 font-mono block">Groq Model:</span>
            <select
              value={groqModel}
              onChange={(e) => setGroqModel(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-200 border border-zinc-900 focus:border-zinc-700 rounded px-2 py-1 text-xs font-mono"
            >
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Versatile)</option>
              <option value="llama-3.1-8b-instant">Llama 3.1 8B (Instant)</option>
              <option value="mixtral-8x7b">Mixtral 8x7B (MoE)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Groq max output:</span>
              <span className="text-zinc-300">{maxTokensGroq}</span>
            </div>
            <input
              type="range"
              min={256}
              max={4096}
              step={256}
              value={maxTokensGroq}
              onChange={(e) => setMaxTokensGroq(parseInt(e.target.value, 10))}
              className="w-full accent-accent h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-zinc-400 font-mono block">Gemini Model:</span>
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-200 border border-zinc-900 focus:border-zinc-700 rounded px-2 py-1 text-xs font-mono"
            >
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Gemini max output:</span>
              <span className="text-zinc-300">{maxTokensGemini}</span>
            </div>
            <input
              type="range"
              min={256}
              max={4096}
              step={256}
              value={maxTokensGemini}
              onChange={(e) => setMaxTokensGemini(parseInt(e.target.value, 10))}
              className="w-full accent-accent h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Hyperparameters & Limits */}
        <div className="space-y-2.5">
          <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono block border-b border-zinc-900 pb-1">
            Limits & Parameters
          </label>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Decomp Temp:</span>
              <span className="text-zinc-300">{decompTemp}</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={0.5}
              step={0.05}
              value={decompTemp}
              onChange={(e) => setDecompTemp(parseFloat(e.target.value))}
              className="w-full accent-accent h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Session Cost Warning:</span>
              <span className="text-zinc-300">${costLimit.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={25.0}
              step={0.5}
              value={costLimit}
              onChange={(e) => setCostLimit(parseFloat(e.target.value))}
              className="w-full accent-accent h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Features Toggle switches */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-mono">Decomposition Preview:</span>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              {showPreview ? (
                <ToggleRight className="w-7 h-7 text-accent" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-zinc-800" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-mono">Auto-export Audit CSV:</span>
            <button
              onClick={() => setAutoExport(!autoExport)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              {autoExport ? (
                <ToggleRight className="w-7 h-7 text-accent" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-zinc-800" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="h-14 border-t border-border px-4 flex items-center justify-end gap-3 bg-[#0d0d0d]">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="px-3.5 py-1.5 text-xs font-mono font-semibold bg-zinc-100 hover:bg-white text-black rounded transition-colors"
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
};
export default SettingsPanel;

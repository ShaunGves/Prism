import React, { useEffect, useState } from 'react';
import { Shield, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { TaskResult } from '../types';

interface PrivacyShieldCardProps {
  redactedKeys: string[];
  audit: TaskResult[];
}

export const PrivacyShieldCard: React.FC<PrivacyShieldCardProps> = ({ redactedKeys, audit }) => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (redactedKeys.length === 0) return null;

  // Which backends received redacted payloads
  const cloudBackends = audit
    .filter(r => r.redacted_keys.length > 0 && r.backend !== 'local_qwen3')
    .map(r => r.backend);
  const uniqueCloud = Array.from(new Set(cloudBackends));

  const subtitle = uniqueCloud.length > 0
    ? `${uniqueCloud.join(' + ')} never saw ${redactedKeys.length > 1 ? 'these' : 'this'}.`
    : 'No cloud model saw these values.';

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="rounded-lg border border-emerald-500/25 bg-gradient-to-br from-emerald-950/60 to-zinc-950 overflow-hidden select-none">
        {/* Main card */}
        <div className="px-5 py-4 flex items-start gap-4">
          {/* Shield icon */}
          <div className="mt-0.5 p-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300 tracking-wide">
              🛡 PRISM PROTECTED THIS QUERY
            </p>
            <p className="text-sm text-zinc-300 mt-1">
              <span className="font-bold text-emerald-400">{redactedKeys.length}</span>{' '}
              secret{redactedKeys.length !== 1 ? 's' : ''} kept off the cloud
            </p>

            {/* Key badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {redactedKeys.map(k => (
                <span
                  key={k}
                  className="px-2 py-0.5 text-[11px] font-mono bg-zinc-900 border border-zinc-700 text-amber-400 rounded-sm font-medium"
                >
                  {k}
                </span>
              ))}
            </div>

            <p className="text-xs text-zinc-400 mt-2">{subtitle}</p>
          </div>

          {/* Lock + expand */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Lock className="w-4 h-4 text-emerald-600" />
            {audit.length > 0 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 transition-colors"
              >
                {expanded ? 'HIDE' : 'DETAILS'}
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Expanded: per-task redaction breakdown */}
        {expanded && (
          <div className="border-t border-emerald-500/10 bg-zinc-950/60 px-5 py-3 space-y-1.5">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
              Redaction log per task
            </p>
            {audit.map(r => (
              <div key={r.task_id} className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-zinc-600 w-16 shrink-0">{r.task_id.toUpperCase().slice(0, 6)}</span>
                <span className={`shrink-0 font-medium ${
                  r.backend === 'local_qwen3' ? 'text-teal-400' :
                  r.backend === 'groq' ? 'text-purple-400' : 'text-blue-400'
                }`}>{r.backend}</span>
                {r.redacted_keys.length > 0 ? (
                  <span className="text-emerald-500">
                    ✓ {r.redacted_keys.length} secret{r.redacted_keys.length !== 1 ? 's' : ''} withheld
                  </span>
                ) : (
                  <span className="text-zinc-600">no secrets in payload</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrivacyShieldCard;

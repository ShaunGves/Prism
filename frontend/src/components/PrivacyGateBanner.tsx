import React from 'react';
import { Shield, Lock } from 'lucide-react';

interface PrivacyGateBannerProps {
  redactedKeys: string[];
}

export const PrivacyGateBanner: React.FC<PrivacyGateBannerProps> = ({ redactedKeys }) => {
  if (redactedKeys.length === 0) return null;

  return (
    <div className="border border-amber-500/20 bg-amber-500/5 px-4 py-2 rounded flex items-center justify-between gap-3 text-xs select-none">
      <div className="flex items-center gap-2 text-amber-500 font-mono">
        <Shield className="w-4 h-4" />
        <span className="font-semibold uppercase tracking-wider">Privacy Gate Active</span>
      </div>
      <div className="flex-1 flex flex-wrap items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
        <span>Intercepted outgoing cloud payloads. Redacted:</span>
        {redactedKeys.map((key) => (
          <span
            key={key}
            className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 text-amber-500 font-bold rounded-sm font-mono text-[10px]"
          >
            {key}
          </span>
        ))}
      </div>
      <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
        <Lock className="w-3 h-3 text-zinc-600" />
        <span>RE-INJECTED ON RETURN</span>
      </div>
    </div>
  );
};
export default PrivacyGateBanner;

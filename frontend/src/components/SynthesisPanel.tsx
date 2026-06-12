import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Lock, Copy, Check, FileDown, Share2, Eye, EyeOff } from 'lucide-react';
import { TaskResult, SubTask } from '../types';
import { ExplainCard } from './ExplainCard';

interface SynthesisPanelProps {
  synthesisText: string;
  status: 'idle' | 'running' | 'completed';
  sessionId: string;
  query: string;
  context: Record<string, any>;
  audit: TaskResult[];
  tasks?: SubTask[];
  redactedKeys?: string[];
}

interface TextSegment {
  text: string;
  tag: string | null;
}

export const SynthesisPanel: React.FC<SynthesisPanelProps> = ({
  synthesisText,
  status,
  sessionId,
  query,
  context,
  audit,
  tasks = [],
  redactedKeys = [],
}) => {
  const [showProvenance, setShowProvenance] = useState(false);
  const [copiedType, setCopiedType] = useState<'markdown' | 'text' | 'json' | null>(null);

  if (status === 'idle' && !synthesisText) return null;

  // Utility: strip XML tags from text
  const stripTags = (text: string) => {
    return text.replace(/<\/?(t\d+|synthesis)>/g, '');
  };

  // Parser: segment text by XML tags for provenance highlighting
  const parseProvenance = (text: string): TextSegment[] => {
    const regex = /<(t\d+|synthesis)>([\s\S]*?)<\/\1>/g;
    const segments: TextSegment[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const tag = match[1];
      const content = match[2];

      if (start > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, start),
          tag: null,
        });
      }

      segments.push({
        text: content,
        tag,
      });

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        tag: null,
      });
    }

    return segments;
  };

  const getProvenanceStyle = (tag: string | null) => {
    if (!tag || tag === 'synthesis') return '';
    const num = parseInt(tag.replace('t', ''), 10);
    
    // Harmonious dark neutral colors matching each task
    switch (num % 5) {
      case 1: return 'bg-teal-500/10 border-b border-teal-500/30 text-teal-200 px-0.5 rounded-sm';
      case 2: return 'bg-sky-500/10 border-b border-sky-500/30 text-sky-200 px-0.5 rounded-sm';
      case 3: return 'bg-indigo-500/10 border-b border-indigo-500/30 text-indigo-200 px-0.5 rounded-sm';
      case 4: return 'bg-amber-500/10 border-b border-amber-500/30 text-amber-200 px-0.5 rounded-sm';
      default: return 'bg-fuchsia-500/10 border-b border-fuchsia-500/30 text-fuchsia-200 px-0.5 rounded-sm';
    }
  };

  const handleCopy = async (type: 'markdown' | 'text' | 'json') => {
    let textToCopy = '';
    const cleanText = stripTags(synthesisText);
    
    if (type === 'markdown') {
      textToCopy = cleanText;
    } else if (type === 'text') {
      // standard plain text
      textToCopy = cleanText;
    } else if (type === 'json') {
      const shareData = {
        session_id: sessionId,
        query,
        context,
        audit: audit.map(a => ({
          task_id: a.task_id,
          backend: a.backend,
          latency_ms: a.latency_ms,
          cost_usd: a.cost_usd,
          redacted_keys: a.redacted_keys,
          token_count: a.token_count
        })),
        synthesis: cleanText,
        completed_at: new Date().toISOString()
      };
      textToCopy = JSON.stringify(shareData, null, 2);
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const handleExportMd = () => {
    const cleanText = stripTags(synthesisText);
    const content = `# Prism Cognitive Mesh Synthesis\n\n**Query:** ${query}\n**Session ID:** \`${sessionId}\`\n\n---\n\n${cleanText}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `prism_synthesis_${sessionId.substring(0, 8)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const segments = parseProvenance(synthesisText);
  const cleanMarkdown = stripTags(synthesisText);

  return (
    <div className="border border-border bg-card rounded-md w-full flex flex-col overflow-hidden animate-fadeIn">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border bg-[#0d0d0d] px-4 py-2.5 select-none">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
            Synthesis · local_qwen3 · private
          </span>
          {status === 'running' && (
            <span className="relative flex h-1.5 w-1.5 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
          )}
        </div>
        
        {/* Toggle & exports */}
        <div className="flex items-center gap-2">
          {synthesisText && (
            <button
              onClick={() => setShowProvenance(!showProvenance)}
              className={`px-2 py-0.5 rounded border text-[9px] font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                showProvenance
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                  : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {showProvenance ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>PROVENANCE</span>
            </button>
          )}
        </div>
      </div>

      {/* Main output area */}
      <div className="p-4 text-sm leading-relaxed text-zinc-200 bg-[#0e0e0e] max-h-[400px] overflow-y-auto font-sans select-text">
        {status === 'running' && !synthesisText && (
          <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs animate-pulse">
            <span>Executing final local compilation...</span>
          </div>
        )}
        
        {showProvenance ? (
          // Custom tag highlighting renderer
          <div className={status === 'running' ? 'cursor-blink whitespace-pre-wrap' : 'whitespace-pre-wrap'}>
            {segments.map((seg, idx) => {
              const style = getProvenanceStyle(seg.tag);
              return (
                <span key={idx} className={`${style} transition-colors duration-200`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <span>{children}</span>,
                      a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-accent underline">{children}</a>,
                      code: ({ children }) => <code className="bg-zinc-950 border border-border px-1 rounded text-xs font-mono">{children}</code>,
                    }}
                  >
                    {seg.text}
                  </ReactMarkdown>
                </span>
              );
            })}
          </div>
        ) : (
          // Standard pure markdown renderer
          <div className={`prose prose-invert max-w-none prose-sm prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-border font-sans ${
            status === 'running' ? 'cursor-blink' : ''
          }`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {cleanMarkdown}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Actions bottom bar */}
      {synthesisText && (
        <div className="flex items-center justify-between border-t border-border bg-[#0d0d0d] px-4 py-2 select-none">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy('markdown')}
              className="px-2 py-1 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedType === 'markdown' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>COPY MD</span>
            </button>
            <button
              onClick={handleExportMd}
              className="px-2 py-1 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileDown className="w-3 h-3" />
              <span>EXPORT .MD</span>
            </button>
            <button
              onClick={() => handleCopy('json')}
              className="px-2 py-1 border border-zinc-900 bg-zinc-950 hover:border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedType === 'json' ? <Check className="w-3 h-3 text-emerald-500" /> : <Share2 className="w-3 h-3" />}
              <span>SHARE JSON</span>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <ExplainCard tasks={tasks} audit={audit} redactedKeys={redactedKeys} />
            <span className="text-[9px] text-zinc-600 font-mono">
              SESSION_ID: <span className="text-zinc-500">{sessionId.substring(0, 18)}...</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
export default SynthesisPanel;

import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Shield, User, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { SubTask, TaskResult } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;               // for user: the prompt. for assistant: synthesis text
  isStreaming?: boolean;         // assistant still receiving chunks
  tasks?: SubTask[];             // assistant: task breakdown
  audit?: TaskResult[];          // assistant: audit results
  redactedKeys?: string[];       // assistant: secrets that were intercepted
}

interface ChatViewProps {
  messages: ChatMessage[];
  isExecuting: boolean;
}

function stripTags(text: string) {
  return text.replace(/<\/?(t\d+|synthesis)>/g, '');
}

function AssistantBubble({ msg }: { msg: ChatMessage }) {
  const [showDetails, setShowDetails] = React.useState(false);
  const clean = stripTags(msg.content);
  const redacted = msg.redactedKeys ?? [];
  const audit = msg.audit ?? [];
  const tasks = msg.tasks ?? [];

  const totalCost = audit.reduce((s, r) => s + r.cost_usd, 0);
  const localCount = audit.filter(r => r.backend === 'local_qwen3').length;

  return (
    <div className="flex gap-3 items-start animate-fadeIn">
      {/* Avatar */}
      <div className="shrink-0 w-8 h-8 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
        <Shield className="w-4 h-4 text-emerald-400" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Name + privacy badge */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold text-emerald-400">PRISM</span>
          {redacted.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-sm">
              🛡 {redacted.length} secret{redacted.length !== 1 ? 's' : ''} protected
            </span>
          )}
        </div>

        {/* Content bubble */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl rounded-tl-none px-4 py-3 text-sm text-zinc-200 max-w-2xl">
          {msg.isStreaming && !msg.content ? (
            <span className="flex items-center gap-2 text-zinc-500 font-mono text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking...
            </span>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {clean || ''}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Show details toggle — only when complete */}
        {!msg.isStreaming && audit.length > 0 && (
          <div>
            <button
              onClick={() => setShowDetails(d => !d)}
              className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? 'Hide details' : 'Show details'} · {tasks.length} tasks · ${totalCost.toFixed(4)} · {localCount}/{audit.length} local
            </button>

            {showDetails && (
              <div className="mt-2 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 text-[11px] font-mono divide-y divide-zinc-900">
                {audit.map(r => (
                  <div key={r.task_id} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-zinc-600 w-12 shrink-0">{r.task_id.slice(0, 5)}</span>
                    <span className={`shrink-0 ${
                      r.backend === 'local_qwen3' ? 'text-teal-400' :
                      r.backend === 'groq' ? 'text-purple-400' : 'text-blue-400'
                    }`}>{r.backend}</span>
                    <span className="text-zinc-500">{r.latency_ms}ms</span>
                    <span className="text-zinc-600">{r.token_count} tok</span>
                    {r.redacted_keys.length > 0 && (
                      <span className="text-emerald-500">✓ {r.redacted_keys.length} withheld</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex gap-3 items-start justify-end animate-fadeIn">
      <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
        <span className="text-[11px] font-mono text-zinc-500">YOU</span>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl rounded-tr-none px-4 py-3 text-sm text-zinc-200 max-w-2xl whitespace-pre-wrap break-words">
          {msg.content}
        </div>
      </div>
      <div className="shrink-0 w-8 h-8 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center">
        <User className="w-4 h-4 text-zinc-400" />
      </div>
    </div>
  );
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, isExecuting }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isExecuting]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-zinc-600 select-none">
        <div className="w-14 h-14 rounded-full border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center">
          <Shield className="w-7 h-7 text-emerald-500/50" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm text-zinc-400 font-medium">How can Prism help you?</p>
          <p className="text-xs text-zinc-600 font-mono">Parallel AI · Privacy-first · Local synthesis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      {messages.map(msg =>
        msg.role === 'user'
          ? <UserBubble key={msg.id} msg={msg} />
          : <AssistantBubble key={msg.id} msg={msg} />
      )}

      {/* Streaming placeholder when executing and last message is from user */}
      {isExecuting && messages[messages.length - 1]?.role === 'user' && (
        <AssistantBubble
          msg={{
            id: 'streaming',
            role: 'assistant',
            content: '',
            isStreaming: true,
          }}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default ChatView;

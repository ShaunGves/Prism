import React, { useState, useRef, useEffect } from 'react';
import { Send, Shield } from 'lucide-react';

// Quick actions: pre-fill input with a template, never auto-submit
const QUICK_ACTIONS = [
  { label: 'Summarize', template: 'Summarize this:\n\n[paste your text here]' },
  { label: 'Fix Grammar', template: 'Fix the grammar and flow of this text:\n\n[paste your text here]' },
  { label: 'Explain This', template: 'Explain this in plain English, no jargon:\n\n[paste your text here]' },
  { label: 'Write Email', template: 'Write a professional email about:\n\n[describe what the email should say]' },
  { label: 'Review Code', template: 'Review this code for bugs, security issues, and improvements:\n\n```\n[paste your code here]\n```' },
  { label: 'Translate', template: 'Translate this to [target language]:\n\n[paste your text here]' },
];

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (template: string) => {
    setValue(template);
    // Focus and select the placeholder text so user can paste immediately
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const start = template.indexOf('[');
      const end = template.lastIndexOf(']') + 1;
      if (start !== -1) {
        el.setSelectionRange(start, end);
      }
    }, 50);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Quick action pills */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => handleQuickAction(action.template)}
            disabled={isLoading}
            className="text-[10px] font-mono px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-600 bg-zinc-950 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus-within:border-zinc-700 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Prism... (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none leading-relaxed min-h-[24px] max-h-[200px]"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !value.trim()}
          id="chat-send-btn"
          className={`shrink-0 p-2 rounded-lg transition-all cursor-pointer ${
            isLoading || !value.trim()
              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'bg-zinc-100 hover:bg-white text-black'
          }`}
        >
          {isLoading
            ? <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-700 font-mono px-1">
        <Shield className="w-3 h-3 text-zinc-700" />
        <span>Privacy gate active · Secrets stay on your machine · Local synthesis</span>
      </div>
    </div>
  );
};

export default ChatInput;

import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Zap, Sparkles } from 'lucide-react';
import { useWorkflowChat } from '../../hooks/useWorkflowChat.ts';
import { WorkflowMessage } from './WorkflowMessage.tsx';
import type { AgentModel } from '../../types/workflow';

export const WorkflowChat: React.FC = () => {
  const {
    messages,
    sendMessage,
    clearMessages,
    model,
    setModel,
  } = useWorkflowChat();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const task = input.trim();
    if (!task || sending) return;

    setInput('');
    setSending(true);
    try {
      await sendMessage(task);
    } finally {
      setSending(false);
    }
  };

  const toggleModel = () => {
    setModel(model === 'fast' ? 'quality' : 'fast');
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-white">Agent Chat</h1>
          <span className="px-2 py-0.5 text-[10px] bg-white/5 text-gray-500 rounded-full border border-gray-800">
            stub
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Model toggle */}
          <button
            onClick={toggleModel}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-[#111111] border border-gray-800 rounded-lg hover:border-gray-700 transition-all"
            title={`Switch to ${model === 'fast' ? 'quality' : 'fast'} model`}
          >
            {model === 'fast' ? (
              <Zap className="w-3.5 h-3.5 text-yellow-500/70" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-purple-400/70" />
            )}
            <span>{model === 'fast' ? 'Fast' : 'Quality'}</span>
          </button>

          {/* Clear */}
          {hasMessages && (
            <button
              onClick={clearMessages}
              className="p-1.5 text-gray-500 hover:text-white transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-gray-800 flex items-center justify-center mb-4">
              <Send className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-gray-400 text-sm">Ask Jamie anything about podcasts</p>
            <p className="text-gray-600 text-xs mt-1">
              Model: <span className="text-gray-500">{model === 'fast' ? 'Fast (Haiku 4.5)' : 'Quality (Sonnet 4.6)'}</span>
            </p>
          </div>
        )}

        {messages.map(msg => (
          <WorkflowMessage key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-[#0A0A0A] px-5 py-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="What are you looking for?"
            disabled={sending}
            className="flex-1 bg-[#111111] border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-gray-700 text-white disabled:opacity-30 disabled:hover:bg-white/10 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, Zap, Sparkles, ArrowUp } from 'lucide-react';
import { useWorkflowChat } from '../../hooks/useWorkflowChat.ts';
import { WorkflowMessage } from './WorkflowMessage.tsx';
import type { ClipMeta } from './WorkflowMessage.tsx';
import type { AgentModel } from '../../types/workflow';
import { useAudioController } from '../../context/AudioControllerContext.tsx';
import EmbedMiniPlayer from '../EmbedMiniPlayer.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';

// ─── Category grid with sub-queries ─────────────────────────────────────────

interface SubQuery {
  label: string;
  prompt: string;
}

interface Category {
  title: string;
  accent: string;
  queries: SubQuery[];
}

const CATEGORIES: Category[] = [
  {
    title: 'Health & Science',
    accent: '#22c55e',
    queries: [
      { label: 'Hormones & metabolism', prompt: 'What has Huberman said about hormones and metabolism?' },
      { label: 'Sleep optimization', prompt: 'Find the best podcast advice on optimizing sleep' },
      { label: 'Cold exposure benefits', prompt: 'What are the proven benefits of cold exposure?' },
      { label: 'Gut health & microbiome', prompt: 'What are podcasters saying about gut health and the microbiome?' },
      { label: 'Psychedelics research', prompt: 'Find discussions about therapeutic psychedelics research' },
    ],
  },
  {
    title: 'Geopolitics',
    accent: '#f59e0b',
    queries: [
      { label: 'BRICS vs dollar', prompt: 'Find discussions about BRICS challenging dollar hegemony' },
      { label: 'Tariffs & trade wars', prompt: 'What are podcasters saying about tariffs this year?' },
      { label: 'China-US relations', prompt: 'Find analysis on the state of China-US relations' },
      { label: 'Ukraine conflict', prompt: 'What are the latest podcast takes on the Ukraine conflict?' },
      { label: 'Middle East dynamics', prompt: 'Find podcast coverage of Middle East geopolitics' },
    ],
  },
  {
    title: 'Tech & AI',
    accent: '#8b5cf6',
    queries: [
      { label: 'Open vs closed AI', prompt: 'What are the best arguments for and against open source AI?' },
      { label: 'AI regulation debate', prompt: 'What are podcasters saying about AI regulation?' },
      { label: 'Defense tech', prompt: 'Find discussions about the defense tech industry' },
      { label: 'Startup strategy', prompt: 'Find founder advice on building and scaling startups' },
      { label: 'Future of work', prompt: 'How do experts think AI will change work?' },
    ],
  },
  {
    title: 'Finance & Markets',
    accent: '#06b6d4',
    queries: [
      { label: 'Bull case for gold', prompt: 'What is the bull case for gold right now?' },
      { label: 'Bitcoin macro thesis', prompt: 'What is the strongest macro case for Bitcoin?' },
      { label: 'Fed policy outlook', prompt: 'What are macro analysts saying about Fed policy?' },
      { label: 'Real estate trends', prompt: 'Find podcast discussion on real estate market trends' },
      { label: 'Venture capital shifts', prompt: 'What are VCs saying about the current funding environment?' },
    ],
  },
];

// ─── Prompt template pills ───────────────────────────────────────────────────

const PROMPT_TEMPLATES = [
  'What did __ say about __',
  'Steelman both sides of __',
  'Make me a playlist about __',
];

// ─── Main chat input (shared) ────────────────────────────────────────────────

const ChatInput: React.FC<{
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  size?: 'hero' | 'bar';
}> = ({ input, setInput, sending, onSubmit, inputRef, size = 'bar' }) => {
  const isHero = size === 'hero';
  return (
    <form onSubmit={onSubmit} className={`relative w-full ${isHero ? 'max-w-[40rem]' : 'max-w-[40rem]'}`}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="What are you looking for?"
        disabled={sending}
        className={`w-full bg-white/[0.04] rounded-2xl text-white placeholder-gray-500 focus:outline-none disabled:opacity-50 transition-all chat-input-glow ${
          isHero
            ? 'border-2 border-gray-600/60 pl-6 pr-14 py-4 text-base'
            : 'border border-gray-700/60 pl-5 pr-12 py-3.5 text-sm'
        }`}
      />
      <button
        type="submit"
        disabled={!input.trim() || sending}
        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white disabled:opacity-20 disabled:hover:bg-white/15 transition-all ${
          isHero ? 'right-2 w-10 h-10' : 'right-1.5 w-9 h-9'
        }`}
      >
        <ArrowUp className={isHero ? 'w-5 h-5' : 'w-4 h-4'} />
      </button>
    </form>
  );
};

// ─── Category card component ─────────────────────────────────────────────────

const CategoryCard: React.FC<{
  category: Category;
  onSelect: (prompt: string) => void;
  animDelay: number;
}> = ({ category, onSelect, animDelay }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleQueries = expanded ? category.queries : category.queries.slice(0, 3);

  return (
    <div
      className="category-card rounded-xl overflow-hidden animate-fade-in"
      style={{
        animationDelay: `${animDelay}ms`,
        animationFillMode: 'backwards',
        borderColor: `${category.accent}22`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left group"
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.accent, boxShadow: `0 0 6px ${category.accent}80` }}
        />
        <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
          {category.title}
        </span>
        <span className="ml-auto text-[10px] text-gray-600">
          {expanded ? '−' : `+${category.queries.length - 3}`}
        </span>
      </button>

      {/* Sub-queries */}
      <div className="px-3 pb-3 flex flex-col gap-1">
        {visibleQueries.map((q) => (
          <button
            key={q.label}
            onClick={() => onSelect(q.prompt)}
            className="text-left px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-100 transition-all hover:bg-white/[0.05] border border-transparent hover:border-gray-700/50"
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

export const WorkflowChat: React.FC = () => {
  const {
    messages,
    sendMessage,
    clearMessages,
    model,
    setModel,
  } = useWorkflowChat();

  const { playTrack, currentTrack } = useAudioController();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeClip, setActiveClip] = useState<ClipMeta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handlePlayClip = useCallback(
    (meta: ClipMeta) => {
      setActiveClip(meta);
      if (meta.audioUrl) {
        playTrack({
          id: meta.pineconeId,
          audioUrl: meta.audioUrl,
          startTime: meta.startTime,
          endTime: meta.endTime,
        });
      }
    },
    [playTrack]
  );

  useEffect(() => {
    if (activeClip && currentTrack?.id !== activeClip.pineconeId) {
      setActiveClip(null);
    }
  }, [currentTrack, activeClip]);

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

  const handlePromptPill = (template: string) => {
    setInput(template);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const pos = template.indexOf('__');
      if (pos >= 0) {
        el.setSelectionRange(pos, pos + 2);
      }
    }, 0);
  };

  const handleQuerySelect = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const hasMessages = messages.length > 0;
  const showMiniPlayer = !!activeClip;

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <img
            src="/default-source-favicon.png"
            alt="Jamie"
            className="w-7 h-7 rounded"
          />
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-white">
            Jamie Pull
          </span>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Messages / Empty State */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-col items-center min-h-full px-5 pt-12 sm:pt-16 pb-8">
            {/* Logo with glow */}
            <div className="relative mb-5 animate-fade-in">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-xl scale-150 animate-logo-glow" />
              <img
                src="/default-source-favicon.png"
                alt="Jamie"
                className="relative w-14 h-14 rounded-xl"
              />
            </div>

            {/* Tagline */}
            <h2 className="text-xl sm:text-2xl font-light text-gray-200 mb-2 animate-fade-in text-center" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
              Millions of moments. One search.
            </h2>
            <p className="text-sm text-gray-500 mb-10 animate-fade-in text-center" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
              Search across the world's podcasts — quotes, clips, and conversations
            </p>

            {/* Hero input */}
            <div className="w-full flex justify-center mb-3 animate-fade-in" style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}>
              <ChatInput
                input={input}
                setInput={setInput}
                sending={sending}
                onSubmit={handleSubmit}
                inputRef={inputRef}
                size="hero"
              />
            </div>

            {/* Prompt pills — just 3, compact */}
            <div className="flex flex-wrap justify-center gap-2 mb-12 max-w-[40rem] animate-fade-in" style={{ animationDelay: '350ms', animationFillMode: 'backwards' }}>
              {PROMPT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  onClick={() => handlePromptPill(tpl)}
                  className="rounded-full border border-gray-700/40 bg-white/[0.02] hover:bg-white/[0.06] hover:border-gray-600 text-gray-500 hover:text-gray-200 text-xs px-3 py-1.5 transition-all"
                >
                  {tpl.split('__').map((part, j, arr) => (
                    <React.Fragment key={j}>
                      {part}
                      {j < arr.length - 1 && (
                        <span className="text-white/60 font-medium">___</span>
                      )}
                    </React.Fragment>
                  ))}
                </button>
              ))}
            </div>

            {/* Category grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[40rem]">
              {CATEGORIES.map((cat, i) => (
                <CategoryCard
                  key={cat.title}
                  category={cat}
                  onSelect={handleQuerySelect}
                  animDelay={400 + i * 100}
                />
              ))}
            </div>

            {/* Model label */}
            <p className="text-gray-700 text-[10px] mt-8">
              {model === 'fast' ? 'Haiku 4.5' : 'Sonnet 4.6'}
            </p>
          </div>
        ) : (
          <div className="px-5 py-6 space-y-5">
            {messages.map((msg, idx) => {
              let originalQuery: string | undefined;
              if (msg.role === 'assistant') {
                for (let i = idx - 1; i >= 0; i--) {
                  if (messages[i].role === 'user') {
                    originalQuery = messages[i].content;
                    break;
                  }
                }
              }
              return (
                <WorkflowMessage
                  key={msg.id}
                  message={msg}
                  onPlayClip={handlePlayClip}
                  onFollowUp={sendMessage}
                  originalQuery={originalQuery}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Mini-player */}
      {showMiniPlayer && (
        <div className="flex-shrink-0 [&>div]:!relative [&>div]:!inset-auto">
          <EmbedMiniPlayer
            mode="app"
            isHovered={true}
            audioUnlocked={true}
            trackId={activeClip.pineconeId}
            audioUrl={activeClip.audioUrl}
            episodeTitle={activeClip.episodeTitle}
            episodeImage={activeClip.episodeImage}
            creator={activeClip.creator}
            timeContext={{
              start_time: activeClip.startTime,
              end_time: activeClip.endTime,
            }}
            quote={activeClip.text}
            hierarchyLevel="paragraph"
            onCopyLink={() => {
              const url = createClipShareUrl(activeClip.pineconeId);
              navigator.clipboard.writeText(url).catch(() => {});
            }}
          />
        </div>
      )}

      {/* Bottom input — active conversation */}
      {hasMessages && (
        <div className="flex-shrink-0 border-t border-gray-800/40 bg-black/90 backdrop-blur-lg px-5 py-3 flex justify-center">
          <ChatInput
            input={input}
            setInput={setInput}
            sending={sending}
            onSubmit={handleSubmit}
            inputRef={inputRef}
          />
        </div>
      )}
    </div>
  );
};

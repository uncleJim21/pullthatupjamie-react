import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Zap, Sparkles, ArrowUp, HeartPulse, Globe2, Cpu, TrendingUp, Bitcoin, Rocket, Eye, Landmark, Brain, X } from 'lucide-react';
import { useWorkflowChat } from '../../hooks/useWorkflowChat.ts';
import { WorkflowMessage } from './WorkflowMessage.tsx';
import type { ClipMeta } from './WorkflowMessage.tsx';
import type { AgentModel } from '../../types/workflow';
import { useAudioController } from '../../context/AudioControllerContext.tsx';
import EmbedMiniPlayer from '../EmbedMiniPlayer.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';

// ─── Category grid — galaxy-inspired accent palette ──────────────────────────

interface SubQuery {
  label: string;
  prompt: string;
}

interface Category {
  title: string;
  accent: string;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  queries: SubQuery[];
}

const CATEGORIES: Category[] = [
  {
    // Health & Wellness carousel: hue 190, aqua-blue
    title: 'Health & Science',
    accent: '#70c9db',
    icon: HeartPulse,
    queries: [
      { label: 'Hormones & metabolism', prompt: 'What has Huberman said about hormones and metabolism?' },
      { label: 'Sleep optimization', prompt: 'Find the best podcast advice on optimizing sleep' },
      { label: 'Cold exposure benefits', prompt: 'What are the proven benefits of cold exposure?' },
      { label: 'Gut health & microbiome', prompt: 'What are podcasters saying about gut health and the microbiome?' },
      { label: 'Psychedelics research', prompt: 'Find discussions about therapeutic psychedelics research' },
    ],
  },
  {
    // Culture Wars carousel: hue 350, deep crimson
    title: 'Geopolitics',
    accent: '#dd3c57',
    icon: Globe2,
    queries: [
      { label: 'BRICS vs dollar', prompt: 'Find discussions about BRICS challenging dollar hegemony' },
      { label: 'Tariffs & trade wars', prompt: 'What are podcasters saying about tariffs this year?' },
      { label: 'China-US relations', prompt: 'Find analysis on the state of China-US relations' },
      { label: 'Ukraine conflict', prompt: 'What are the latest podcast takes on the Ukraine conflict?' },
      { label: 'Middle East dynamics', prompt: 'Find podcast coverage of Middle East geopolitics' },
    ],
  },
  {
    // AI & Tech carousel: hue 215, pale blue-silver
    title: 'Tech & AI',
    accent: '#82a0c9',
    icon: Cpu,
    queries: [
      { label: 'Open vs closed AI', prompt: 'What are the best arguments for and against open source AI?' },
      { label: 'AI regulation debate', prompt: 'What are podcasters saying about AI regulation?' },
      { label: 'Defense tech', prompt: 'Find discussions about the defense tech industry' },
      { label: 'Startup strategy', prompt: 'Find founder advice on building and scaling startups' },
      { label: 'Future of work', prompt: 'How do experts think AI will change work?' },
    ],
  },
  {
    // Business carousel: hue 130, dollar-bill green
    title: 'Finance & Markets',
    accent: '#98cda1',
    icon: TrendingUp,
    queries: [
      { label: 'Bull case for gold', prompt: 'What is the bull case for gold right now?' },
      { label: 'Bitcoin macro thesis', prompt: 'What is the strongest macro case for Bitcoin?' },
      { label: 'Fed policy outlook', prompt: 'What are macro analysts saying about Fed policy?' },
      { label: 'Real estate trends', prompt: 'Find podcast discussion on real estate market trends' },
      { label: 'Venture capital shifts', prompt: 'What are VCs saying about the current funding environment?' },
    ],
  },
  {
    // Bitcoin carousel: hue 12, coral-orange
    title: 'Bitcoin & Crypto',
    accent: '#f06d4c',
    icon: Bitcoin,
    queries: [
      { label: 'Bitcoin as money', prompt: 'What is the strongest case for Bitcoin as money?' },
      { label: 'Lightning & Layer 2', prompt: 'Find discussions about the Lightning Network and Layer 2 solutions' },
      { label: 'Bitcoin mining & energy', prompt: 'What are podcasters saying about Bitcoin mining and energy use?' },
      { label: 'Crypto regulation', prompt: 'Find the latest podcast takes on crypto regulation' },
      { label: 'Bitcoin vs gold', prompt: 'What are the best arguments comparing Bitcoin to gold?' },
    ],
  },
  {
    // Startups carousel: hue 5, warm coral-red
    title: 'Startups & Founders',
    accent: '#e96e63',
    icon: Rocket,
    queries: [
      { label: 'Founder stories', prompt: 'Find the best founder origin stories from podcasts' },
      { label: 'Hiring & culture', prompt: 'What do founders say about hiring and building culture?' },
      { label: 'Raising a seed round', prompt: 'Find advice on raising a seed round as a first-time founder' },
      { label: 'Creator economy', prompt: 'What are podcasters saying about the creator economy?' },
      { label: 'Building in public', prompt: 'Find discussions about building startups in public' },
    ],
  },
  {
    // Lunatic Fringe carousel: hue 290, fuschia-purple
    title: 'Frontier & Fringe',
    accent: '#c557db',
    icon: Eye,
    queries: [
      { label: 'UFOs & UAPs', prompt: 'What are the most credible podcast discussions about UFOs and UAPs?' },
      { label: 'Consciousness & reality', prompt: 'Find deep discussions about consciousness and the nature of reality' },
      { label: 'Surveillance & privacy', prompt: 'What are podcasters saying about surveillance and digital privacy?' },
      { label: 'Media manipulation', prompt: 'Find discussions about media manipulation and narrative control' },
      { label: 'Simulation theory', prompt: 'What are the strongest arguments for simulation theory on podcasts?' },
    ],
  },
  {
    // History: hue 52, faded-paper yellow — Dan Carlin / WhatIfAltHist energy
    title: 'History & Anthropology',
    accent: '#e5d67a',
    icon: Landmark,
    queries: [
      { label: 'Fall of empires', prompt: 'What patterns repeat in the fall of great empires across history?' },
      { label: 'WWII what-ifs', prompt: 'Find alt-history takes on what if the Axis had won WWII' },
      { label: 'Mongol conquests', prompt: 'Find deep dives on Genghis Khan and the Mongol conquests' },
      { label: 'Nuclear close calls', prompt: "What are the closest humanity has come to nuclear war?" },
      { label: 'Lost civilizations', prompt: 'Find compelling podcast theories about lost or forgotten civilizations' },
      { label: 'Human origins', prompt: 'What are podcasters saying about human origins and prehistory?' },
    ],
  },
  {
    // Psychology & Mind: hue 170, dusty teal / sea-glass — cerebral, calm
    title: 'Psychology & Mind',
    accent: '#6fbca8',
    icon: Brain,
    queries: [
      { label: 'Attention & focus', prompt: 'Find the best podcast advice on improving attention and focus' },
      { label: 'Habits & behavior change', prompt: 'What does the science of habits and behavior change look like?' },
      { label: 'Overcoming anxiety', prompt: 'What do psychologists on podcasts say about overcoming anxiety?' },
      { label: 'Dark triad personalities', prompt: 'Find discussions of narcissism, Machiavellianism, and psychopathy' },
      { label: 'Evidence-based therapy', prompt: 'Which therapy approaches have the strongest evidence base?' },
    ],
  },
];

// ─── Prompt template pills ───────────────────────────────────────────────────

const PROMPT_TEMPLATES = [
  'What did __ say about __',
  'Steelman both sides of __',
  'Make me a playlist about __',
  "Find __'s last 5 appearances",
  'What is the bull case for __?',
  'Find __ talking about __',
  'What has __ said about __?',
  'Compare __ and __ on __',
  'Find the strongest arguments for __',
  'Has anyone discussed __?',
  'What is the contrarian take on __?',
  'Explain the tradeoffs of __ vs __',
  'Find a detailed retelling of __',
  'What are podcasters saying about __?',
];

// ─── Prompt conveyor belt (horizontal scrolling pills, pause on hover) ──────

const PromptPill: React.FC<{ template: string; onSelect: (tpl: string) => void }> = ({
  template,
  onSelect,
}) => (
  <button
    onClick={() => onSelect(template)}
    className="prompt-pill flex-shrink-0 whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/30 text-gray-500 hover:text-white text-xs px-3.5 py-1.5 transition-colors"
  >
    {template.split('__').map((part, j, arr) => (
      <React.Fragment key={j}>
        {part}
        {j < arr.length - 1 && <span className="text-white/50 font-medium">___</span>}
      </React.Fragment>
    ))}
  </button>
);

const PromptConveyor: React.FC<{ onSelect: (tpl: string) => void }> = ({ onSelect }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hoverPausedRef = useRef(false);
  const userTookControlRef = useRef(false);
  const oneSetWidthRef = useRef(0);

  // Triplicate for seamless looping in both directions
  const tripled = useMemo(
    () => [...PROMPT_TEMPLATES, ...PROMPT_TEMPLATES, ...PROMPT_TEMPLATES],
    []
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const measure = () => {
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length === 0) return;
      const oneSetLength = Math.floor(children.length / 3);
      let w = 0;
      for (let i = 0; i < oneSetLength; i++) w += children[i].offsetWidth;
      w += 12 * oneSetLength; // gap-3
      oneSetWidthRef.current = w;
      // Start in the middle set so user can scroll both directions
      el.scrollLeft = w;
    };

    const measureTimeout = setTimeout(measure, 50);

    const SPEED = 0.3; // px/frame — slow enough to read
    let rafId = 0;
    // Safari/Brave snap scrollLeft to integers — accumulate sub-pixel progress ourselves
    let subpixelAcc = 0;

    const tick = () => {
      const oneSet = oneSetWidthRef.current;
      if (oneSet > 0) {
        const paused = hoverPausedRef.current || userTookControlRef.current;
        if (!paused) {
          subpixelAcc += SPEED;
          if (subpixelAcc >= 1) {
            const whole = Math.floor(subpixelAcc);
            el.scrollLeft += whole;
            subpixelAcc -= whole;
          }
        }
        // Seamless wrap in either direction (invisible because content is triplicated)
        if (el.scrollLeft >= oneSet * 2) {
          el.scrollLeft -= oneSet;
        } else if (el.scrollLeft <= 0) {
          el.scrollLeft += oneSet;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Real scroll gestures (wheel / touch swipe) → stop auto-scroll permanently
    const stopAuto = () => {
      userTookControlRef.current = true;
    };

    const onWheel = (e: WheelEvent) => {
      // Redirect vertical wheel into horizontal scroll while hovering
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
      stopAuto();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', stopAuto, { passive: true });

    const onResize = () => measure();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(measureTimeout);
      cancelAnimationFrame(rafId);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', stopAuto);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div
      className="prompt-conveyor-mask w-full max-w-[44rem]"
      onMouseEnter={() => { hoverPausedRef.current = true; }}
      onMouseLeave={() => { hoverPausedRef.current = false; }}
    >
      <div
        ref={scrollerRef}
        className="flex gap-3 items-center overflow-x-auto scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tripled.map((tpl, i) => (
          <PromptPill key={`${tpl}-${i}`} template={tpl} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};

// ─── Template fill-in (CRT-style inverted blanks) ───────────────────────────

const TemplateFillIn: React.FC<{
  template: string;
  onSubmit: (filled: string) => void;
  onCancel: () => void;
}> = ({ template, onSubmit, onCancel }) => {
  const parts = template.split('__');
  const blankCount = parts.length - 1;
  const [blanks, setBlanks] = useState<string[]>(() => Array(blankCount).fill(''));
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const allFilled = blanks.every(b => b.trim().length > 0);

  const submit = () => {
    if (!allFilled) return;
    const filled = parts.reduce(
      (acc, p, i) => acc + p + (i < blankCount ? blanks[i] : ''),
      ''
    );
    onSubmit(filled);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (idx > 0) inputRefs.current[idx - 1]?.focus();
        return;
      }
      if (idx < blankCount - 1) {
        inputRefs.current[idx + 1]?.focus();
      } else if (allFilled) {
        submit();
      } else {
        // Wrap to first empty blank
        const firstEmpty = blanks.findIndex(b => !b.trim());
        if (firstEmpty >= 0) inputRefs.current[firstEmpty]?.focus();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (allFilled) {
        submit();
        return;
      }
      const firstEmpty = blanks.findIndex(b => !b.trim());
      if (firstEmpty >= 0) inputRefs.current[firstEmpty]?.focus();
    }
  };

  const onLastBlank = focusIdx === blankCount - 1;
  const hint = onLastBlank && allFilled
    ? (
      <>
        <kbd className="fill-kbd">Tab</kbd> or <kbd className="fill-kbd">⏎</kbd> to send
      </>
    )
    : (
      <>
        <kbd className="fill-kbd">Tab</kbd> to continue
      </>
    );

  return (
    <div className="flex flex-col items-center animate-fill-in relative">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel template"
        className="absolute -top-3 -right-3 w-7 h-7 flex items-center justify-center rounded-full border border-white/20 bg-black/80 text-gray-400 hover:text-white hover:border-white/50 hover:bg-black transition-all z-10"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div
        className="rounded-full border border-white/[0.15] bg-white/[0.04] text-gray-200 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-6 py-2.5 max-w-[44rem] shadow-[0_0_16px_rgba(255,255,255,0.04)]"
        style={{ fontSize: 'clamp(1rem, 1.8vw, 1.25rem)' }}
      >
        {parts.map((part, i) => {
          const trimmed = part.trim();
          return (
            <React.Fragment key={i}>
              {trimmed && <span>{trimmed}</span>}
              {i < blankCount && (
                <input
                  ref={(el) => { inputRefs.current[i] = el; }}
                  value={blanks[i]}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBlanks((prev) => prev.map((b, j) => (j === i ? val : b)));
                  }}
                  onFocus={() => setFocusIdx(i)}
                  onKeyDown={(e) => handleKey(e, i)}
                  size={Math.max(blanks[i].length || 4, 4)}
                  className="fill-blank-input"
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">{hint}</span>
        <span className="text-gray-700">·</span>
        <button
          onClick={onCancel}
          className="hover:text-gray-300 transition-colors flex items-center gap-1.5"
        >
          <kbd className="fill-kbd">Esc</kbd> to cancel
        </button>
      </div>
    </div>
  );
};

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

// ─── Category card ───────────────────────────────────────────────────────────

const CategoryCard: React.FC<{
  category: Category;
  onSelect: (prompt: string) => void;
  animDelay: number;
}> = ({ category, onSelect, animDelay }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleQueries = expanded ? category.queries : category.queries.slice(0, 3);
  const Icon = category.icon;
  const c = category.accent;

  return (
    <div
      className="category-neon rounded-xl overflow-hidden animate-fade-in"
      style={{
        '--neon': c,
        animationDelay: `${animDelay}ms`,
        animationFillMode: 'backwards',
      } as React.CSSProperties}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left group"
      >
        <Icon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: c, filter: `drop-shadow(0 0 6px ${c})` }}
        />
        <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
          {category.title}
        </span>
        {!expanded && category.queries.length > 3 && (
          <span
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ color: `${c}cc`, backgroundColor: `${c}12`, border: `1px solid ${c}20` }}
          >
            +{category.queries.length - 3}
          </span>
        )}
      </button>

      {/* Sub-queries */}
      <div className="px-3 pb-3 flex flex-col gap-1">
        {visibleQueries.map((q) => (
          <button
            key={q.label}
            onClick={() => onSelect(q.prompt)}
            className="subtopic-neon text-left px-3 py-2 rounded-lg text-xs text-gray-400 transition-all"
            style={{ '--neon': c } as React.CSSProperties}
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
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);

  // Scroll state machine: idle | anchor-top | follow-bottom
  const scrollModeRef = useRef<'idle' | 'anchor-top' | 'follow-bottom'>('idle');
  const prevMsgCountRef = useRef(0);
  const userScrolledAwayRef = useRef(false);
  const [slackHeight, setSlackHeight] = useState(0);
  const slackHeightRef = useRef(0);
  const updateSlack = (h: number) => {
    slackHeightRef.current = h;
    setSlackHeight(h);
  };

  // Detect manual user scroll during follow-bottom to pause auto-scroll
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (scrollModeRef.current === 'follow-bottom') {
          const gap = container.scrollHeight - container.scrollTop - container.clientHeight;
          userScrolledAwayRef.current = gap > 80;
        }
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const count = messages.length;

    if (count === 0) {
      prevMsgCountRef.current = 0;
      scrollModeRef.current = 'idle';
      updateSlack(0);
      return;
    }

    // Detect a new message pair (user + assistant stub) being added
    if (count > prevMsgCountRef.current && count >= 2) {
      const penultimate = messages[count - 2];
      if (penultimate?.role === 'user') {
        const isFollowUp = prevMsgCountRef.current > 0;
        if (isFollowUp) {
          scrollModeRef.current = 'anchor-top';
          userScrolledAwayRef.current = false;

          // Inject slack equal to viewport height so the user msg can reach the top.
          // Then smooth-scroll the user message to the top.
          // The slack stays while streaming; shrinks as assistant content grows.
          requestAnimationFrame(() => {
            updateSlack(container.clientHeight);
            // Wait for the slack to be painted before scrolling
            requestAnimationFrame(() => {
              const el = lastUserMsgRef.current;
              if (!el) return;
              const containerRect = container.getBoundingClientRect();
              const elRect = el.getBoundingClientRect();
              const target = container.scrollTop + (elRect.top - containerRect.top);
              container.scrollTo({ top: target, behavior: 'smooth' });
            });
          });
        } else {
          scrollModeRef.current = 'follow-bottom';
          userScrolledAwayRef.current = false;
        }
      }
      prevMsgCountRef.current = count;
    }

    const mode = scrollModeRef.current;

    if (mode === 'anchor-top') {
      // Shrink slack as assistant content grows; once it hits 0, switch to follow-bottom
      const el = lastUserMsgRef.current;
      if (el) {
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const userMsgTopInContainer = container.scrollTop + (elRect.top - containerRect.top);
        // Real content height below user msg = scrollHeight MINUS current slack MINUS userMsgTop
        const contentBelowUser = container.scrollHeight - slackHeightRef.current - userMsgTopInContainer;
        const needed = Math.max(0, container.clientHeight - contentBelowUser);
        if (Math.abs(needed - slackHeightRef.current) > 2) {
          updateSlack(needed);
        }
        if (needed === 0) {
          scrollModeRef.current = 'follow-bottom';
        }
      }
    } else if (mode === 'follow-bottom' && !userScrolledAwayRef.current) {
      container.scrollTop = container.scrollHeight - container.clientHeight;
    }

    // Stream finished → return to idle
    const last = messages[count - 1];
    if (last?.role === 'assistant' && last.streamComplete && mode !== 'idle') {
      scrollModeRef.current = 'idle';
      userScrolledAwayRef.current = false;
    }
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
    setActiveTemplate(template);
  };

  const handleTemplateSubmit = async (filled: string) => {
    setActiveTemplate(null);
    setSending(true);
    try {
      await sendMessage(filled);
    } finally {
      setSending(false);
    }
  };

  const handleQuerySelect = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const hasMessages = messages.length > 0;
  const showMiniPlayer = !!activeClip;

  return (
    <div className="relative flex flex-col h-full bg-black text-white">
      {/* Floating top-right controls (header hidden for now) */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-2">
        <button
          onClick={toggleModel}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-black/60 backdrop-blur-sm border border-gray-800 rounded-lg hover:border-gray-700 transition-all"
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
            className="p-1.5 text-gray-500 hover:text-white bg-black/60 backdrop-blur-sm border border-gray-800 rounded-lg hover:border-gray-700 transition-all"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages / Empty State */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ overflowAnchor: 'none' }}>
        {!hasMessages ? (
          <div className="flex flex-col items-center min-h-full px-5 pt-8 sm:pt-10 pb-8">
            {/* Logo lockup */}
            <div className="relative animate-fade-in">
              <div className="absolute inset-0 bg-white/5 blur-2xl scale-110 animate-logo-glow" />
              <img
                src="/jamie-pull.png"
                alt="Jamie Pull"
                className="relative h-24 sm:h-32 w-auto"
              />
            </div>

            {/* Tagline */}
            <p
              className="text-sm sm:text-base text-gray-400 mt-1 mb-5 animate-fade-in text-center"
              style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}
            >
              Start your research backed by millions of podcast moments. Ask in plain English.
            </p>

            {activeTemplate ? (
              /* Template fill-in mode — replaces hero input + pills */
              <div className="w-full flex justify-center mb-12 min-h-[10rem] items-center">
                <TemplateFillIn
                  key={activeTemplate}
                  template={activeTemplate}
                  onSubmit={handleTemplateSubmit}
                  onCancel={() => setActiveTemplate(null)}
                />
              </div>
            ) : (
              <>
                {/* Hero input */}
                <div
                  className="w-full flex justify-center mb-3 animate-fade-in"
                  style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}
                >
                  <ChatInput
                    input={input}
                    setInput={setInput}
                    sending={sending}
                    onSubmit={handleSubmit}
                    inputRef={inputRef}
                    size="hero"
                  />
                </div>

                {/* Prompt conveyor */}
                <div
                  className="w-full flex justify-center mb-12 animate-fade-in"
                  style={{ animationDelay: '350ms', animationFillMode: 'backwards' }}
                >
                  <PromptConveyor onSelect={handlePromptPill} />
                </div>
              </>
            )}

            {/* Category grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-[56rem]">
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
              const isLastUserMsg =
                msg.role === 'user' &&
                !messages.slice(idx + 1).some(m => m.role === 'user');
              return (
                <div key={msg.id} ref={isLastUserMsg ? lastUserMsgRef : undefined}>
                  <WorkflowMessage
                    message={msg}
                    onPlayClip={handlePlayClip}
                    onFollowUp={sendMessage}
                    originalQuery={originalQuery}
                  />
                </div>
              );
            })}
            {/* Viewport slack — dynamic; only exists when anchoring new user msg to top */}
            {slackHeight > 0 && <div style={{ height: slackHeight }} aria-hidden="true" />}
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

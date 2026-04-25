import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { RotateCcw, ArrowUp, HeartPulse, Globe2, Cpu, TrendingUp, Bitcoin, Rocket, Eye, Landmark, Brain, X, Telescope, Film, Send, HelpCircle, Workflow } from 'lucide-react';
import { useJamiePullAgent } from '../../hooks/useJamiePullAgent.ts';
import { JamiePullAgentMessage, clipMetaCache, extractClipIds } from './JamiePullAgentMessage.tsx';
import type { ClipMeta } from './JamiePullAgentMessage.tsx';
import { NavGlowButton } from '../NavGlowButton.tsx';
import type { AgentModel } from '../../types/jamiePullAgent';
import { useAudioController } from '../../context/AudioControllerContext.tsx';
import EmbedMiniPlayer from '../EmbedMiniPlayer.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';
import { QuotaExceededModal } from '../QuotaExceededModal.tsx';

// ─── Skill chips ─────────────────────────────────────────────────────────────
// Flip to `false` to hide the Research / Create / Publish draft row until
// Create & Publish are actually wired up by their respective devs.
const SHOW_SKILL_CHIPS = true;

// Injected layout dependency. Flip between:
//   'slim' — compact single-row pills (icon + title + soon badge + ?). Default.
//   'grid' — original 2×N chunky card grid with taglines.
// Kept as a const so individual devs can opt into the old layout locally
// without touching the chip markup itself.
const SKILL_CHIP_LAYOUT: 'slim' | 'grid' = 'slim';

type SkillStatus = 'live' | 'coming_soon';

interface Skill {
  id: 'research' | 'create' | 'publish' | 'worker';
  title: string;
  tagline: string; // short copy on the chip itself
  description: string; // long copy in the modal
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
  status: SkillStatus;
  examples?: string[]; // example prompts (Research modal)
  planned?: string[]; // bullets for coming-soon chips
}

const SKILLS: Skill[] = [
  {
    id: 'research',
    title: 'Research',
    tagline: 'Ask anything across podcasts',
    description:
      "Jamie searches millions of moments from hundreds of podcast feeds with natural language. Ask in plain English and surface quotes, episodes, and clips that actually answer your question.",
    icon: Telescope,
    accent: '#3b6df0',
    status: 'live',
    examples: [
      'What has Jeff Booth said about CBDCs?',
      'Find the bull case for gold in 2026',
      'Best podcast advice on improving attention and focus',
    ],
  },
  {
    id: 'create',
    title: 'Create',
    tagline: 'Turn moments into clips',
    description:
      'Point Jamie at a quote or a timestamp range and it assembles a shareable audio/video clip with captions — ready to post without touching an editor.',
    icon: Film,
    accent: '#ff9f7a',
    status: 'coming_soon',
    planned: [
      'Auto-captioned audio & video clips',
      'Timestamp range → rendered clip in seconds',
      'Direct hand-off to the Publish skill',
    ],
  },
  {
    id: 'publish',
    title: 'Publish',
    tagline: 'Share where your audience lives',
    description:
      'Push clips and research findings to the places people actually follow you — Nostr, X, podcasting 2.0 timestamps, and more — with one click.',
    icon: Send,
    accent: '#9a6bff',
    status: 'coming_soon',
    planned: [
      'One-click post to Nostr + X',
      'Podcasting 2.0 timestamp links',
      'Scheduled drops & cross-posting',
    ],
  },
  {
    id: 'worker',
    title: 'Worker',
    tagline: 'Run jobs in the background',
    description:
      "Hand Jamie a long-running task — a standing research brief, a scheduled clip drop, a recurring digest — and it runs async. Nothing blocks your chat; you get pinged when work completes.",
    icon: Workflow,
    accent: '#5ecfa8',
    status: 'coming_soon',
    planned: [
      'Scheduled + recurring tasks',
      'Multi-step pipelines across skills',
      'Notifications when jobs finish',
    ],
  },
];

// ─── Tagline A/B pool ────────────────────────────────────────────────────────
// Add more variants to split-test. A session-stable pick is made on first
// render (stored in sessionStorage) so the tagline doesn't flicker on
// client-side navigation. Fires a `data-tagline-id` attribute on the DOM
// element for analytics pickup.
interface TaglineVariant {
  id: string;
  headline: string;
  subline: string;
}
const TAGLINES: TaglineVariant[] = [
  {
    id: 'openclaw-plain-english-verbs',
    headline: 'OpenClaw style web Agent for podcasts. Zero hassle.',
    subline: 'Plain English finds the quote, cuts the clip, cross posts the thread.',
  },
  // Drop additional variants here to add them to the A/B pool, e.g.:
  // { id: 'openclaw-kicker',     headline: 'OpenClaw-grade skills, podcast-native. Zero setup.',
  //   subline: 'Find the quote, cut the clip, post the thread — all in plain English.' },
  // { id: 'openclaw-headline',   headline: 'OpenClaw-grade skills in plain English. Zero setup.',
  //   subline: 'Find the quote, cut the clip, post the thread — one sentence each.' },
];

const pickTagline = (): TaglineVariant => {
  try {
    const cachedId = sessionStorage.getItem('ptuj.taglineId');
    if (cachedId) {
      const hit = TAGLINES.find(t => t.id === cachedId);
      if (hit) return hit;
    }
  } catch { /* sessionStorage may be unavailable; fall through */ }
  const pick = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
  try { sessionStorage.setItem('ptuj.taglineId', pick.id); } catch {}
  return pick;
};

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
    <form onSubmit={onSubmit} className="relative w-full max-w-[40rem]">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="What are you looking for?"
        disabled={sending}
        className={`w-full bg-white/[0.04] rounded-2xl text-white placeholder-gray-500 focus:outline-none disabled:opacity-50 transition-all ${
          isHero
            ? 'hero-input-neon pl-6 pr-14 py-4 text-base'
            : 'chat-input-neon pl-5 pr-12 py-3.5 text-sm'
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
      className="animate-fade-in"
      style={{
        animationDelay: `${animDelay}ms`,
        animationFillMode: 'backwards',
      }}
    >
    <div
      className="category-neon rounded-xl overflow-hidden"
      style={{ '--neon': c } as React.CSSProperties}
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
    </div>
  );
};

// ─── Skill chip + modal ──────────────────────────────────────────────────────

const SkillChip: React.FC<{
  skill: Skill;
  animDelay: number;
  onOpenInfo: (skill: Skill) => void;
  /** Visual layout variant; controlled upstream by SKILL_CHIP_LAYOUT. */
  variant?: 'slim' | 'grid';
}> = ({ skill, animDelay, onOpenInfo, variant = 'slim' }) => {
  const Icon = skill.icon;
  const isLive = skill.status === 'live';

  if (variant === 'slim') {
    return (
      <div
        className="animate-fade-in"
        style={{ animationDelay: `${animDelay}ms`, animationFillMode: 'backwards' }}
      >
        <button
          type="button"
          onClick={() => onOpenInfo(skill)}
          className={`skill-chip-neon relative rounded-full overflow-hidden flex items-center gap-1.5 px-2.5 py-1 group whitespace-nowrap ${
            isLive ? '' : 'skill-chip--coming-soon'
          }`}
          style={{ '--neon': skill.accent } as React.CSSProperties}
        >
          <Icon
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: skill.accent, filter: `drop-shadow(0 0 4px ${skill.accent})` }}
          />
          <span className="text-xs font-medium text-gray-100 group-hover:text-white transition-colors">
            {skill.title}
          </span>
          {!isLive && (
            <span
              className="text-[8px] uppercase tracking-wide px-1 py-px rounded-full flex-shrink-0 leading-none"
              style={{
                color: `${skill.accent}dd`,
                backgroundColor: `${skill.accent}14`,
                border: `1px solid ${skill.accent}33`,
              }}
            >
              Soon
            </span>
          )}
          <HelpCircle
            className="w-3 h-3 flex-shrink-0 text-gray-500 group-hover:text-gray-200 transition-colors"
            aria-hidden
          />
        </button>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{ animationDelay: `${animDelay}ms`, animationFillMode: 'backwards' }}
    >
      <button
        type="button"
        onClick={() => onOpenInfo(skill)}
        className={`skill-chip-neon relative w-full aspect-[4/1] rounded-xl overflow-hidden text-left flex items-center gap-3 px-4 group ${
          isLive ? '' : 'skill-chip--coming-soon'
        }`}
        style={{ '--neon': skill.accent } as React.CSSProperties}
      >
        <Icon
          className="w-5 h-5 flex-shrink-0"
          style={{ color: skill.accent, filter: `drop-shadow(0 0 6px ${skill.accent})` }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-100 group-hover:text-white transition-colors truncate">
            {skill.title}
          </div>
          <div className="text-[11px] text-gray-400 truncate">{skill.tagline}</div>
        </div>
        {!isLive && (
          <span
            className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{
              color: `${skill.accent}dd`,
              backgroundColor: `${skill.accent}14`,
              border: `1px solid ${skill.accent}33`,
            }}
          >
            Soon
          </span>
        )}
        <span
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-hidden
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </span>
      </button>
    </div>
  );
};

const SkillInfoModal: React.FC<{
  skill: Skill | null;
  onClose: () => void;
  onExample: (prompt: string) => void;
}> = ({ skill, onClose, onExample }) => {
  // Close on Esc
  useEffect(() => {
    if (!skill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skill, onClose]);

  if (!skill) return null;
  const Icon = skill.icon;
  const isLive = skill.status === 'live';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in"
      style={{ animationDuration: '0.2s' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[28rem] rounded-2xl overflow-hidden skill-chip-neon p-6"
        style={{ '--neon': skill.accent } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <Icon
            className="w-6 h-6 flex-shrink-0"
            style={{ color: skill.accent, filter: `drop-shadow(0 0 8px ${skill.accent})` }}
          />
          <h3 className="text-lg font-semibold text-white">{skill.title}</h3>
          {!isLive && (
            <span
              className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{
                color: `${skill.accent}dd`,
                backgroundColor: `${skill.accent}14`,
                border: `1px solid ${skill.accent}33`,
              }}
            >
              Coming soon
            </span>
          )}
        </div>

        <p className="text-sm text-gray-300 leading-relaxed mb-4">{skill.description}</p>

        {isLive && skill.examples && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Try it</div>
            <div className="flex flex-col gap-1.5">
              {skill.examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    onExample(ex);
                    onClose();
                  }}
                  className="subtopic-neon text-left px-3 py-2 rounded-lg text-xs text-gray-300 transition-all"
                  style={{ '--neon': skill.accent } as React.CSSProperties}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isLive && skill.planned && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">What's coming</div>
            <ul className="flex flex-col gap-1.5">
              {skill.planned.map((p) => (
                <li
                  key={p}
                  className="text-xs text-gray-300 flex items-start gap-2 px-3 py-1.5"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: skill.accent, boxShadow: `0 0 6px ${skill.accent}` }}
                  />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

interface JamiePullAgentProps {
  /** Invoked when the quota modal's "Sign Up" CTA is clicked. Host
   *  (SearchInterface) owns the actual sign-in flow. */
  onSignUp?: () => void;
  /** Invoked when the quota modal's "Upgrade" CTA is clicked
   *  (anonymous/registered -> Jamie Plus). */
  onUpgrade?: () => void;
  /** Invoked when the quota modal's Pro upgrade CTA is clicked
   *  (subscriber -> Jamie Pro). */
  onUpgradePro?: () => void;
}

export const JamiePullAgent: React.FC<JamiePullAgentProps> = ({ onSignUp, onUpgrade, onUpgradePro }) => {
  const {
    messages,
    sendMessage,
    clearMessages,
    // `model` / `setModel` are intentionally kept in the hook API even though
    // the UI toggle is deprecated (2026-04). We still read setModel below to
    // silence the unused-var lint; re-wire here when the toggle returns.
    setModel,
    quotaExceededData,
    clearQuotaExceeded,
  } = useJamiePullAgent();

  const { playTrack, currentTrack } = useAudioController();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeClip, setActiveClip] = useState<ClipMeta | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  // Session-stable tagline A/B pick (see TAGLINES array near the top).
  const tagline = useMemo(() => pickTagline(), []);
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

  // Ordered list of unique clip pineconeIds across the whole conversation.
  // Used by the prev/next nav above the mini-player.
  const orderedClipIds = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.text) continue;
      for (const id of extractClipIds(msg.text)) {
        if (!seen.has(id)) {
          seen.add(id);
          ordered.push(id);
        }
      }
    }
    return ordered;
  }, [messages]);

  const activeClipIndex = useMemo(
    () => (activeClip ? orderedClipIds.indexOf(activeClip.pineconeId) : -1),
    [orderedClipIds, activeClip]
  );

  const gotoClip = useCallback(
    (delta: -1 | 1) => {
      if (activeClipIndex < 0 || orderedClipIds.length === 0) return;
      const nextIdx = activeClipIndex + delta;
      if (nextIdx < 0 || nextIdx >= orderedClipIds.length) return;
      const nextId = orderedClipIds[nextIdx];
      const meta = clipMetaCache.get(nextId);
      if (meta) handlePlayClip(meta);
    },
    [activeClipIndex, orderedClipIds, handlePlayClip]
  );

  const hasPrevClip = activeClipIndex > 0;
  const hasNextClip = activeClipIndex >= 0 && activeClipIndex < orderedClipIds.length - 1;

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

  // DEPRECATED (2026-04): fast/quality model toggle was removed from the UI.
  // The hook still accepts `setModel` and defaults to 'fast', so we can reintroduce
  // the toggle later without touching the hook. Leaving this stub commented out
  // as a reminder of where the UI switch used to live.
  // const toggleModel = () => {
  //   setModel(model === 'fast' ? 'quality' : 'fast');
  // };
  void setModel; // silence unused-var lint while the toggle is parked

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
      {/* Floating top-right controls.
          Uses `fixed` (not `absolute`) so it sits in viewport coordinates
          and lines up horizontally with the segmented view toggle rendered
          by SearchInterface (also `fixed top-3`). The pill styling below
          mirrors the segmented control (same outer container + inner
          button padding) so the two sit at the exact same height.
          DEPRECATED (2026-04): the fast/quality model toggle used to live
          here alongside the reset button. It's been removed while we
          standardize on 'fast' (Haiku 4.5). Reintroduce here when/if we
          expose model selection to users again. */}
      {hasMessages && (
        <div className="fixed top-3 right-4 z-30 pointer-events-none">
          <div className="pointer-events-auto inline-flex rounded-lg border border-white/10 p-0.5 bg-black/40 backdrop-blur-md">
            <button
              onClick={clearMessages}
              className="rounded-md text-sm font-medium transition-all flex items-center gap-2 px-2.5 py-1.5 text-gray-400 hover:text-white"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages / Empty State */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ overflowAnchor: 'none' }}>
        {!hasMessages ? (
          <div className="flex flex-col items-center min-h-full px-5 pt-2 sm:pt-4 pb-8">
            {/* Logo lockup — aspect-ratio preserved via max-w + object-contain;
                scaled down on small screens so the wide wordmark doesn't get
                squeezed or forced into an oddly-truncated state. */}
            <div className="relative animate-fade-in max-w-full">
              <div className="absolute inset-0 bg-white/5 blur-2xl scale-110 animate-logo-glow" />
              <img
                src="/jamie-pull.png"
                alt="Jamie Pull"
                className="relative h-[52px] sm:h-[77px] md:h-[102px] w-auto max-w-full object-contain"
              />
            </div>

            {/* Tagline */}
            <div
              data-tagline-id={tagline.id}
              className="max-w-[28rem] mx-auto mt-1 mb-6 text-center animate-fade-in"
              style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}
            >
              <p className="text-sm sm:text-base text-gray-200 font-medium">
                {tagline.headline}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                {tagline.subline}
              </p>
            </div>

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
                {/* Hero input — extra bottom margin so the conveyor doesn't
                    crowd the input and the eye can land on the search first. */}
                <div
                  className="w-full flex justify-center mb-8 animate-fade-in"
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
                  className="w-full flex justify-center mb-6 animate-fade-in"
                  style={{ animationDelay: '350ms', animationFillMode: 'backwards' }}
                >
                  <PromptConveyor onSelect={handlePromptPill} />
                </div>

                {/* Skill chips — Research / Create / Publish / Worker.
                    Toggle SHOW_SKILL_CHIPS to hide entirely; flip
                    SKILL_CHIP_LAYOUT ('slim' | 'grid') at the top of this
                    file to swap between the compact single-row pill row
                    and the chunky 2×N grid. */}
                {SHOW_SKILL_CHIPS && (
                  <div className="w-full flex justify-center mb-4">
                    {SKILL_CHIP_LAYOUT === 'slim' ? (
                      // Slim: icon + title + optional "Soon" + help icon,
                      // laid out in a single row. flex-wrap kicks in on
                      // very narrow viewports so chips don't overflow.
                      <div className="flex flex-wrap gap-2 justify-center w-full max-w-[40rem]">
                        {SKILLS.map((s, i) => (
                          <SkillChip
                            key={s.id}
                            skill={s}
                            animDelay={400 + i * 80}
                            onOpenInfo={setActiveSkill}
                            variant="slim"
                          />
                        ))}
                      </div>
                    ) : (
                      // Grid: 1-col stack on mobile, 2×N chunky cards
                      // with taglines at sm+.
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full max-w-[40rem]">
                        {SKILLS.map((s, i) => (
                          <SkillChip
                            key={s.id}
                            skill={s}
                            animDelay={400 + i * 80}
                            onOpenInfo={setActiveSkill}
                            variant="grid"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Topic grid label */}
            <div
              className="w-full max-w-[56rem] mb-6 animate-fade-in"
              style={{ animationDelay: '550ms', animationFillMode: 'backwards' }}
            >
              <div className="text-sm uppercase tracking-wide text-gray-300 font-medium">
                Popular Topics
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Curated starting points across the podcast corpus.
              </div>
            </div>

            {/* Category grid — staggered fade-in, row-by-row (top first,
                bottom last). Assumes desktop 3-col layout; on smaller
                viewports the delays still cascade monotonically. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-[56rem]">
              {CATEGORIES.map((cat, i) => {
                const row = Math.floor(i / 3);
                const col = i % 3;
                // If skill chips are showing, nudge the grid later so the
                // chips resolve first and the wave reads top-down cleanly.
                const base = SHOW_SKILL_CHIPS ? 650 : 200;
                const delay = base + row * 420 + col * 70;
                return (
                  <CategoryCard
                    key={cat.title}
                    category={cat}
                    onSelect={handleQuerySelect}
                    animDelay={delay}
                  />
                );
              })}
            </div>

            {/* Model label removed — hiding model identity from the UI
                (2026-04). Reinstate a dynamic label here if/when we bring
                back model selection. */}
          </div>
        ) : (
          /* Top padding leaves room for the fixed Reset button
             (fixed top-3 right-4) so it never overlaps the first
             message bubble on narrow viewports.

             The parent stays full-width. Per-bubble asymmetry (agent
             messages anchored left with a large right gutter; user
             messages anchored right with a large left gutter) is
             handled inside JamiePullAgentMessage via each bubble's own
             max-width + justify-start / justify-end. */
          <div className="px-5 md:pl-24 md:pr-[51px] pt-14 pb-6 space-y-5">
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
                  <JamiePullAgentMessage
                    message={msg}
                    onPlayClip={handlePlayClip}
                    onFollowUp={sendMessage}
                    originalQuery={originalQuery}
                    activeClipId={activeClip?.pineconeId}
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
        <div className="flex-shrink-0">
          {/* Prev/Next clip nav */}
          {orderedClipIds.length > 1 && (
            <div className="flex items-center justify-center gap-2 px-5 py-2 bg-black/80 backdrop-blur-sm">
              <NavGlowButton
                direction="prev"
                size="sm"
                glowRgb="255,255,255"
                disabled={!hasPrevClip}
                onClick={() => gotoClip(-1)}
                label="Prev"
                title="Previous clip"
              />
              <span className="text-[11px] text-gray-500 tabular-nums min-w-[3.5rem] text-center">
                {activeClipIndex >= 0 ? `${activeClipIndex + 1} / ${orderedClipIds.length}` : ''}
              </span>
              <NavGlowButton
                direction="next"
                size="sm"
                glowRgb="255,255,255"
                disabled={!hasNextClip}
                onClick={() => gotoClip(1)}
                label="Next"
                title="Next clip"
              />
            </div>
          )}
          <div className="[&>div]:!relative [&>div]:!inset-auto">
          <EmbedMiniPlayer
            mode="app"
            isHovered={true}
            audioUnlocked={true}
            trackId={activeClip.pineconeId}
            audioUrl={activeClip.audioUrl}
            episodeTitle={activeClip.episodeTitle}
            episodeImage={activeClip.episodeImage}
            creator={activeClip.creator}
            publishedDate={activeClip.publishedDate}
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

      {/* Skill info modal */}
      <SkillInfoModal
        skill={activeSkill}
        onClose={() => setActiveSkill(null)}
        onExample={handleQuerySelect}
      />

      {/* Quota exceeded modal — triggered when /api/pull returns 429.
          Host-supplied callbacks (onSignUp / onUpgrade / onUpgradePro) let
          SearchInterface reuse its existing sign-in + checkout flows so
          the user can climb tiers without leaving the Agent tab. */}
      <QuotaExceededModal
        isOpen={!!quotaExceededData}
        onClose={clearQuotaExceeded}
        data={quotaExceededData || { tier: 'anonymous', used: 0, max: 0 }}
        onSignUp={onSignUp ? () => { clearQuotaExceeded(); onSignUp(); } : undefined}
        onUpgrade={onUpgrade ? () => { clearQuotaExceeded(); onUpgrade(); } : undefined}
        onUpgradePro={onUpgradePro ? () => { clearQuotaExceeded(); onUpgradePro(); } : undefined}
      />
    </div>
  );
};

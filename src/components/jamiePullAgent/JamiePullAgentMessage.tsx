import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
  AlertCircle,
  MessageSquareText,
  Upload,
  Loader2,
  Play,
  ArrowUpRight,
} from 'lucide-react';
import type {
  ChatMessage,
  AgentSuggestedAction,
  SubmitOnDemandAction,
  FollowUpMessageAction,
  FollowUpContext,
} from '../../types/jamiePullAgent';
import { ActivityTimeline, ResponseMetadata } from './JamiePullAgentResultCards.tsx';
import { API_URL } from '../../constants/constants.ts';
import { InlineCardMention, type AnalysisCardJson } from '../UnifiedSidePanel.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';
import TryJamieService from '../../services/tryJamieService.ts';


// ─── Clip metadata fetching & cache ─────────────────────────────────────────

export interface ClipMeta {
  pineconeId: string;
  episodeTitle: string;
  episodeImage: string;
  creator: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  text: string;
  publishedDate?: string;
}

const CACHE_STORAGE_KEY = 'workflow_clip_meta_cache';
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function hydrateCache(): Map<string, ClipMeta> {
  const map = new Map<string, ClipMeta>();
  try {
    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { ts: number; entries: [string, ClipMeta][] };
      if (Date.now() - parsed.ts < CACHE_MAX_AGE_MS) {
        for (const [k, v] of parsed.entries) map.set(k, v);
      } else {
        sessionStorage.removeItem(CACHE_STORAGE_KEY);
      }
    }
  } catch { /* ignore corrupt storage */ }
  return map;
}

function persistCache(cache: Map<string, ClipMeta>) {
  try {
    sessionStorage.setItem(
      CACHE_STORAGE_KEY,
      JSON.stringify({ ts: Date.now(), entries: [...cache.entries()] })
    );
  } catch { /* storage full — non-critical */ }
}

export const clipMetaCache = hydrateCache();
const clipMetaInFlight = new Set<string>();
const clipMetaFailed = new Set<string>();

const MAX_CONCURRENT = 1;
const REQUEST_DELAY_MS = 500;
let activeRequests = 0;
const pendingQueue: (() => void)[] = [];

function drainQueue() {
  if (activeRequests >= MAX_CONCURRENT || pendingQueue.length === 0) return;
  activeRequests++;
  pendingQueue.shift()!();
}

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

async function fetchClipMeta(pineconeId: string): Promise<ClipMeta | null> {
  return new Promise<ClipMeta | null>(resolve => {
    const run = async () => {
      const cachedHit = clipMetaCache.get(pineconeId);
      if (cachedHit) {
        resolve(cachedHit);
        return;
      }
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await fetch(
            `${API_URL}/api/get-hierarchy?paragraphId=${encodeURIComponent(pineconeId)}`
          );
          if (!res.ok) { resolve(null); return; }
          const data = await res.json();
          const h = data.hierarchy;
          const para = h?.paragraph?.metadata;
          const ep = h?.episode?.metadata;
          const meta: ClipMeta = {
            pineconeId,
            episodeTitle: ep?.title || para?.episode || 'Unknown episode',
            episodeImage: ep?.imageUrl || para?.episodeImage || '',
            creator: ep?.creator || para?.creator || '',
            audioUrl: para?.audioUrl || ep?.audioUrl || '',
            startTime: para?.start_time ?? 0,
            endTime: para?.end_time ?? 0,
            text: para?.text || '',
            publishedDate: ep?.publishedDate || para?.publishedDate || undefined,
          };
          clipMetaCache.set(pineconeId, meta);
          persistCache(clipMetaCache);
          resolve(meta);
          return;
        } catch {
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, INITIAL_RETRY_DELAY_MS * (attempt + 1)));
            continue;
          }
          resolve(null);
        }
      }
    };
    const cleanup = async () => {
      try { await run(); } finally {
        activeRequests--;
        setTimeout(drainQueue, REQUEST_DELAY_MS);
      }
    };
    pendingQueue.push(cleanup);
    drainQueue();
  });
}

function useClipMetadata(pineconeIds: string[]): Map<string, ClipMeta> {
  const [rev, setRev] = useState(0);
  const idsKey = pineconeIds.join(',');

  useEffect(() => {
    if (!pineconeIds.length) return;
    let cancelled = false;

    const toFetch = pineconeIds.filter(
      id => !clipMetaCache.has(id) && !clipMetaInFlight.has(id) && !clipMetaFailed.has(id)
    );

    for (const id of toFetch) {
      clipMetaInFlight.add(id);
      fetchClipMeta(id).then(meta => {
        clipMetaInFlight.delete(id);
        if (cancelled) return;
        if (meta) {
          clipMetaCache.set(id, meta);
        } else {
          clipMetaFailed.add(id);
        }
        setRev(r => r + 1);
      });
    }

    return () => { cancelled = true; };
  }, [idsKey]);

  return clipMetaCache;
}

// ─── Clip token regex ────────────────────────────────────────────────────────

const CLIP_TOKEN_RE = /\{\{clip:([^}]+)\}\}/g;

export function extractClipIds(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(CLIP_TOKEN_RE)) ids.push(m[1]);
  return [...new Set(ids)];
}

// ─── Build markdown with [[CLIP:n]] placeholders ────────────────────────────

function buildMarkdownWithClipPlaceholders(text: string): {
  markdown: string;
  clipsByIndex: Record<number, string>;
} {
  const clipsByIndex: Record<number, string> = {};
  let idx = 0;
  const markdown = text.replace(CLIP_TOKEN_RE, (_match, pineconeId) => {
    clipsByIndex[idx] = pineconeId;
    return ` [[CLIP:${idx++}]] `;
  });
  return { markdown, clipsByIndex };
}

// ─── Nebula thumbnail for research session cards ────────────────────────────

const NEBULA_SIZE = 48;
const NEBULA_DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1;

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

export const NebulaThumbnail: React.FC<{ size?: number }> = React.memo(({ size = NEBULA_SIZE }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = size * NEBULA_DPR;
    canvas.width = s;
    canvas.height = s;
    const rand = seededRand(42);

    ctx.fillStyle = '#08080c';
    ctx.fillRect(0, 0, s, s);

    // Nebula clouds — warm orange/amber blobs
    const clouds = [
      { x: 0.3, y: 0.35, r: 0.5, color: 'rgba(240,139,71,0.22)' },
      { x: 0.7, y: 0.6,  r: 0.45, color: 'rgba(204,68,0,0.15)' },
      { x: 0.5, y: 0.5,  r: 0.35, color: 'rgba(255,180,100,0.12)' },
    ];
    for (const c of clouds) {
      const g = ctx.createRadialGradient(c.x * s, c.y * s, 0, c.x * s, c.y * s, c.r * s);
      g.addColorStop(0, c.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }

    // Scattered stars
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 30; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const brightness = 0.3 + rand() * 0.5;
      const radius = (0.3 + rand() * 0.8) * NEBULA_DPR;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${200 + Math.floor(rand() * 55)},${180 + Math.floor(rand() * 75)},${brightness})`;
      ctx.fill();
    }

    // Bright core star with glow
    const cx = s * 0.42;
    const cy = s * 0.40;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.18);
    glow.addColorStop(0, 'rgba(255,220,180,0.8)');
    glow.addColorStop(0.4, 'rgba(240,139,71,0.3)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.05);
    core.addColorStop(0, 'rgba(255,255,240,0.95)');
    core.addColorStop(1, 'transparent');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, s, s);

    ctx.globalCompositeOperation = 'source-over';
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className="flex-shrink-0 rounded-md"
      style={{ width: size, height: size }}
    />
  );
});

// ─── Time formatter ─────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// ─── Build display title for a clip pill based on context ────────────────────

function clipPillTitle(meta: ClipMeta | undefined): string {
  if (!meta) return 'Loading…';
  return `${fmtTime(meta.startTime)} — ${meta.episodeTitle}`;
}

// ─── Inject clip pills into ReactMarkdown output ────────────────────────────

function injectClipCards(
  node: React.ReactNode,
  clipsByIndex: Record<number, string>,
  metaCache: Map<string, ClipMeta>,
  onCardClick: (pineconeId: string) => void,
  onCopyLink: (pineconeId: string) => void,
  activeClipId?: string
): React.ReactNode {
  const tokenRe = /\[\[CLIP:(\d+)\]\]/g;

  if (typeof node === 'string') {
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(node)) !== null) {
      const [full, idxStr] = m;
      const clipIdx = Number(idxStr);
      const start = m.index;
      if (start > last) out.push(node.slice(last, start));
      const pineconeId = clipsByIndex[clipIdx];
      if (pineconeId) {
        const meta = metaCache.get(pineconeId);
        const card: AnalysisCardJson = {
          pineconeId,
          episodeImage: meta?.episodeImage,
          title: clipPillTitle(meta),
          // Transcript text powers the "explore in Galaxy" arrow — opens
          // /app?view=galaxy&q=<quote> so the user can see neighbors.
          quote: meta?.text,
        };
        out.push(
          <InlineCardMention
            key={`clip-${clipIdx}-${start}`}
            card={card}
            onClick={onCardClick}
            onCopyLink={onCopyLink}
            isActive={activeClipId === pineconeId}
          />
        );
      } else {
        out.push(full);
      }
      last = start + full.length;
    }
    if (last < node.length) out.push(node.slice(last));
    return out.length === 1 ? out[0] : out;
  }

  if (Array.isArray(node)) {
    return node.map((child) =>
      injectClipCards(child, clipsByIndex, metaCache, onCardClick, onCopyLink, activeClipId)
    );
  }

  if (React.isValidElement(node)) {
    const children = (node.props as any)?.children;
    if (!children) return node;
    return React.cloneElement(node as any, {
      ...(node.props as any),
      children: injectClipCards(children, clipsByIndex, metaCache, onCardClick, onCopyLink, activeClipId),
    });
  }

  return node;
}

// ─── Detect paragraphs that contain only a card pill ────────────────────────

function isCardOnlyParagraph(node: React.ReactNode): boolean {
  const isWhitespace = (x: unknown) => typeof x === 'string' && (x as string).trim() === '';

  if (React.isValidElement(node)) {
    return (node.type as any) === InlineCardMention;
  }

  if (Array.isArray(node)) {
    const filtered = node.filter(n => !isWhitespace(n));
    return (
      filtered.length === 1 &&
      React.isValidElement(filtered[0]) &&
      (filtered[0] as any).type === InlineCardMention
    );
  }

  return false;
}

// ─── Markdown renderer — mirrors UnifiedSidePanel's AI Analysis rendering ───

const MarkdownWithClips: React.FC<{
  text: string;
  clipsByIndex: Record<number, string>;
  metaCache: Map<string, ClipMeta>;
  onCardClick: (pineconeId: string) => void;
  onCopyLink: (pineconeId: string) => void;
  activeClipId?: string;
}> = ({ text, clipsByIndex, metaCache, onCardClick, onCopyLink, activeClipId }) => {
  const inject = useCallback(
    (children: React.ReactNode) =>
      injectClipCards(children, clipsByIndex, metaCache, onCardClick, onCopyLink, activeClipId),
    [clipsByIndex, metaCache, onCardClick, onCopyLink, activeClipId]
  );

  const components = useMemo(
    () => ({
      p: ({ children }: any) => {
        const injected = inject(children);
        const isCardOnly = isCardOnlyParagraph(injected);
        return <p className={isCardOnly ? 'my-1' : 'my-2'}>{injected}</p>;
      },
      ul: ({ children }: any) => (
        <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>
      ),
      ol: ({ children }: any) => (
        <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>
      ),
      li: ({ children }: any) => (
        <li className="my-1">{inject(children)}</li>
      ),
      blockquote: ({ children }: any) => (
        <div className="relative my-3 pl-4 py-2.5 pr-3 border-l-[3px] border-white/25 bg-white/[0.03] rounded-r-md">
          <span className="absolute -top-2 left-3 px-1.5 py-px text-[8px] uppercase tracking-widest text-gray-500 bg-[#0e0e10] rounded-sm">
            Quote
          </span>
          <div className="text-gray-400 text-[13px] leading-relaxed">{inject(children)}</div>
        </div>
      ),
      strong: ({ children }: any) => <strong>{inject(children)}</strong>,
      em: ({ children }: any) => <em>{inject(children)}</em>,
      a: ({ href, children }: any) => {
        if (href && /[?&]researchSessionId=/.test(href)) {
          const titleText = typeof children === 'string'
            ? children
            : Array.isArray(children)
              ? children.filter((c: unknown) => typeof c === 'string').join('')
              : 'Research Session';
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="research-session-card flex items-center gap-3 my-3 px-3 py-3 rounded-lg no-underline group relative overflow-hidden transition-all"
              style={{
                border: '3px solid rgba(240,139,71,0.15)',
                background: 'radial-gradient(ellipse at 25% 40%, rgba(240,139,71,0.15), transparent 60%), radial-gradient(ellipse at 75% 60%, rgba(204,68,0,0.1), transparent 55%), #08080c',
                boxShadow: '0 0 10px rgba(240,139,71,0.15), 0 0 25px rgba(204,68,0,0.06), inset 0 0 15px rgba(240,139,71,0.06)',
              }}
            >
              <NebulaThumbnail />
              <span className="flex-1 min-w-0 z-10">
                <span className="block text-sm font-medium text-white truncate">{titleText}</span>
                <span className="block text-[10px] text-orange-300/50 mt-0.5">Research Session</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-orange-400/40 group-hover:text-orange-300 transition-colors flex-shrink-0 z-10" />
            </a>
          );
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            {children}
          </a>
        );
      },
      h1: ({ children }: any) => (
        <h1 className="text-2xl font-bold text-white my-2">{inject(children)}</h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="text-xl font-bold text-white my-2">{inject(children)}</h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="text-lg font-semibold text-white my-2">{inject(children)}</h3>
      ),
    }),
    [inject]
  );

  return (
    <div className="text-sm text-gray-300 leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
};

// ─── Suggested action chips ─────────────────────────────────────────────────

const FOUNTAIN_API = 'https://rss-extractor-app-yufbq.ondigitalocean.app/getFountainLink';

type SubmitState = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

const POLL_INTERVAL_MS = 5000;

const SubmitOnDemandChip: React.FC<{
  action: SubmitOnDemandAction;
  originalQuery?: string;
  onFollowUp?: (message: string) => void;
}> = ({ action, originalQuery, onFollowUp }) => {
  const episodeTitle = action.episodeTitle || '';
  const episodeImage = action.image;
  const [fountainUrl, setFountainUrl] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!action.guid) return;
    let cancelled = false;
    fetch(FOUNTAIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guid: action.guid }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled && data.success) setFountainUrl(data.fountainLink); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [action.guid]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleTranscribe = async () => {
    if (!action.guid || !action.feedGuid || !action.feedId) return;
    setSubmitState('submitting');
    setErrorMsg(null);
    try {
      const res = await TryJamieService.submitOnDemandRun({
        message: `Transcribe: ${episodeTitle || action.guid}`,
        parameters: {},
        episodes: [{
          guid: action.guid,
          feedGuid: action.feedGuid,
          feedId: Number(action.feedId),
        }],
      });

      setSubmitState('polling');
      setJobProgress('Queued…');

      pollRef.current = setInterval(async () => {
        try {
          const status = await TryJamieService.getOnDemandJobStatus(res.jobId);
          const { stats } = status;
          setJobProgress(`${stats.episodesProcessed}/${stats.totalEpisodes} processed`);
          if (status.status === 'complete') {
            if (pollRef.current) clearInterval(pollRef.current);
            setSubmitState('done');
            setJobProgress(null);
          } else if (status.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setSubmitState('error');
            setErrorMsg('Transcription failed');
            setJobProgress(null);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setSubmitState('error');
          setErrorMsg('Lost connection to job');
        }
      }, POLL_INTERVAL_MS);
    } catch (err: any) {
      setSubmitState('error');
      setErrorMsg(err.message || 'Submission failed');
    }
  };

  const isBusy = submitState === 'submitting' || submitState === 'polling';

  return (
    <div className="action-chip action-chip--transcribe rounded-lg p-3">
      <div className="flex items-start gap-3">
        {episodeImage ? (
          <img
            src={episodeImage}
            alt={episodeTitle}
            className="w-10 h-10 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-800/60 flex items-center justify-center flex-shrink-0">
            <Upload className="w-4 h-4 text-blue-400/70" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-gray-200 text-sm font-medium">Transcribe this episode</p>
          {episodeTitle && (
            <p className="text-gray-300 text-xs mt-0.5 truncate">{episodeTitle}</p>
          )}
          <p className="text-gray-600 text-[10px] mt-1 line-clamp-2">{action.reason}</p>
          {jobProgress && (
            <p className="text-blue-400/70 text-[10px] mt-1">{jobProgress}</p>
          )}
          {submitState === 'error' && errorMsg && (
            <p className="text-red-400/70 text-[10px] mt-1">{errorMsg}</p>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          {submitState === 'done' ? (
            <span className="px-3 py-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg">
              Submitted
            </span>
          ) : (
            <button
              onClick={handleTranscribe}
              disabled={isBusy || !action.guid}
              className="px-3 py-1.5 text-xs rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              style={{ color: '#7799ff', background: 'rgba(51,102,255,0.1)', border: '1px solid rgba(51,102,255,0.22)' }}
            >
              {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
              {submitState === 'submitting' ? 'Submitting…' : submitState === 'polling' ? 'Processing…' : submitState === 'error' ? 'Retry' : 'Transcribe'}
            </button>
          )}
          {fountainUrl && (
            <a
              href={fountainUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 rounded-md border border-gray-800 hover:text-gray-300 hover:border-gray-700 transition-colors"
              title="Listen on Fountain.fm"
            >
              <Play className="w-2.5 h-2.5" />
              Preview
            </a>
          )}
        </div>
      </div>
      {submitState === 'done' && onFollowUp && originalQuery && (
        <button
          onClick={() => {
            const context = action.guid
              ? `I just transcribed episode ${action.guid} (feedId: ${action.feedId}). `
              : '';
            onFollowUp(`${context}${originalQuery}`);
          }}
          className="flex items-center gap-2 mt-2 px-3 py-2 text-xs text-green-300 bg-green-500/5 border border-green-900/30 rounded-lg hover:bg-green-500/10 transition-colors w-full text-left"
        >
          <MessageSquareText className="w-3.5 h-3.5 text-green-400/70 flex-shrink-0" />
          <span className="truncate">Re-ask: {originalQuery}</span>
        </button>
      )}
    </div>
  );
};

const FOLLOW_UP_MAX_CHARS = 60;

// Backend may omit `label` or send an empty string. In that case fall back to
// a truncated `message` so the chip stays compact and doesn't render a wall of
// text. Never use `reason` here — it's an internal explanation string, not
// user-facing copy. The full `message` is still what gets POSTed on click.
const getFollowUpDisplayText = (action: FollowUpMessageAction): string => {
  const label = action.label?.trim();
  if (label) return label;
  const msg = action.message?.trim() ?? '';
  if (msg.length <= FOLLOW_UP_MAX_CHARS) return msg;
  return `${msg.slice(0, FOLLOW_UP_MAX_CHARS).trimEnd()}…`;
};

const FollowUpChip: React.FC<{
  action: FollowUpMessageAction;
  onSend: (message: string, context?: FollowUpContext) => void;
}> = ({ action, onSend }) => {
  const displayText = getFollowUpDisplayText(action);
  return (
    <button
      onClick={() => onSend(action.message, action.context)}
      title={action.message}
      className="action-chip action-chip--followup flex items-center gap-2 px-3 py-2 text-xs text-gray-300 rounded-lg transition-all text-left max-w-full sm:max-w-md"
    >
      <MessageSquareText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="truncate">{displayText}</span>
    </button>
  );
};

const SuggestedActions: React.FC<{
  actions: AgentSuggestedAction[];
  onFollowUp: (message: string, context?: FollowUpContext) => void;
  originalQuery?: string;
}> = ({ actions, onFollowUp, originalQuery }) => {
  if (!actions.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {actions.map((action, i) => {
        switch (action.type) {
          case 'submit-on-demand':
            return (
              <SubmitOnDemandChip
                key={i}
                action={action}
                originalQuery={originalQuery}
                onFollowUp={onFollowUp}
              />
            );
          case 'follow-up-message':
            return <FollowUpChip key={i} action={action} onSend={onFollowUp} />;
          default:
            return null;
        }
      })}
    </div>
  );
};

// ─── Message component ──────────────────────────────────────────────────────

interface JamiePullAgentMessageProps {
  message: ChatMessage;
  onPlayClip?: (meta: ClipMeta) => void;
  onFollowUp?: (message: string, context?: FollowUpContext) => void;
  originalQuery?: string;
  activeClipId?: string;
}

export const JamiePullAgentMessage: React.FC<JamiePullAgentMessageProps> = ({ message, onPlayClip, onFollowUp, originalQuery, activeClipId }) => {
  const { statusMessages, toolCalls, toolResults, suggestedActions, text, donePayload, error, loading } =
    message;

  const clipIds = useMemo(
    () => (text ? extractClipIds(text) : []),
    [text]
  );
  const metaCache = useClipMetadata(clipIds);

  const { markdown, clipsByIndex } = useMemo(() => {
    if (!text) return { markdown: '', clipsByIndex: {} };
    return buildMarkdownWithClipPlaceholders(text);
  }, [text]);

  const handleCardClick = useCallback(
    (pineconeId: string) => {
      if (!onPlayClip) return;
      const cached = clipMetaCache.get(pineconeId);
      if (cached) {
        onPlayClip(cached);
        return;
      }
      void fetchClipMeta(pineconeId).then((meta) => {
        if (meta) onPlayClip(meta);
      });
    },
    [onPlayClip]
  );

  const handleCopyLink = useCallback((pineconeId: string) => {
    const url = createClipShareUrl(pineconeId);
    navigator.clipboard.writeText(url).catch(() => {});
  }, []);

  if (message.role === 'user') {
    return (
      // User bubble anchored to the right via justify-end. Capped at 70%
      // on desktop so the bubble is bounded and the left side gets a
      // generous gutter — symmetric (mirrored) with the agent bubble's
      // right gutter. Mobile keeps the more generous 80% so short
      // questions don't look orphaned in the corner of a narrow screen.
      <div className="flex justify-end">
        <div className="max-w-[80%] md:max-w-[70%] rounded-2xl rounded-tr-sm px-4 py-3" style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a1a1c, #111113)', border: '1.5px solid rgba(255,255,255,0.4)' }}>
          <p className="text-white text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    // Agent bubble anchored to the left via justify-start. Capped at 70%
    // on desktop so the bubble is bounded and the right side gets a
    // generous gutter — symmetric (mirrored) with the user bubble's left
    // gutter. Mobile uses full width of the padded thread so horizontal
    // gutters come only from the parent (narrow px-2.5) instead of max-w-[90%]
    // widening the inset on only one side.
    <div className="flex justify-start">
      <div className="w-full md:max-w-[70%] space-y-3">
        {(statusMessages.length > 0 || toolCalls.length > 0) && (
          <ActivityTimeline
            statusMessages={statusMessages}
            toolCalls={toolCalls}
            toolResults={toolResults}
            hasText={!!text}
            running={!!loading}
          />
        )}

        {text && (
          <div className="rounded-lg p-5" style={{ background: 'radial-gradient(ellipse at 50% 50%, #141416, #0e0e10)', border: '2px solid rgba(255,255,255,0.35)' }}>
            <div className={!message.streamComplete ? 'streaming-cursor' : undefined}>
              <MarkdownWithClips
                text={markdown}
                clipsByIndex={clipsByIndex}
                metaCache={metaCache}
                onCardClick={handleCardClick}
                onCopyLink={handleCopyLink}
                activeClipId={activeClipId}
              />
            </div>
            {message.textPaused && !message.streamComplete && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/30 animate-fade-in">
                <div className="w-3 h-3 rounded-full border-b-2 border-gray-500 animate-spin" />
                <span className="text-gray-600 text-[11px]">Still working...</span>
              </div>
            )}
          </div>
        )}

        {suggestedActions.length > 0 && onFollowUp && (
          <SuggestedActions actions={suggestedActions} onFollowUp={onFollowUp} originalQuery={originalQuery} />
        )}

        {donePayload && <ResponseMetadata done={donePayload} />}

        {error && (
          <div className="flex items-center gap-2 bg-red-950/30 border border-red-900/30 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400/80 flex-shrink-0" />
            <p className="text-red-300/80 text-sm">{error}</p>
          </div>
        )}

        {loading && !toolCalls.length && !statusMessages.length && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 rounded-full border-b-2 border-white animate-spin" />
            <span className="text-gray-500 text-xs">Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};

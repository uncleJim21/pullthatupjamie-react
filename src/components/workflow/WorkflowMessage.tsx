import React, { useMemo, useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
  AlertCircle,
  ShieldCheck,
  Search,
  MessageSquareText,
  Upload,
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
} from 'lucide-react';
import type {
  ChatMessage,
  AgentSuggestedAction,
  SubmitOnDemandAction,
  DirectQueryAction,
  FollowUpMessageAction,
} from '../../types/workflow';
import { ActivityTimeline, ResponseMetadata } from './WorkflowResultCards.tsx';
import { API_URL } from '../../constants/constants.ts';
import { InlineCardMention, type AnalysisCardJson } from '../UnifiedSidePanel.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';


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

const clipMetaCache = hydrateCache();
const clipMetaInFlight = new Set<string>();
const clipMetaFailed = new Set<string>();

const MAX_CONCURRENT = 2;
let activeRequests = 0;
const pendingQueue: (() => void)[] = [];

function drainQueue() {
  while (activeRequests < MAX_CONCURRENT && pendingQueue.length > 0) {
    activeRequests++;
    pendingQueue.shift()!();
  }
}

async function fetchClipMeta(pineconeId: string): Promise<ClipMeta | null> {
  return new Promise<ClipMeta | null>(resolve => {
    const run = async () => {
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
        };
        clipMetaCache.set(pineconeId, meta);
        persistCache(clipMetaCache);
        resolve(meta);
      } catch {
        resolve(null);
      } finally {
        activeRequests--;
        drainQueue();
      }
    };
    pendingQueue.push(run);
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

function extractClipIds(text: string): string[] {
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
  onCopyLink: (pineconeId: string) => void
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
        };
        out.push(
          <InlineCardMention
            key={`clip-${clipIdx}-${start}`}
            card={card}
            onClick={onCardClick}
            onCopyLink={onCopyLink}
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
      injectClipCards(child, clipsByIndex, metaCache, onCardClick, onCopyLink)
    );
  }

  if (React.isValidElement(node)) {
    const children = (node.props as any)?.children;
    if (!children) return node;
    return React.cloneElement(node as any, {
      ...(node.props as any),
      children: injectClipCards(children, clipsByIndex, metaCache, onCardClick, onCopyLink),
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
}> = ({ text, clipsByIndex, metaCache, onCardClick, onCopyLink }) => {
  const inject = useCallback(
    (children: React.ReactNode) =>
      injectClipCards(children, clipsByIndex, metaCache, onCardClick, onCopyLink),
    [clipsByIndex, metaCache, onCardClick, onCopyLink]
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
      strong: ({ children }: any) => <strong>{inject(children)}</strong>,
      em: ({ children }: any) => <em>{inject(children)}</em>,
      h1: ({ children }: any) => (
        <h1 className="text-2xl font-bold text-white my-2">{children}</h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="text-xl font-bold text-white my-2">{children}</h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="text-lg font-semibold text-white my-2">{children}</h3>
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

const SubmitOnDemandChip: React.FC<{ action: SubmitOnDemandAction }> = ({ action }) => {
  const [fountainUrl, setFountainUrl] = useState<string | null>(null);

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

  return (
    <div className="bg-[#111111] border border-blue-900/30 rounded-lg p-3">
      <div className="flex items-start gap-3">
        {action.image ? (
          <img
            src={action.image}
            alt={action.episodeTitle || ''}
            className="w-10 h-10 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
            <Upload className="w-4 h-4 text-blue-400/70" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-gray-300 text-sm font-medium">Transcribe this episode</p>
          {action.episodeTitle && (
            <p className="text-gray-500 text-xs mt-0.5 truncate">{action.episodeTitle}</p>
          )}
          <p className="text-gray-600 text-[10px] mt-1 line-clamp-2">{action.reason}</p>
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <button className="px-3 py-1.5 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors">
            Transcribe
          </button>
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
    </div>
  );
};

const DirectQueryChip: React.FC<{
  action: DirectQueryAction;
}> = ({ action }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (loading || result) {
      setExpanded(e => !e);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}${action.endpoint}`, {
        method: action.method || 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action.body),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setResult(data);
      setExpanded(true);
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 bg-[#111111] border border-gray-800 rounded-lg hover:border-gray-700 hover:bg-[#161616] transition-all w-full text-left"
      >
        <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <span className="flex-1 truncate">{action.label}</span>
        {loading && <Loader2 className="w-3 h-3 text-gray-500 animate-spin flex-shrink-0" />}
        {result && (
          expanded
            ? <ChevronUp className="w-3 h-3 text-gray-600 flex-shrink-0" />
            : <ChevronDown className="w-3 h-3 text-gray-600 flex-shrink-0" />
        )}
      </button>
      {error && (
        <p className="text-red-400/70 text-[10px] mt-1 px-1">{error}</p>
      )}
      {result && expanded && (
        <div className="mt-2 bg-[#0D0D0D] border border-gray-800 rounded-lg p-3 text-xs text-gray-400 max-h-60 overflow-y-auto">
          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

const FollowUpChip: React.FC<{
  action: FollowUpMessageAction;
  onSend: (message: string) => void;
}> = ({ action, onSend }) => (
  <button
    onClick={() => onSend(action.message)}
    className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 bg-[#111111] border border-gray-800 rounded-lg hover:border-gray-700 hover:bg-[#161616] transition-all text-left"
  >
    <MessageSquareText className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
    <span className="truncate">{action.label}</span>
  </button>
);

const SuggestedActions: React.FC<{
  actions: AgentSuggestedAction[];
  onFollowUp: (message: string) => void;
}> = ({ actions, onFollowUp }) => {
  if (!actions.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {actions.map((action, i) => {
        switch (action.type) {
          case 'submit-on-demand':
            return <SubmitOnDemandChip key={i} action={action} />;
          case 'direct-query':
            return <DirectQueryChip key={i} action={action} />;
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

interface WorkflowMessageProps {
  message: ChatMessage;
  onPlayClip?: (meta: ClipMeta) => void;
  onFollowUp?: (message: string) => void;
}

export const WorkflowMessage: React.FC<WorkflowMessageProps> = ({ message, onPlayClip, onFollowUp }) => {
  const { statusMessages, toolCalls, toolResults, suggestedActions, text, donePayload, error, loading } =
    message;

  const clipIds = useMemo(() => (text ? extractClipIds(text) : []), [text]);
  const metaCache = useClipMetadata(clipIds);

  const { markdown, clipsByIndex } = useMemo(() => {
    if (!text) return { markdown: '', clipsByIndex: {} };
    return buildMarkdownWithClipPlaceholders(text);
  }, [text]);

  const handleCardClick = useCallback(
    (pineconeId: string) => {
      const meta = clipMetaCache.get(pineconeId);
      if (meta && onPlayClip) onPlayClip(meta);
    },
    [onPlayClip]
  );

  const handleCopyLink = useCallback((pineconeId: string) => {
    const url = createClipShareUrl(pineconeId);
    navigator.clipboard.writeText(url).catch(() => {});
  }, []);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-white/10 border border-gray-700 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-white text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] w-full space-y-3">
        {(statusMessages.length > 0 || toolCalls.length > 0) && (
          <ActivityTimeline
            statusMessages={statusMessages}
            toolCalls={toolCalls}
            toolResults={toolResults}
            hasText={!!text}
          />
        )}

        {text && (
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-5">
            <div className={!message.streamComplete ? 'streaming-cursor' : undefined}>
              <MarkdownWithClips
                text={markdown}
                clipsByIndex={clipsByIndex}
                metaCache={metaCache}
                onCardClick={handleCardClick}
                onCopyLink={handleCopyLink}
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
          <SuggestedActions actions={suggestedActions} onFollowUp={onFollowUp} />
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

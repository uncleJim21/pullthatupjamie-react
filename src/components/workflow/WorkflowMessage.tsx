import React, { useMemo, useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { AlertCircle, ShieldCheck, Podcast, Play, Pause } from 'lucide-react';
import type { ChatMessage } from '../../types/workflow';
import { ToolCallTracker, ResponseMetadata } from './WorkflowResultCards.tsx';
import { API_URL } from '../../constants/constants.ts';
import { useAudioController } from '../../context/AudioControllerContext.tsx';
import { InlineCardMention, type AnalysisCardJson } from '../UnifiedSidePanel.tsx';

// ─── Clip metadata fetching & cache ─────────────────────────────────────────

interface ClipMeta {
  pineconeId: string;
  episodeTitle: string;
  episodeImage: string;
  creator: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  text: string;
}

const clipMetaCache = new Map<string, ClipMeta>();
const clipMetaInFlight = new Set<string>();

async function fetchClipMeta(pineconeId: string): Promise<ClipMeta | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/get-hierarchy?paragraphId=${encodeURIComponent(pineconeId)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const h = data.hierarchy;
    const para = h?.paragraph?.metadata;
    const ep = h?.episode?.metadata;
    return {
      pineconeId,
      episodeTitle: ep?.title || para?.episode || 'Unknown episode',
      episodeImage: ep?.imageUrl || para?.episodeImage || '',
      creator: ep?.creator || para?.creator || '',
      audioUrl: para?.audioUrl || ep?.audioUrl || '',
      startTime: para?.start_time ?? 0,
      endTime: para?.end_time ?? 0,
      text: para?.text || '',
    };
  } catch {
    return null;
  }
}

function useClipMetadata(pineconeIds: string[]): Map<string, ClipMeta> {
  const [rev, setRev] = useState(0);
  const idsKey = pineconeIds.join(',');

  useEffect(() => {
    if (!pineconeIds.length) return;
    let cancelled = false;

    const toFetch = pineconeIds.filter(
      id => !clipMetaCache.has(id) && !clipMetaInFlight.has(id)
    );

    for (const id of toFetch) {
      clipMetaInFlight.add(id);
      fetchClipMeta(id).then(meta => {
        clipMetaInFlight.delete(id);
        if (meta && !cancelled) {
          clipMetaCache.set(id, meta);
          setRev(r => r + 1);
        }
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

// ─── Inject InlineCardMention into ReactMarkdown output ─────────────────────

function injectClipCards(
  node: React.ReactNode,
  clipsByIndex: Record<number, string>,
  metaCache: Map<string, ClipMeta>,
  onCardClick: (pineconeId: string) => void
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
          title: meta?.episodeTitle,
        };
        out.push(
          <InlineCardMention
            key={`clip-${clipIdx}-${start}`}
            card={card}
            onClick={onCardClick}
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
      injectClipCards(child, clipsByIndex, metaCache, onCardClick)
    );
  }

  if (React.isValidElement(node)) {
    const children = (node.props as any)?.children;
    if (!children) return node;
    return React.cloneElement(node as any, {
      ...(node.props as any),
      children: injectClipCards(children, clipsByIndex, metaCache, onCardClick),
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
}> = ({ text, clipsByIndex, metaCache, onCardClick }) => {
  const inject = useCallback(
    (children: React.ReactNode) =>
      injectClipCards(children, clipsByIndex, metaCache, onCardClick),
    [clipsByIndex, metaCache, onCardClick]
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

// ─── Now-playing mini bar ───────────────────────────────────────────────────

const NowPlayingBar: React.FC<{ meta: ClipMeta }> = ({ meta }) => {
  const { currentTrack, isPlaying, isBuffering, togglePlay, currentTime } = useAudioController();
  const isActive = currentTrack?.id === meta.pineconeId;
  if (!isActive) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-[#0D0D0D] border border-gray-800 rounded-lg mt-2">
      {meta.episodeImage ? (
        <img
          src={meta.episodeImage}
          alt=""
          className="w-8 h-8 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
          <Podcast className="w-4 h-4 text-gray-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white truncate">{meta.episodeTitle}</p>
        <p className="text-[10px] text-gray-500 truncate">{meta.creator}</p>
      </div>
      <span className="text-[10px] text-gray-500 font-mono tabular-nums">
        {formatTime(currentTime)}
      </span>
      <button
        onClick={() => togglePlay()}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 transition-colors flex-shrink-0"
      >
        {isBuffering ? (
          <div className="w-3 h-3 rounded-full border-b-2 border-black animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5 ml-0.5" />
        )}
      </button>
    </div>
  );
};

// ─── Suggested action card ──────────────────────────────────────────────────

const SuggestedActionCard: React.FC<{ action: NonNullable<ChatMessage['suggestedAction']> }> = ({
  action,
}) => (
  <div className="bg-[#111111] border border-blue-900/30 rounded-lg p-4">
    <div className="flex items-start gap-2">
      <ShieldCheck className="w-4 h-4 text-blue-400/70 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-gray-300 text-sm font-medium">
          {action.type === 'submit-on-demand' ? 'Transcription suggested' : action.type}
        </p>
        <p className="text-gray-400 text-xs mt-1">{action.reason}</p>
        {action.episodeTitle && (
          <p className="text-gray-500 text-xs mt-1 italic">{action.episodeTitle}</p>
        )}
      </div>
    </div>
  </div>
);

// ─── Message component ──────────────────────────────────────────────────────

interface WorkflowMessageProps {
  message: ChatMessage;
}

export const WorkflowMessage: React.FC<WorkflowMessageProps> = ({ message }) => {
  const { statusMessages, toolCalls, toolResults, suggestedAction, text, donePayload, error, loading } =
    message;
  const { playTrack, currentTrack } = useAudioController();
  const [activeClip, setActiveClip] = useState<ClipMeta | null>(null);

  const clipIds = useMemo(() => (text ? extractClipIds(text) : []), [text]);
  const metaCache = useClipMetadata(clipIds);

  const { markdown, clipsByIndex } = useMemo(() => {
    if (!text) return { markdown: '', clipsByIndex: {} };
    return buildMarkdownWithClipPlaceholders(text);
  }, [text]);

  const handleCardClick = useCallback(
    (pineconeId: string) => {
      const meta = clipMetaCache.get(pineconeId);
      if (meta) {
        setActiveClip(meta);
        if (meta.audioUrl) {
          playTrack({
            id: meta.pineconeId,
            audioUrl: meta.audioUrl,
            startTime: meta.startTime,
            endTime: meta.endTime,
          });
        }
      }
    },
    [playTrack]
  );

  useEffect(() => {
    if (activeClip && currentTrack?.id !== activeClip.pineconeId) {
      setActiveClip(null);
    }
  }, [currentTrack, activeClip]);

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
        {statusMessages.length > 0 && (
          <div className="space-y-1">
            {statusMessages.map((s, i) => (
              <p key={i} className="text-gray-500 text-xs italic">
                {s}
              </p>
            ))}
          </div>
        )}

        {toolCalls.length > 0 && (
          <ToolCallTracker toolCalls={toolCalls} toolResults={toolResults} />
        )}

        {suggestedAction && <SuggestedActionCard action={suggestedAction} />}

        {text && (
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-5">
            <MarkdownWithClips
              text={markdown}
              clipsByIndex={clipsByIndex}
              metaCache={metaCache}
              onCardClick={handleCardClick}
            />
          </div>
        )}

        {activeClip && <NowPlayingBar meta={activeClip} />}

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

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, ShieldCheck, ShieldX, ChevronDown, Link as LinkIcon } from 'lucide-react';
import type {
  ChatMessage,
  WorkflowClip,
  WorkflowResults,
} from '../../types/workflow';
import { PodcastSearchResultItem } from '../podcast/PodcastSearchResultItem.tsx';
import {
  ChapterCard,
  DiscoveryCard,
  PersonEpisodeCard,
  StepsTimeline,
  IterationTracker,
  ResponseMetadata,
} from './WorkflowResultCards.tsx';

const CLIPS_PREVIEW_COUNT = 5;

// --- Inline pill card (matches UnifiedSidePanel's InlineCardMention) ---

const InlineClipPill: React.FC<{
  clip: WorkflowClip;
  onClick?: (pineconeId: string) => void;
}> = ({ clip, onClick }) => {
  const title = clip.miniPlayer?.episode || clip.podcast || 'Source';
  const imageUrl = clip.episodeImage;
  const pineconeId = clip.miniPlayer?.pineconeId;

  return (
    <span
      className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-gray-800 bg-gray-900/40 align-middle cursor-pointer hover:bg-gray-900/70 transition-colors max-w-[420px]"
      role="button"
      tabIndex={0}
      onClick={() => pineconeId && onClick?.(pineconeId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pineconeId && onClick?.(pineconeId);
        }
      }}
      title={title}
      aria-label={`Open source: ${title}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="w-[14px] h-[14px] rounded-sm object-cover flex-shrink-0 opacity-90"
          loading="lazy"
        />
      ) : (
        <span className="w-[14px] h-[14px] rounded-sm bg-gray-800 flex items-center justify-center flex-shrink-0">
          <LinkIcon className="w-3 h-3 text-gray-500" />
        </span>
      )}
      <span className="text-xs text-gray-200 truncate">{title}</span>
    </span>
  );
};

// --- Token parser: replaces {{clip:id}} tokens inline within text ---

const TOKEN_RE = /\{\{(clip|chapter|episode):([^}]+)\}\}/g;

function renderSummaryWithPills(
  summary: string,
  clipsByPineconeId: Map<string, WorkflowClip>,
  inlinedClipIds: Set<string>,
  onPillClick?: (pineconeId: string) => void,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;

  for (const match of summary.matchAll(TOKEN_RE)) {
    const before = summary.slice(lastIndex, match.index);
    if (before) {
      result.push(...renderTextSegment(before, keyCounter));
      keyCounter += before.split('\n\n').length;
    }

    const [, tokenType, tokenId] = match;
    if (tokenType === 'clip') {
      const clip = clipsByPineconeId.get(tokenId);
      if (clip) {
        inlinedClipIds.add(tokenId);
        result.push(
          <React.Fragment key={`pill-${keyCounter++}`}>
            {'\n'}
            <InlineClipPill clip={clip} onClick={onPillClick} />
          </React.Fragment>
        );
      }
    }

    lastIndex = match.index! + match[0].length;
  }

  const tail = summary.slice(lastIndex);
  if (tail) {
    result.push(...renderTextSegment(tail, keyCounter));
  }

  return result;
}

function renderTextSegment(text: string, startKey: number): React.ReactNode[] {
  return text.split('\n\n').map((para, j) => {
    const trimmed = para.trim();
    if (!trimmed) return null;
    return (
      <React.Fragment key={`t-${startKey + j}`}>
        {j > 0 || startKey > 0 ? '\n\n' : ''}
        {trimmed}
      </React.Fragment>
    );
  }).filter(Boolean) as React.ReactNode[];
}

function renderClipItem(clip: WorkflowClip, i: number) {
  return (
    <PodcastSearchResultItem
      key={clip.miniPlayer?.pineconeId || i}
      quote={clip.text}
      episode={clip.miniPlayer?.episode || clip.podcast}
      creator={clip.speaker}
      audioUrl={clip.miniPlayer?.audioUrl || ''}
      date={clip.date || ''}
      similarity={{ combined: clip.similarity, vector: clip.similarity }}
      timeContext={{
        start_time: clip.miniPlayer?.timestamp || 0,
        end_time: (clip.miniPlayer?.timestamp || 0) + (clip.miniPlayer?.duration || 30),
      }}
      episodeImage={clip.episodeImage}
      id={clip.miniPlayer?.pineconeId || `clip-${i}`}
      shareUrl={clip.shareUrl || ''}
      shareLink={clip.miniPlayer?.pineconeId || ''}
    />
  );
}

// --- Summary with inline pill citations ---

const SummaryWithInlineCards: React.FC<{
  summary: string;
  results: WorkflowResults;
  inlinedClipIds: Set<string>;
}> = ({ summary, results, inlinedClipIds }) => {
  const clipsByPineconeId = useMemo(() => {
    const map = new Map<string, WorkflowClip>();
    results.clips?.forEach(c => {
      if (c.miniPlayer?.pineconeId) map.set(c.miniPlayer.pineconeId, c);
    });
    return map;
  }, [results.clips]);

  const handlePillClick = (pineconeId: string) => {
    const el = document.getElementById(`clip-${pineconeId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const rendered = useMemo(
    () => renderSummaryWithPills(summary, clipsByPineconeId, inlinedClipIds, handlePillClick),
    [summary, clipsByPineconeId, inlinedClipIds]
  );

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-5">
      <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
        {rendered}
      </div>
    </div>
  );
};

// --- Clips list ---

const ClipsList: React.FC<{ clips: WorkflowClip[]; excludeIds?: Set<string> }> = ({
  clips,
  excludeIds,
}) => {
  const [expanded, setExpanded] = useState(false);
  const filtered = excludeIds ? clips.filter(c => !excludeIds.has(c.miniPlayer?.pineconeId)) : clips;
  if (!filtered.length) return null;

  const hasMore = filtered.length > CLIPS_PREVIEW_COUNT;
  const visible = expanded ? filtered : filtered.slice(0, CLIPS_PREVIEW_COUNT);

  return (
    <div>
      <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
        {excludeIds?.size ? 'More clips' : 'Clips'} ({filtered.length})
      </h3>
      <div className="space-y-3">
        {visible.map((clip, i) => (
          <div key={clip.miniPlayer?.pineconeId || i} id={`clip-${clip.miniPlayer?.pineconeId}`}>
            {renderClipItem(clip, i)}
          </div>
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 mt-3 px-3 py-2 text-xs text-gray-400 hover:text-white bg-[#111111] border border-gray-800 rounded-lg hover:border-gray-700 transition-all w-full justify-center"
        >
          <ChevronDown className="w-3 h-3" />
          Show {filtered.length - CLIPS_PREVIEW_COUNT} more clips
        </button>
      )}
    </div>
  );
};

interface WorkflowMessageProps {
  message: ChatMessage;
  onApprove?: (sessionId: string) => void;
  onDeny?: (messageId: string) => void;
}

export const WorkflowMessage: React.FC<WorkflowMessageProps> = ({
  message,
  onApprove,
  onDeny,
}) => {
  const inlinedClipIds = useMemo(() => new Set<string>(), []);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-white/10 border border-gray-700 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-white text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  // --- Assistant message ---
  const { textResponse, structuredResponse, statusMessages, iterations, approval, error, loading } =
    message;

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] w-full space-y-3">
        {/* Status / thinking messages */}
        {statusMessages.length > 0 && (
          <div className="space-y-1">
            {statusMessages.map((s, i) => (
              <p key={i} className="text-gray-500 text-xs italic">
                {s}
              </p>
            ))}
          </div>
        )}

        {/* Iteration progress */}
        {iterations.length > 0 && <IterationTracker iterations={iterations} />}

        {/* Approval card */}
        {approval && (
          <div className="bg-[#111111] border border-yellow-900/40 rounded-lg p-4">
            <p className="text-yellow-200/80 text-sm font-medium mb-1">Approval required</p>
            <p className="text-gray-400 text-xs mb-3">
              {approval.pendingAction.description}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onApprove?.(approval.sessionId)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg border border-gray-700 transition-colors"
              >
                <ShieldCheck className="w-3 h-3" />
                Approve
              </button>
              <button
                onClick={() => onDeny?.(message.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-transparent hover:bg-white/5 text-gray-400 rounded-lg border border-gray-800 transition-colors"
              >
                <ShieldX className="w-3 h-3" />
                Deny
              </button>
            </div>
          </div>
        )}

        {/* Text response (Phase 1 — markdown) */}
        {textResponse?.text && (
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-5">
            <div className="prose prose-invert prose-sm max-w-none prose-p:text-gray-300 prose-headings:text-white prose-a:text-blue-400 prose-strong:text-white prose-code:text-gray-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {textResponse.text}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Summary with inline clip/chapter/episode cards */}
        {structuredResponse?.summary && structuredResponse?.results && (
          <SummaryWithInlineCards
            summary={structuredResponse.summary}
            results={structuredResponse.results}
            inlinedClipIds={inlinedClipIds}
          />
        )}

        {/* Plain summary (no results to inline) */}
        {structuredResponse?.summary && !structuredResponse?.results && (
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-5">
            {structuredResponse.summary.split('\n\n').map((para, i) => (
              <p key={i} className={`text-gray-300 text-sm leading-relaxed ${i > 0 ? 'mt-3' : ''}`}>
                {para}
              </p>
            ))}
          </div>
        )}

        {/* Structured response (Phase 3 — remaining cards not shown inline) */}
        {structuredResponse?.results && (
          <div className="space-y-4">
            {/* Clips not already shown inline in summary */}
            {structuredResponse.results.clips?.length > 0 && (
              <ClipsList clips={structuredResponse.results.clips} excludeIds={inlinedClipIds} />
            )}

            {/* Chapters */}
            {structuredResponse.results.chapters?.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                  Chapters ({structuredResponse.results.chapters.length})
                </h3>
                <div className="space-y-2">
                  {structuredResponse.results.chapters.map((ch, i) => (
                    <ChapterCard key={i} chapter={ch} />
                  ))}
                </div>
              </div>
            )}

            {/* Discoveries */}
            {structuredResponse.results.discoveries?.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                  Discoveries ({structuredResponse.results.discoveries.length})
                </h3>
                <div className="space-y-2">
                  {structuredResponse.results.discoveries.map((d, i) => (
                    <DiscoveryCard key={i} discovery={d} />
                  ))}
                </div>
              </div>
            )}

            {/* Person Episodes */}
            {structuredResponse.results.personEpisodes?.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                  Appearances ({structuredResponse.results.personEpisodes.length})
                </h3>
                <div className="space-y-2">
                  {structuredResponse.results.personEpisodes.map((ep, i) => (
                    <PersonEpisodeCard key={i} episode={ep} />
                  ))}
                </div>
              </div>
            )}

            {/* Steps timeline */}
            {structuredResponse.steps && (
              <StepsTimeline steps={structuredResponse.steps} />
            )}

            {/* Metadata footer */}
            <ResponseMetadata
              iterationsUsed={structuredResponse.iterationsUsed}
              latencyMs={structuredResponse.latencyMs}
              cost={structuredResponse.cost}
              workflowType={structuredResponse.workflowType}
            />
          </div>
        )}

        {/* Text-mode metadata footer */}
        {textResponse && !structuredResponse && (
          <ResponseMetadata
            iterationsUsed={textResponse.iterationsUsed}
            latencyMs={textResponse.latencyMs}
            cost={textResponse.cost}
            workflowType={textResponse.workflowType}
          />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-950/30 border border-red-900/30 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400/80 flex-shrink-0" />
            <p className="text-red-300/80 text-sm">{error}</p>
          </div>
        )}

        {/* Loading spinner */}
        {loading && !iterations.length && !statusMessages.length && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 rounded-full border-b-2 border-white animate-spin" />
            <span className="text-gray-500 text-xs">Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};

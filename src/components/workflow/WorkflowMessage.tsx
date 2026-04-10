import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, ShieldCheck, Link as LinkIcon } from 'lucide-react';
import type { ChatMessage } from '../../types/workflow';
import { ToolCallTracker, ResponseMetadata } from './WorkflowResultCards.tsx';
import { FRONTEND_URL } from '../../constants/constants.ts';

// ─── Inline clip pill (lightweight — just a share link) ─────────────────────

const InlineClipPill: React.FC<{ pineconeId: string }> = ({ pineconeId }) => {
  const shareUrl = `${FRONTEND_URL}/app/share?clip=${encodeURIComponent(pineconeId)}`;
  const label = pineconeId.length > 40 ? `${pineconeId.slice(0, 18)}…${pineconeId.slice(-12)}` : pineconeId;

  return (
    <a
      href={shareUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-gray-800 bg-gray-900/40 align-middle hover:bg-gray-900/70 transition-colors max-w-[320px] no-underline"
      title={`Open clip: ${pineconeId}`}
    >
      <span className="w-[14px] h-[14px] rounded-sm bg-gray-800 flex items-center justify-center flex-shrink-0">
        <LinkIcon className="w-3 h-3 text-gray-500" />
      </span>
      <span className="text-xs text-gray-200 truncate">{label}</span>
    </a>
  );
};

// ─── Parse text with {{clip:...}} tokens into React nodes ───────────────────

const CLIP_TOKEN_RE = /\{\{clip:([^}]+)\}\}/g;

function renderTextWithClipPills(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;

  for (const match of text.matchAll(CLIP_TOKEN_RE)) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      parts.push(<React.Fragment key={`t-${keyCounter++}`}>{before}</React.Fragment>);
    }
    const pineconeId = match[1];
    parts.push(
      <React.Fragment key={`p-${keyCounter++}`}>
        {'\n'}
        <InlineClipPill pineconeId={pineconeId} />
        {'\n'}
      </React.Fragment>
    );
    lastIndex = match.index! + match[0].length;
  }

  const tail = text.slice(lastIndex);
  if (tail) {
    parts.push(<React.Fragment key={`t-${keyCounter++}`}>{tail}</React.Fragment>);
  }

  return parts.length === 1 ? parts[0] : parts;
}

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

  const hasClipTokens = text ? CLIP_TOKEN_RE.test(text) : false;
  CLIP_TOKEN_RE.lastIndex = 0;

  const renderedText = useMemo(() => {
    if (!text) return null;
    if (hasClipTokens) return renderTextWithClipPills(text);
    return null;
  }, [text, hasClipTokens]);

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

        {/* Tool call progress */}
        {toolCalls.length > 0 && (
          <ToolCallTracker toolCalls={toolCalls} toolResults={toolResults} />
        )}

        {/* Suggested action (non-blocking) */}
        {suggestedAction && <SuggestedActionCard action={suggestedAction} />}

        {/* Main text response */}
        {text && (
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-5">
            {hasClipTokens ? (
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {renderedText}
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none prose-p:text-gray-300 prose-headings:text-white prose-a:text-blue-400 prose-strong:text-white prose-code:text-gray-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Done metadata */}
        {donePayload && <ResponseMetadata done={donePayload} />}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-950/30 border border-red-900/30 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400/80 flex-shrink-0" />
            <p className="text-red-300/80 text-sm">{error}</p>
          </div>
        )}

        {/* Loading spinner */}
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

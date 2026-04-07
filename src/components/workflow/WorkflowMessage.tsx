import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, AlertCircle, ShieldCheck, ShieldX } from 'lucide-react';
import type { ChatMessage } from '../../types/workflow';
import {
  ClipCard,
  ChapterCard,
  DiscoveryCard,
  PersonEpisodeCard,
  StepsTimeline,
  IterationTracker,
  ResponseMetadata,
} from './WorkflowResultCards.tsx';

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

  const meta = textResponse || structuredResponse;

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

        {/* Structured response (Phase 3 — rich cards) */}
        {structuredResponse?.results && (
          <div className="space-y-4">
            {/* Clips */}
            {structuredResponse.results.clips?.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                  Clips ({structuredResponse.results.clips.length})
                </h3>
                <div className="space-y-2">
                  {structuredResponse.results.clips.map((clip, i) => (
                    <ClipCard key={i} clip={clip} />
                  ))}
                </div>
              </div>
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
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            <span className="text-gray-500 text-xs">Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};

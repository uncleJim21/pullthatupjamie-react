import React, { useState } from 'react';
import {
  Play,
  Pause,
  Share2,
  ChevronDown,
  ChevronUp,
  Clock,
  Mic,
  Radio,
  User,
  Calendar,
  BookOpen,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAudioController } from '../../context/AudioControllerContext.tsx';
import type {
  WorkflowClip,
  WorkflowChapter,
  WorkflowDiscovery,
  WorkflowPersonEpisode,
  WorkflowStep,
  WorkflowCost,
  WorkflowIterationEvent,
} from '../../types/workflow';

// ─── Clip Card (mini-player) ────────────────────────────────────────────────

export const ClipCard: React.FC<{ clip: WorkflowClip }> = ({ clip }) => {
  const audio = useAudioController();
  const isThisPlaying =
    audio.currentTrack?.id === clip.miniPlayer.pineconeId && audio.isPlaying;

  const handlePlay = () => {
    if (isThisPlaying) {
      audio.pause();
    } else {
      audio.playTrack({
        id: clip.miniPlayer.pineconeId,
        audioUrl: clip.miniPlayer.audioUrl,
        startTime: clip.miniPlayer.timestamp,
        endTime: clip.miniPlayer.timestamp + clip.miniPlayer.duration,
      });
    }
  };

  const handleShare = () => {
    if (clip.shareUrl) {
      navigator.clipboard.writeText(clip.shareUrl);
    }
  };

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-all">
      <div className="flex items-start gap-3">
        <button
          onClick={handlePlay}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          {isThisPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm leading-relaxed">"{clip.text}"</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3" />
              {clip.speaker}
            </span>
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3" />
              {clip.podcast}
            </span>
            {clip.date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {clip.date}
              </span>
            )}
          </div>
          {clip.similarity != null && (
            <div className="mt-2">
              <div className="w-24 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/40 rounded-full"
                  style={{ width: `${Math.round(clip.similarity * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleShare}
          className="flex-shrink-0 p-2 text-gray-500 hover:text-white transition-colors"
          title="Copy share link"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Chapter Card ───────────────────────────────────────────────────────────

export const ChapterCard: React.FC<{ chapter: WorkflowChapter }> = ({ chapter }) => {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <h4 className="text-white text-sm font-medium truncate">{chapter.headline}</h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>
              {formatTime(chapter.startTime)} – {formatTime(chapter.endTime)}
            </span>
            <span className="text-gray-600">·</span>
            <span className="truncate">{chapter.episode}</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800/50">
          <p className="text-gray-300 text-sm mt-3 leading-relaxed">{chapter.summary}</p>
          {chapter.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {chapter.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-white/5 text-gray-400 rounded-full border border-gray-800"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Discovery Card ─────────────────────────────────────────────────────────

export const DiscoveryCard: React.FC<{ discovery: WorkflowDiscovery }> = ({ discovery }) => (
  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-all">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
        <Radio className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white text-sm font-medium">{discovery.title}</h4>
        <p className="text-gray-400 text-xs mt-0.5">{discovery.author}</p>
        {discovery.description && (
          <p className="text-gray-500 text-xs mt-2 line-clamp-2">{discovery.description}</p>
        )}
        {discovery.transcriptAvailable && (
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 text-xs bg-white/5 text-gray-300 rounded-full border border-gray-800">
            <BookOpen className="w-3 h-3" />
            Transcript available
          </span>
        )}
      </div>
    </div>
  </div>
);

// ─── Person Episode Card ────────────────────────────────────────────────────

export const PersonEpisodeCard: React.FC<{ episode: WorkflowPersonEpisode }> = ({ episode }) => (
  <div className="flex items-center gap-3 bg-[#111111] border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-all">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
      <User className="w-4 h-4 text-gray-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-sm truncate">{episode.title}</p>
      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
        <span>{episode.creator}</span>
        {episode.publishedDate && (
          <>
            <span className="text-gray-600">·</span>
            <span>{episode.publishedDate}</span>
          </>
        )}
      </div>
    </div>
    {episode.matchedGuest && (
      <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-white/5 text-gray-300 rounded-full border border-gray-800">
        {episode.matchedGuest}
      </span>
    )}
  </div>
);

// ─── Steps Timeline ─────────────────────────────────────────────────────────

export const StepsTimeline: React.FC<{ steps: WorkflowStep[] }> = ({ steps }) => {
  const [expanded, setExpanded] = useState(false);

  if (!steps?.length) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <Zap className="w-3 h-3" />
        <span>How Jamie found this ({steps.length} steps)</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-2 pl-4 border-l border-gray-800 space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="text-xs text-gray-500">
              <span className="text-gray-600 mr-2">{i + 1}.</span>
              {JSON.stringify(step)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Iteration Tracker (live streaming progress) ────────────────────────────

export const IterationTracker: React.FC<{ iterations: WorkflowIterationEvent[] }> = ({
  iterations,
}) => {
  if (!iterations?.length) return null;

  return (
    <div className="space-y-1.5">
      {iterations.map((it, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {it.status === 'executing' ? (
            <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
          ) : it.status === 'complete' ? (
            <CheckCircle className="w-3 h-3 text-green-500/70" />
          ) : (
            <AlertCircle className="w-3 h-3 text-red-500/70" />
          )}
          <span className="text-gray-400">{it.step}</span>
          {it.status === 'complete' && it.resultCount != null && (
            <span className="px-1.5 py-0.5 bg-white/5 text-gray-500 rounded text-[10px]">
              {it.resultCount} results
            </span>
          )}
          {it.error && <span className="text-red-400/80">{it.error}</span>}
        </div>
      ))}
    </div>
  );
};

// ─── Cost / Metadata Footer ─────────────────────────────────────────────────

export const ResponseMetadata: React.FC<{
  iterationsUsed?: number;
  latencyMs?: number;
  cost?: WorkflowCost;
  workflowType?: string;
}> = ({ iterationsUsed, latencyMs, cost, workflowType }) => (
  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-800/50 text-[10px] text-gray-600">
    {workflowType && <span>workflow: {workflowType}</span>}
    {iterationsUsed != null && <span>{iterationsUsed} iterations</span>}
    {latencyMs != null && <span>{(latencyMs / 1000).toFixed(1)}s</span>}
    {cost && Object.keys(cost).length > 0 && <span>cost: {JSON.stringify(cost)}</span>}
  </div>
);

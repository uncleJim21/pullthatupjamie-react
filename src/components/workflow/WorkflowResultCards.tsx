import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Loader2,
  Search,
  BookOpen,
  Radio,
  User,
  List,
  FileText,
  Rss,
  AlignLeft,
  Lightbulb,
  PenLine,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import type {
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentDoneEvent,
} from '../../types/workflow';

// ─── Tool label & icon maps ─────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  search_quotes: 'Searching quotes',
  search_chapters: 'Searching chapters',
  discover_podcasts: 'Discovering podcasts',
  find_person: 'Finding person',
  get_person_episodes: 'Getting episodes',
  list_episode_chapters: 'Listing chapters',
  get_episode: 'Getting episode',
  get_feed: 'Getting feed',
  get_feed_episodes: 'Getting feed episodes',
  get_adjacent_paragraphs: 'Getting context',
  suggest_action: 'Suggesting action',
};

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] || tool.replace(/_/g, ' ');
}

const TOOL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  search_quotes: Search,
  search_chapters: BookOpen,
  discover_podcasts: Radio,
  find_person: User,
  get_person_episodes: List,
  list_episode_chapters: List,
  get_episode: FileText,
  get_feed: Rss,
  get_feed_episodes: Rss,
  get_adjacent_paragraphs: AlignLeft,
  suggest_action: Lightbulb,
};

// ─── Unified timeline step type ─────────────────────────────────────────────

interface TimelineStep {
  kind: 'status' | 'tool';
  label: string;
  icon: React.FC<{ className?: string }>;
  complete: boolean;
  detail?: string;
}

function buildTimeline(
  statusMessages: string[],
  toolCalls: AgentToolCallEvent[],
  toolResults: AgentToolResultEvent[]
): TimelineStep[] {
  const steps: TimelineStep[] = [];

  const resultMap = new Map<string, AgentToolResultEvent>();
  for (const tr of toolResults) {
    resultMap.set(`${tr.tool}-${tr.round}`, tr);
  }

  let statusIdx = 0;
  let toolIdx = 0;

  // Interleave: status messages and tool calls in the order they arrived.
  // Since we don't have timestamps, we rely on the fact that statuses
  // typically precede their corresponding tool calls.
  while (statusIdx < statusMessages.length || toolIdx < toolCalls.length) {
    // Emit status messages that came before the next tool call
    if (statusIdx < statusMessages.length && (toolIdx >= toolCalls.length || statusIdx <= toolIdx)) {
      steps.push({
        kind: 'status',
        label: statusMessages[statusIdx],
        icon: MessageSquare,
        complete: true,
      });
      statusIdx++;
      continue;
    }

    if (toolIdx < toolCalls.length) {
      const tc = toolCalls[toolIdx];
      const key = `${tc.tool}-${tc.round}`;
      const tr = resultMap.get(key);
      const Icon = TOOL_ICONS[tc.tool] || PenLine;
      // Only show a detail when the backend actually reported a numeric
      // resultCount; some tool_result payloads omit it and we don't want
      // to render "undefined results" in the timeline.
      const hasCount = tr && typeof tr.resultCount === 'number' && Number.isFinite(tr.resultCount);
      steps.push({
        kind: 'tool',
        label: toolLabel(tc.tool),
        icon: Icon,
        complete: !!tr,
        detail: hasCount ? `${tr!.resultCount} result${tr!.resultCount === 1 ? '' : 's'}` : undefined,
      });
      toolIdx++;
    }
  }

  return steps;
}

// ─── Activity Timeline (collapsible dot→line stepper) ───────────────────────

export const ActivityTimeline: React.FC<{
  statusMessages: string[];
  toolCalls: AgentToolCallEvent[];
  toolResults: AgentToolResultEvent[];
  hasText: boolean;
}> = ({ statusMessages, toolCalls, toolResults, hasText }) => {
  const steps = buildTimeline(statusMessages, toolCalls, toolResults);
  const [expanded, setExpanded] = useState(true);

  // Auto-collapse once the response text starts streaming
  useEffect(() => {
    if (hasText && steps.length > 1) setExpanded(false);
  }, [hasText, steps.length]);

  if (!steps.length) return null;

  const lastStep = steps[steps.length - 1];
  const visibleSteps = expanded ? steps : [lastStep];
  const collapsedCount = steps.length - 1;

  return (
    <div>
      {/* Expand/collapse toggle */}
      {steps.length > 1 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors mb-1.5"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span>
            {expanded ? 'Collapse' : `${collapsedCount} earlier step${collapsedCount > 1 ? 's' : ''}`}
          </span>
        </button>
      )}

      {/* Timeline */}
      <div className="relative pl-4">
        {/* Vertical connector line */}
        {visibleSteps.length > 1 && (
          <div
            className="absolute left-[5px] top-[6px] w-px bg-gray-800"
            style={{ height: `calc(100% - 12px)` }}
          />
        )}

        {visibleSteps.map((step, i) => {
          const isLast = i === visibleSteps.length - 1;
          const Icon = step.icon;

          return (
            <div key={i} className="relative flex items-start gap-2.5 pb-2 last:pb-0">
              {/* Dot */}
              <div className="absolute -left-4 top-[3px] flex items-center justify-center">
                {!step.complete && isLast ? (
                  <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                ) : step.complete && step.kind === 'tool' ? (
                  <div className="w-2 h-2 rounded-full bg-green-500/70" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                )}
              </div>

              {/* Content */}
              <Icon className="w-3 h-3 text-gray-600 flex-shrink-0 mt-[1px]" />
              <span className="text-gray-400 text-xs leading-tight">{step.label}</span>
              {step.detail && (
                <span className="px-1.5 py-0.5 bg-white/5 text-gray-500 rounded text-[10px] leading-none">
                  {step.detail}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Response Metadata Footer ───────────────────────────────────────────────

export const ResponseMetadata: React.FC<{ done: AgentDoneEvent }> = ({ done }) => (
  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-800/50 text-[10px] text-gray-600">
    {/* Model name intentionally hidden from the UI (2026-04). Restore the
        `{done.model && <span>{done.model}</span>}` line if we ever want to
        expose which model answered again. */}
    {done.rounds != null && <span>{done.rounds} rounds</span>}
    {done.latencyMs != null && <span>{(done.latencyMs / 1000).toFixed(1)}s</span>}
    {done.cost?.total != null && <span>${done.cost.total.toFixed(4)}</span>}
    {done.tokens && (
      <span>
        {done.tokens.input + done.tokens.output} tokens
      </span>
    )}
  </div>
);

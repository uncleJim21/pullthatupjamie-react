import React from 'react';
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
} from 'lucide-react';
import type {
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentDoneEvent,
} from '../../types/workflow';

// ─── Tool Call Tracker (live agent progress) ────────────────────────────────

interface ToolStep {
  tool: string;
  round: number;
  resultCount?: number;
  latencyMs?: number;
  complete: boolean;
}

function mergeToolSteps(
  calls: AgentToolCallEvent[],
  results: AgentToolResultEvent[]
): ToolStep[] {
  const steps: ToolStep[] = calls.map(tc => ({
    tool: tc.tool,
    round: tc.round,
    complete: false,
  }));

  for (const tr of results) {
    const match = steps.find(
      s => s.tool === tr.tool && s.round === tr.round && !s.complete
    );
    if (match) {
      match.complete = true;
      match.resultCount = tr.resultCount;
      match.latencyMs = tr.latencyMs;
    }
  }

  return steps;
}

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

function ToolIcon({ tool, className }: { tool: string; className?: string }) {
  const Icon = TOOL_ICONS[tool] || PenLine;
  return <Icon className={className} />;
}

export const ToolCallTracker: React.FC<{
  toolCalls: AgentToolCallEvent[];
  toolResults: AgentToolResultEvent[];
}> = ({ toolCalls, toolResults }) => {
  const steps = mergeToolSteps(toolCalls, toolResults);
  if (!steps.length) return null;

  return (
    <div className="space-y-1.5">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {step.complete ? (
            <CheckCircle className="w-3 h-3 text-green-500/70 flex-shrink-0" />
          ) : (
            <Loader2 className="w-3 h-3 text-white animate-spin flex-shrink-0" />
          )}
          <ToolIcon tool={step.tool} className="w-3 h-3 text-gray-600 flex-shrink-0" />
          <span className="text-gray-400">{toolLabel(step.tool)}</span>
          {step.complete && step.resultCount != null && (
            <span className="px-1.5 py-0.5 bg-white/5 text-gray-500 rounded text-[10px]">
              {step.resultCount} results
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Response Metadata Footer ───────────────────────────────────────────────

export const ResponseMetadata: React.FC<{ done: AgentDoneEvent }> = ({ done }) => (
  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-800/50 text-[10px] text-gray-600">
    {done.model && <span>{done.model}</span>}
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

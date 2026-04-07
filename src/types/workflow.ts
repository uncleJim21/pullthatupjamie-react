export interface WorkflowRequest {
  task: string;
  maxIterations?: number;
  outputFormat: 'streaming' | 'structured' | 'text' | 'audio';
  context?: Record<string, unknown>;
}

// --- SSE event payloads ---

export interface WorkflowStatusEvent {
  message: string;
  sessionId?: string;
  workflowType?: string;
}

export interface WorkflowIterationEvent {
  iteration: number;
  maxIterations: number;
  step: string;
  params?: Record<string, unknown>;
  resultCount?: number;
  status: 'executing' | 'complete' | 'error';
  error?: string;
}

export interface WorkflowApprovalEvent {
  sessionId: string;
  pendingAction: {
    type: string;
    description: string;
    params: Record<string, unknown>;
  };
}

export interface WorkflowErrorEvent {
  error: string;
}

// --- Structured result types ---

export interface ClipMiniPlayer {
  pineconeId: string;
  timestamp: number;
  duration: number;
  episode: string;
  speaker: string;
  audioUrl: string;
}

export interface WorkflowClip {
  text: string;
  speaker: string;
  podcast: string;
  timestamp: string;
  date: string;
  similarity: number;
  shareUrl: string;
  miniPlayer: ClipMiniPlayer;
  guid: string;
  feedId: string;
}

export interface WorkflowChapter {
  headline: string;
  keywords: string[];
  summary: string;
  startTime: number;
  endTime: number;
  episode: string;
  guid: string;
  feedId: string;
}

export interface WorkflowDiscovery {
  title: string;
  author: string;
  feedId: string;
  transcriptAvailable: boolean;
  description: string;
}

export interface WorkflowPersonEpisode {
  title: string;
  creator: string;
  publishedDate: string;
  guid: string;
  feedId: string;
  matchedGuest: string;
}

export interface WorkflowStep {
  [key: string]: unknown;
}

export interface WorkflowResults {
  clips: WorkflowClip[];
  chapters: WorkflowChapter[];
  discoveries: WorkflowDiscovery[];
  personEpisodes: WorkflowPersonEpisode[];
  sessionUrl?: string;
}

export interface WorkflowCost {
  [key: string]: unknown;
}

export interface WorkflowStructuredResponse {
  status: string;
  sessionId: string;
  iterationsUsed: number;
  workflowType: string;
  results: WorkflowResults;
  steps: WorkflowStep[];
  cost: WorkflowCost;
  latencyMs: number;
}

export interface WorkflowTextResponse {
  status: string;
  sessionId: string;
  iterationsUsed: number;
  workflowType: string;
  text: string;
  steps: WorkflowStep[];
  cost: WorkflowCost;
  latencyMs: number;
}

// --- Chat message model ---

export type WorkflowOutputMode = 'text' | 'streaming';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  textResponse?: WorkflowTextResponse;
  structuredResponse?: WorkflowStructuredResponse;
  statusMessages: string[];
  iterations: WorkflowIterationEvent[];
  approval?: WorkflowApprovalEvent;
  error?: string;
  loading: boolean;
  streamComplete: boolean;
}

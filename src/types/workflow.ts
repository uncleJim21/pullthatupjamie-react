// --- Agent endpoint request ---

export interface AgentRequest {
  message: string;
  model?: 'fast' | 'quality';
  sessionId?: string;
}

// --- SSE event payloads ---

export interface AgentStatusEvent {
  message: string;
  sessionId?: string;
}

export interface AgentToolCallEvent {
  tool: string;
  input: Record<string, unknown>;
  round: number;
}

export interface AgentToolResultEvent {
  tool: string;
  resultCount: number;
  latencyMs: number;
  round: number;
}

export interface AgentSuggestedAction {
  type: string;
  reason: string;
  episodeTitle?: string;
  guid?: string;
  feedId?: string;
}

export interface AgentTextEvent {
  text: string;
}

export interface AgentDoneEvent {
  sessionId: string;
  model: string;
  rounds: number;
  toolCalls: { name: string; resultCount: number; latencyMs: number }[];
  tokens: { input: number; output: number };
  cost: { claude: number; tools: number; total: number };
  latencyMs: number;
}

export interface AgentErrorEvent {
  error: string;
}

// --- Chat message model ---

export type AgentModel = 'fast' | 'quality';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  statusMessages: string[];
  toolCalls: AgentToolCallEvent[];
  toolResults: AgentToolResultEvent[];
  suggestedAction?: AgentSuggestedAction;
  text?: string;
  donePayload?: AgentDoneEvent;
  error?: string;
  loading: boolean;
  streamComplete: boolean;
}

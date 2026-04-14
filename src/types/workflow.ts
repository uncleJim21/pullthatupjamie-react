// --- Agent endpoint request ---

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentRequest {
  message: string;
  model?: AgentModel;
  sessionId?: string;
  history?: HistoryEntry[];
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

// --- Suggested action variants ---

export interface SubmitOnDemandAction {
  type: 'submit-on-demand';
  reason: string;
  feedId?: string;
  guid?: string;
  feedGuid?: string;
  episodeTitle?: string;
  image?: string;
  enclosureUrl?: string;
  link?: string;
}

export interface DirectQueryAction {
  type: 'direct-query';
  reason: string;
  label: string;
  endpoint: string;
  body: Record<string, unknown>;
  method?: string;
}

export interface FollowUpMessageAction {
  type: 'follow-up-message';
  reason: string;
  label: string;
  message: string;
}

export type AgentSuggestedAction =
  | SubmitOnDemandAction
  | DirectQueryAction
  | FollowUpMessageAction;

// --- Other SSE payloads ---

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
  suggestedActions: AgentSuggestedAction[];
  text?: string;
  donePayload?: AgentDoneEvent;
  error?: string;
  loading: boolean;
  streamComplete: boolean;
  /** True when text has been streaming but no new delta for ~3 seconds */
  textPaused?: boolean;
}

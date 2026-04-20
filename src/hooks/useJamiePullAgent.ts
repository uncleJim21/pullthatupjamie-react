import { useState, useCallback, useRef } from 'react';
import { API_URL, printLog } from '../constants/constants.ts';
import { getPulseHeader } from '../services/pulseService.ts';
import { QuotaExceededError, parseQuotaExceededResponse } from '../types/errors.ts';
import type { QuotaExceededData } from '../components/QuotaExceededModal.tsx';
import type {
  ChatMessage,
  AgentModel,
  AgentStatusEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentSuggestedAction,
  AgentTextEvent,
  AgentDoneEvent,
  HistoryEntry,
  FollowUpContext,
} from '../types/jamiePullAgent';

const STREAM_FLUSH_MS = 40;
const MAX_HISTORY_ENTRIES = 4;
const TEXT_PAUSE_MS = 3000;

/** Entitlement key reported to the backend — matches the /api/pull server route. */
const PULL_ENTITLEMENT = 'jamie-pull';

interface UseJamiePullAgentReturn {
  messages: ChatMessage[];
  sendMessage: (task: string, context?: FollowUpContext) => Promise<void>;
  clearMessages: () => void;
  model: AgentModel;
  setModel: (model: AgentModel) => void;
  /** Populated when the last /api/pull call returned 429 Quota Exceeded. */
  quotaExceededData: QuotaExceededData | null;
  /** Dismiss the quota state (hide the modal). */
  clearQuotaExceeded: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export const useJamiePullAgent = (): UseJamiePullAgentReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [model, setModel] = useState<AgentModel>('fast');
  const [quotaExceededData, setQuotaExceededData] = useState<QuotaExceededData | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const clearQuotaExceeded = useCallback(() => setQuotaExceededData(null), []);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const appendStatus = useCallback((id: string, status: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === id ? { ...m, statusMessages: [...m.statusMessages, status] } : m
      )
    );
  }, []);

  const appendToolCall = useCallback((id: string, tc: AgentToolCallEvent) => {
    setMessages(prev =>
      prev.map(m => (m.id === id ? { ...m, toolCalls: [...m.toolCalls, tc] } : m))
    );
  }, []);

  const appendToolResult = useCallback((id: string, tr: AgentToolResultEvent) => {
    setMessages(prev =>
      prev.map(m => (m.id === id ? { ...m, toolResults: [...m.toolResults, tr] } : m))
    );
  }, []);

  const appendSuggestedAction = useCallback((id: string, action: AgentSuggestedAction) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === id ? { ...m, suggestedActions: [...m.suggestedActions, action] } : m
      )
    );
  }, []);

  const sendMessage = useCallback(
    async (task: string, context?: FollowUpContext) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const token = getAuthToken();

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: task,
        statusMessages: [],
        toolCalls: [],
        toolResults: [],
        suggestedActions: [],
        loading: false,
        streamComplete: true,
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        statusMessages: [],
        toolCalls: [],
        toolResults: [],
        suggestedActions: [],
        loading: true,
        streamComplete: false,
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);
      const aId = assistantMsg.id;

      try {
        const reqBody: Record<string, unknown> = { message: task, model };
        if (sessionIdRef.current) reqBody.sessionId = sessionIdRef.current;
        if (historyRef.current.length > 0) {
          reqBody.history = historyRef.current.slice(-MAX_HISTORY_ENTRIES);
        }
        if (context) reqBody.context = context;

        // Include X-Free-Tier + X-Pulse-Session on every request so the
        // backend surfaces 429 (with quota metadata) rather than a 402 L402
        // challenge for anonymous webapp users. Authorization is attached
        // only when the user is signed in; otherwise the request is made
        // against the anonymous free tier.
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...getPulseHeader(),
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/pull`, {
          method: 'POST',
          headers,
          body: JSON.stringify(reqBody),
          signal: abortControllerRef.current?.signal,
        });

        // 429 Quota Exceeded — surface the structured QuotaExceededData via
        // the quota modal. Use a manual parse (rather than
        // throwIfQuotaExceeded) so we can throw *after* we've constructed
        // the QuotaExceededError, keeping this branch consistent with
        // other services while working for SSE responses.
        if (res.status === 429) {
          const data = await parseQuotaExceededResponse(res, PULL_ENTITLEMENT);
          throw new QuotaExceededError(data);
        }

        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        if (!res.body) throw new Error('Response body is null');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let currentEventType = 'message';

        let textAccum = '';
        let pauseTimer: ReturnType<typeof setTimeout> | null = null;

        const clearPauseTimer = () => {
          if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
        };

        const flushText = () => {
          if (!textAccum) return;
          const chunk = textAccum;
          textAccum = '';
          // Clear paused state when new text arrives
          setMessages(prev =>
            prev.map(m =>
              m.id === aId ? { ...m, text: (m.text || '') + chunk, textPaused: false } : m
            )
          );
        };
        const flushTimer = setInterval(flushText, STREAM_FLUSH_MS);

        const startPauseTimer = () => {
          clearPauseTimer();
          pauseTimer = setTimeout(() => {
            // After TEXT_PAUSE_MS with no new delta: mark paused + append a space
            // so the text doesn't look jammed against the edge
            setMessages(prev =>
              prev.map(m => {
                if (m.id !== aId || m.streamComplete) return m;
                const currentText = m.text || '';
                const needsSpace = currentText.length > 0 && !currentText.endsWith(' ') && !currentText.endsWith('\n');
                return {
                  ...m,
                  text: needsSpace ? currentText + ' ' : currentText,
                  textPaused: true,
                };
              })
            );
          }, TEXT_PAUSE_MS);
        };

        let finalText = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEventType = line.slice(7).trim();
                continue;
              }

              if (line.startsWith('data: ')) {
                const raw = line.slice(6).trim();
                if (!raw || raw === '[DONE]') continue;

                try {
                  const payload = JSON.parse(raw);

                  switch (currentEventType) {
                    case 'status': {
                      const ev = payload as AgentStatusEvent;
                      appendStatus(aId, ev.message);
                      break;
                    }
                    case 'tool_call': {
                      const ev = payload as AgentToolCallEvent;
                      appendToolCall(aId, ev);
                      break;
                    }
                    case 'tool_result': {
                      const ev = payload as AgentToolResultEvent;
                      appendToolResult(aId, ev);
                      break;
                    }
                    case 'suggested_action': {
                      const ev = payload as AgentSuggestedAction;
                      appendSuggestedAction(aId, ev);
                      break;
                    }
                    case 'text_delta': {
                      textAccum += payload.text || '';
                      startPauseTimer();
                      break;
                    }
                    case 'text_done':
                    case 'text': {
                      clearInterval(flushTimer);
                      clearPauseTimer();
                      const ev = payload as AgentTextEvent;
                      // If text_done carries the full text, use it;
                      // if empty (server already streamed everything via deltas), keep accumulated text
                      if (ev.text) {
                        textAccum = '';
                        finalText = ev.text;
                        updateMessage(aId, { text: ev.text, textPaused: false });
                      } else {
                        flushText();
                        setMessages(prev => {
                          const msg = prev.find(m => m.id === aId);
                          finalText = msg?.text || '';
                          return prev.map(m =>
                            m.id === aId ? { ...m, textPaused: false } : m
                          );
                        });
                      }
                      break;
                    }
                    case 'done': {
                      const ev = payload as AgentDoneEvent;
                      sessionIdRef.current = ev.sessionId;
                      updateMessage(aId, {
                        donePayload: ev,
                        loading: false,
                        streamComplete: true,
                      });
                      break;
                    }
                    case 'error': {
                      updateMessage(aId, {
                        error: payload.error || 'Unknown error',
                        loading: false,
                        streamComplete: true,
                      });
                      break;
                    }
                    default:
                      printLog(`Unknown SSE event: ${currentEventType}`);
                  }
                } catch (e) {
                  printLog(`Failed to parse SSE data: ${raw}`);
                }

                currentEventType = 'message';
              }
            }
          }
        } finally {
          clearInterval(flushTimer);
          clearPauseTimer();
          flushText();
        }

        // Append completed turn to history for multi-turn
        if (finalText) {
          historyRef.current = [
            ...historyRef.current,
            { role: 'user', content: task },
            { role: 'assistant', content: finalText },
          ].slice(-MAX_HISTORY_ENTRIES);
        }

        updateMessage(aId, { loading: false, streamComplete: true });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (err instanceof QuotaExceededError) {
          printLog(`[jamie-pull] Quota exceeded: ${JSON.stringify(err.data)}`);
          setQuotaExceededData(err.data);
          updateMessage(aId, {
            loading: false,
            error: 'You\u2019ve hit your Jamie Pull quota — upgrade or try again later.',
            streamComplete: true,
          });
          return;
        }
        updateMessage(aId, { loading: false, error: err.message || 'Stream failed' });
      }
    },
    [model, updateMessage, appendStatus, appendToolCall, appendToolResult, appendSuggestedAction]
  );

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setMessages([]);
    historyRef.current = [];
    sessionIdRef.current = undefined;
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    model,
    setModel,
    quotaExceededData,
    clearQuotaExceeded,
  };
};

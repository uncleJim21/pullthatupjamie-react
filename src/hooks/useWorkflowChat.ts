import { useState, useCallback, useRef } from 'react';
import { API_URL, printLog } from '../constants/constants.ts';
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
} from '../types/workflow';

const STREAM_FLUSH_MS = 40;
const MAX_HISTORY_ENTRIES = 4;
const TEXT_PAUSE_MS = 3000;

interface UseWorkflowChatReturn {
  messages: ChatMessage[];
  sendMessage: (task: string, context?: FollowUpContext) => Promise<void>;
  clearMessages: () => void;
  model: AgentModel;
  setModel: (model: AgentModel) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export const useWorkflowChat = (): UseWorkflowChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [model, setModel] = useState<AgentModel>('fast');
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const sessionIdRef = useRef<string | undefined>(undefined);

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

      if (!token) {
        updateMessage(aId, { loading: false, error: 'Not authenticated — sign in first.' });
        return;
      }

      try {
        const reqBody: Record<string, unknown> = { message: task, model };
        if (sessionIdRef.current) reqBody.sessionId = sessionIdRef.current;
        if (historyRef.current.length > 0) {
          reqBody.history = historyRef.current.slice(-MAX_HISTORY_ENTRIES);
        }
        if (context) reqBody.context = context;

        const res = await fetch(`${API_URL}/api/pull`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(reqBody),
          signal: abortControllerRef.current?.signal,
        });

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
  };
};

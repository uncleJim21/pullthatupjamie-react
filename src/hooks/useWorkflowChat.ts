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
} from '../types/workflow';

interface UseWorkflowChatReturn {
  messages: ChatMessage[];
  sendMessage: (task: string) => Promise<void>;
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

  const sendMessage = useCallback(
    async (task: string) => {
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
        loading: false,
        streamComplete: true,
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        statusMessages: [],
        toolCalls: [],
        toolResults: [],
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
        const res = await fetch(`${API_URL}/api/chat/workflow`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ message: task, model }),
          signal: abortControllerRef.current?.signal,
        });

        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        if (!res.body) throw new Error('Response body is null');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEventType = 'message';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

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
                    updateMessage(aId, { suggestedAction: ev });
                    break;
                  }
                  case 'text_delta': {
                    const delta = payload.text || '';
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === aId ? { ...m, text: (m.text || '') + delta } : m
                      )
                    );
                    break;
                  }
                  case 'text_done': {
                    const ev = payload as AgentTextEvent;
                    updateMessage(aId, { text: ev.text });
                    break;
                  }
                  case 'text': {
                    const ev = payload as AgentTextEvent;
                    updateMessage(aId, { text: ev.text });
                    break;
                  }
                  case 'done': {
                    const ev = payload as AgentDoneEvent;
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

        updateMessage(aId, { loading: false, streamComplete: true });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        updateMessage(aId, { loading: false, error: err.message || 'Stream failed' });
      }
    },
    [model, updateMessage, appendStatus, appendToolCall, appendToolResult]
  );

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    model,
    setModel,
  };
};

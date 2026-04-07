import { useState, useCallback, useRef } from 'react';
import { API_URL, printLog } from '../constants/constants.ts';
import type {
  ChatMessage,
  WorkflowOutputMode,
  WorkflowStatusEvent,
  WorkflowIterationEvent,
  WorkflowApprovalEvent,
  WorkflowStructuredResponse,
  WorkflowTextResponse,
} from '../types/workflow';

interface UseWorkflowChatReturn {
  messages: ChatMessage[];
  sendMessage: (task: string) => Promise<void>;
  approveAction: (sessionId: string) => Promise<void>;
  denyAction: (messageId: string) => void;
  clearMessages: () => void;
  outputMode: WorkflowOutputMode;
  setOutputMode: (mode: WorkflowOutputMode) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export const useWorkflowChat = (): UseWorkflowChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [outputMode, setOutputMode] = useState<WorkflowOutputMode>('streaming');
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

  const appendIteration = useCallback((id: string, iteration: WorkflowIterationEvent) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== id) return m;
        const existing = m.iterations.findIndex(
          i => i.iteration === iteration.iteration && i.step === iteration.step
        );
        const iterations =
          existing >= 0
            ? m.iterations.map((it, idx) => (idx === existing ? iteration : it))
            : [...m.iterations, iteration];
        return { ...m, iterations };
      })
    );
  }, []);

  // --- Phase 1: text mode (blocking JSON) ---
  const sendTextMode = useCallback(
    async (task: string, assistantId: string) => {
      const token = getAuthToken();
      if (!token) {
        updateMessage(assistantId, { loading: false, error: 'Not authenticated — sign in first.' });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/chat/workflow`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ task, maxIterations: 3, outputFormat: 'text', context: {} }),
          signal: abortControllerRef.current?.signal,
        });

        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const data: WorkflowTextResponse = await res.json();
        updateMessage(assistantId, {
          textResponse: data,
          loading: false,
          streamComplete: true,
        });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        updateMessage(assistantId, { loading: false, error: err.message || 'Request failed' });
      }
    },
    [updateMessage]
  );

  // --- Phase 2: streaming mode (SSE via ReadableStream) ---
  const sendStreamingMode = useCallback(
    async (task: string, assistantId: string) => {
      const token = getAuthToken();
      if (!token) {
        updateMessage(assistantId, { loading: false, error: 'Not authenticated — sign in first.' });
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
          body: JSON.stringify({ task, maxIterations: 3, outputFormat: 'streaming', context: {} }),
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
                    const ev = payload as WorkflowStatusEvent;
                    appendStatus(assistantId, ev.message);
                    break;
                  }
                  case 'iteration': {
                    const ev = payload as WorkflowIterationEvent;
                    appendIteration(assistantId, ev);
                    break;
                  }
                  case 'approval_required': {
                    const ev = payload as WorkflowApprovalEvent;
                    updateMessage(assistantId, { approval: ev });
                    break;
                  }
                  case 'result': {
                    const ev = payload as WorkflowStructuredResponse;
                    updateMessage(assistantId, { structuredResponse: ev });
                    break;
                  }
                  case 'error': {
                    updateMessage(assistantId, { error: payload.error || 'Unknown error' });
                    break;
                  }
                  case 'done': {
                    updateMessage(assistantId, { loading: false, streamComplete: true });
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

        updateMessage(assistantId, { loading: false, streamComplete: true });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        updateMessage(assistantId, { loading: false, error: err.message || 'Stream failed' });
      }
    },
    [updateMessage, appendStatus, appendIteration]
  );

  // --- Public API ---

  const sendMessage = useCallback(
    async (task: string) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: task,
        statusMessages: [],
        iterations: [],
        loading: false,
        streamComplete: true,
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        statusMessages: [],
        iterations: [],
        loading: true,
        streamComplete: false,
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);

      if (outputMode === 'text') {
        await sendTextMode(task, assistantMsg.id);
      } else {
        await sendStreamingMode(task, assistantMsg.id);
      }
    },
    [outputMode, sendTextMode, sendStreamingMode]
  );

  const approveAction = useCallback(
    async (sessionId: string) => {
      const token = getAuthToken();
      if (!token) return;

      const approvalMsg = messages.find(m => m.approval?.sessionId === sessionId);
      if (approvalMsg) {
        updateMessage(approvalMsg.id, { approval: undefined, loading: true });
      }

      try {
        const res = await fetch(`${API_URL}/api/chat/workflow/${sessionId}/approve`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ approved: true }),
        });

        if (!res.ok) throw new Error(`Approval failed: ${res.status}`);

        const data = await res.json();
        if (approvalMsg) {
          updateMessage(approvalMsg.id, {
            structuredResponse: data,
            loading: false,
            streamComplete: true,
          });
        }
      } catch (err: any) {
        if (approvalMsg) {
          updateMessage(approvalMsg.id, { loading: false, error: err.message });
        }
      }
    },
    [messages, updateMessage]
  );

  const denyAction = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { approval: undefined, loading: false, streamComplete: true });
    },
    [updateMessage]
  );

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    approveAction,
    denyAction,
    clearMessages,
    outputMode,
    setOutputMode,
  };
};

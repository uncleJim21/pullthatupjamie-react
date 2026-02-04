import { useCallback } from 'react';
import { 
  createResearchSession, 
  setCurrentSessionId,
  ResearchSessionItem 
} from '../services/researchSessionService.ts';
import { printLog } from '../constants/constants.ts';

interface ForkResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

interface UseResearchSessionForkOptions {
  onSessionCreated?: (sessionId: string) => void;
  onOwnershipChanged?: (isOwned: boolean) => void;
  onTitleCleared?: () => void;
}

/**
 * Custom hook for forking research sessions.
 * Used when editing a session we don't own (shared sessions).
 * 
 * @param options - Callbacks to update parent state after forking
 * @returns Object with fork utilities
 */
export function useResearchSessionFork(options: UseResearchSessionForkOptions = {}) {
  const { onSessionCreated, onOwnershipChanged, onTitleCleared } = options;

  /**
   * Fork to a new session by creating a copy with the given items.
   * Updates localStorage session ID and notifies parent via callbacks.
   */
  const forkToNewSession = useCallback(async (items: ResearchSessionItem[]): Promise<ForkResult> => {
    try {
      printLog(`[ResearchSession] Forking to new session with ${items.length} items`);
      
      const response = await createResearchSession(items);
      
      if (response.success && response.data?.id) {
        const newSessionId = response.data.id;
        
        // Update localStorage
        setCurrentSessionId(newSessionId);
        
        // Notify parent of state changes
        onSessionCreated?.(newSessionId);
        onOwnershipChanged?.(true);
        onTitleCleared?.();
        
        printLog(`[ResearchSession] Forked to new session: ${newSessionId}`);
        return { success: true, sessionId: newSessionId };
      }
      
      return { success: false, error: response.message || 'Failed to create session' };
    } catch (error: any) {
      console.error('[ResearchSession] Failed to fork session:', error);
      return { success: false, error: error?.message || 'Fork failed' };
    }
  }, [onSessionCreated, onOwnershipChanged, onTitleCleared]);

  /**
   * Check if an error indicates we don't own the session (403 Forbidden)
   */
  const isOwnershipError = useCallback((error: any): boolean => {
    return error?.message?.includes('403') || error?.status === 403;
  }, []);

  /**
   * Attempt to fork if the given error is an ownership error.
   * Returns null if error is not an ownership error.
   */
  const forkOnOwnershipError = useCallback(async (
    error: any, 
    items: ResearchSessionItem[]
  ): Promise<ForkResult | null> => {
    if (isOwnershipError(error)) {
      printLog('[ResearchSession] Ownership error detected, forking to new session');
      return forkToNewSession(items);
    }
    return null;
  }, [isOwnershipError, forkToNewSession]);

  return {
    forkToNewSession,
    isOwnershipError,
    forkOnOwnershipError,
  };
}

export type { ForkResult };

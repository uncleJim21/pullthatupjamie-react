import { useState, useCallback, useRef } from 'react';
import { MentionResult } from '../types/mention';
import { printLog, API_URL } from '../constants/constants.ts';

interface StreamingSearchState {
  results: MentionResult[];
  loading: boolean;
  completedSources: string[];
  error: string | null;
}

interface SearchOptions {
  platforms?: string[];
  includePersonalPins?: boolean;
  includeCrossPlatformMappings?: boolean;
  limit?: number;
}

interface StreamEvent {
  type: 'partial' | 'complete' | 'error';
  source?: string;
  results?: MentionResult[];
  meta?: {
    completedSources: string[];
  };
  completedSources?: string[];
  error?: string;
}

export const useStreamingMentionSearch = () => {
  const [state, setState] = useState<StreamingSearchState>({
    results: [],
    loading: false,
    completedSources: [],
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const getAuthToken = () => {
    return localStorage.getItem('auth_token');
  };

  const getResultIdentifier = (result: MentionResult): string => {
    return result.platform === 'twitter' ? result.username : result.npub;
  };

  const handleStreamEvent = useCallback((data: StreamEvent) => {
    setState(prevState => {
      switch (data.type) {
        case 'partial':
          printLog(`Streaming search partial results from ${data.source}: ${data.results?.length || 0} results`);
          
          let updatedResults = [...prevState.results];
          
          if (data.results) {
            if (data.source === 'pins') {
              // For pins, just append (they come first and fast)
              updatedResults = [...updatedResults, ...data.results];
            } else if (data.source === 'twitter') {
              // For Twitter, merge with existing results, updating any existing entries
              data.results.forEach(newResult => {
                const existingIndex = updatedResults.findIndex(r => 
                  r.platform === newResult.platform && 
                  getResultIdentifier(r).toLowerCase() === getResultIdentifier(newResult).toLowerCase()
                );
                
                if (existingIndex >= 0) {
                  // Update existing result with new data, preserving important fields
                  const existingResult = updatedResults[existingIndex];
                  updatedResults[existingIndex] = {
                    ...newResult,
                    // Preserve personal pin status if it exists
                    isPersonalPin: existingResult.isPersonalPin || newResult.isPersonalPin,
                    personalPin: existingResult.personalPin || newResult.personalPin
                  };
                } else {
                  // Add new result
                  updatedResults.push(newResult);
                }
              });
            } else {
              // For other sources (mappings, etc.), just append
              updatedResults = [...updatedResults, ...data.results];
            }
          }
          
          return {
            ...prevState,
            results: updatedResults,
            completedSources: data.meta?.completedSources || prevState.completedSources
          };
          
        case 'complete':
          printLog(`Streaming search completed: ${data.completedSources?.join(', ') || 'unknown sources'}`);
          return {
            ...prevState,
            loading: false,
            completedSources: data.completedSources || prevState.completedSources
          };
          
        case 'error':
          console.error(`Search error from ${data.source}:`, data.error);
          return {
            ...prevState,
            completedSources: data.completedSources || prevState.completedSources,
            error: data.error || 'Search error occurred'
          };
          
        default:
          return prevState;
      }
    });
  }, []);

  const streamSearch = useCallback(async (query: string, options: SearchOptions = {}) => {
    // Cancel any existing search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState({
      results: [],
      loading: true,
      completedSources: [],
      error: null
    });

    const token = getAuthToken();
    
    if (!token) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Authentication required for mention search'
      }));
      return;
    }

    try {
      printLog(`Starting streaming search for: "${query}"`);
      
      const searchParams = {
        query: query.trim(),
        platforms: options.platforms || ['twitter', 'nostr'],
        includePersonalPins: options.includePersonalPins ?? true,
        includeCrossPlatformMappings: options.includeCrossPlatformMappings ?? true,
        limit: options.limit || 10
      };

      const response = await fetch(`${API_URL}/api/mentions/search/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(searchParams),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = line.slice(6).trim();
              if (jsonData && jsonData !== '[DONE]') {
                const data = JSON.parse(jsonData);
                handleStreamEvent(data);
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line, e);
            }
          } else if (line.startsWith('event: ')) {
            // Handle event type if needed
            continue;
          } else if (line.trim() === '') {
            // Empty line, continue
            continue;
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        printLog('Search aborted');
        return;
      }
      
      console.error('Streaming search error:', err);
      
      // Try fallback to regular search endpoint if streaming fails
      try {
        printLog('Attempting fallback to regular search endpoint...');
        
        const searchParams = {
          query: query.trim(),
          platforms: options.platforms || ['twitter', 'nostr'],
          includePersonalPins: options.includePersonalPins ?? true,
          includeCrossPlatformMappings: options.includeCrossPlatformMappings ?? true,
          limit: options.limit || 10
        };

        const fallbackResponse = await fetch(`${API_URL}/api/mentions/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(searchParams)
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          printLog(`Fallback search successful: ${JSON.stringify(fallbackData)}`);
          
          setState(prev => ({
            ...prev,
            results: fallbackData.results || [],
            loading: false,
            completedSources: ['fallback'],
            error: null
          }));
          return;
        }
      } catch (fallbackError: any) {
        printLog(`Fallback search also failed: ${fallbackError.message || fallbackError}`);
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Search request failed'
      }));
    }
  }, [handleStreamEvent]);

  const clearSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState({
      results: [],
      loading: false,
      completedSources: [],
      error: null
    });
  }, []);

  const updateResults = useCallback((updatedResults: MentionResult[]) => {
    setState(prev => ({
      ...prev,
      results: updatedResults
    }));
  }, []);

  return {
    results: state.results,
    loading: state.loading,
    completedSources: state.completedSources,
    error: state.error,
    streamSearch,
    clearSearch,
    updateResults
  };
}; 
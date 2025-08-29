import { useState, useCallback, useRef } from 'react';
import { MentionResult } from '../types/mention';
import { printLog, API_URL } from '../constants/constants.ts';

interface StreamingSearchState {
  results: MentionResult[];
  loading: boolean;
  completedSources: string[];
  error: string | null;
  warnings: {[source: string]: string};
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
    error: null,
    warnings: {}
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentSearchParamsRef = useRef<SearchOptions | null>(null);

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
          
          const partialCompletedSources = data.meta?.completedSources || prevState.completedSources;
          
          // Check if all expected sources are now complete
          // Expected sources: Only the ones that have actually been attempted (are in completedSources)
          // Plus: pins, mappings (always expected)
          const partialExpectedSources = ['mappings', 'pins'];
          
          // Add any platform sources that have already completed
          partialCompletedSources.forEach(source => {
            if (!partialExpectedSources.includes(source)) {
              partialExpectedSources.push(source);
            }
          });
          
          const partialAllSourcesComplete = partialExpectedSources.every(source => 
            partialCompletedSources.includes(source)
          );
          
          printLog(`DEBUG Partial completion check:`);
          printLog(`- Source: ${data.source}`);
          printLog(`- Expected sources: [${partialExpectedSources.join(', ')}]`);
          printLog(`- Completed sources: [${partialCompletedSources.join(', ')}]`);
          printLog(`- All sources complete: ${partialAllSourcesComplete}`);
          
          return {
            ...prevState,
            results: updatedResults,
            completedSources: partialCompletedSources,
            loading: partialAllSourcesComplete ? false : prevState.loading
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
          
          // Create user-friendly error message
          let friendlyError = data.error || 'Search error occurred';
          if (data.error?.includes('429')) {
            friendlyError = `${data.source === 'twitter' ? 'Twitter' : data.source} rate limit reached. Showing local results only.`;
          }
          
          // Add warning for this source but don't fail the entire search
          const newWarnings = {
            ...prevState.warnings,
            [data.source || 'unknown']: friendlyError
          };
          
          const errorCompletedSources = data.completedSources || prevState.completedSources;
          
          // Check if all expected sources are now complete (including this error)
          // Expected sources: Only the ones that have actually been attempted (are in completedSources)
          // Plus: pins, mappings (always expected)
          const errorExpectedSources = ['mappings', 'pins'];
          
          // Add any platform sources that have already completed or are completing now
          errorCompletedSources.forEach(source => {
            if (!errorExpectedSources.includes(source)) {
              errorExpectedSources.push(source);
            }
          });
          
          const errorAllSourcesComplete = errorExpectedSources.every(source => 
            errorCompletedSources.includes(source)
          );
          
          printLog(`DEBUG Error completion check:`);
          printLog(`- Source: ${data.source}`);
          printLog(`- Expected sources: [${errorExpectedSources.join(', ')}]`);
          printLog(`- Completed sources: [${errorCompletedSources.join(', ')}]`);
          printLog(`- Dynamic expected sources based on completed sources`);
          printLog(`- All sources complete: ${errorAllSourcesComplete}`);
          
          // Debug each source check
          errorExpectedSources.forEach(source => {
            const isComplete = errorCompletedSources.includes(source);
            printLog(`- ${source}: ${isComplete ? '✅' : '❌'} ${isComplete ? 'complete' : 'missing'}`);
          });
          
          console.log(`Error from ${data.source}. Completed sources: [${errorCompletedSources.join(', ')}]. All complete: ${errorAllSourcesComplete}`);
          
          return {
            ...prevState,
            completedSources: errorCompletedSources,
            warnings: newWarnings,
            loading: errorAllSourcesComplete ? false : prevState.loading
            // Note: NOT setting error here - that would stop the whole search
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
    
    // Store search parameters for completion checking
    currentSearchParamsRef.current = options;

    setState({
      results: [],
      loading: true,
      completedSources: [],
      error: null,
      warnings: {}
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
      error: null,
      warnings: {}
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
    updateResults,
    warnings: state.warnings
  };
}; 
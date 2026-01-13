import { API_URL, printLog } from "../constants/constants.ts";

export interface AnalysisRequest {
  instructions: string;
  pineconeIds?: string[];
}

export interface AnalysisResponse {
  success: boolean;
  analysis?: string;
  message?: string;
  error?: string;
}

/**
 * Build authorization headers
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Get or retrieve client ID for anonymous users
 */
function getClientId(): string | null {
  return localStorage.getItem('research_client_id');
}

/**
 * Analyze a research session with streaming response
 * @param sessionId - The research session ID
 * @param instructions - Analysis instructions for the AI
 * @param onChunk - Callback for each streamed chunk of text
 * @returns Promise that resolves when stream is complete
 */
export async function analyzeResearchSession(
  sessionId: string,
  instructions: string,
  onChunk: (chunk: string) => void
): Promise<AnalysisResponse> {
  try {
    const token = localStorage.getItem('auth_token');
    const clientId = token ? undefined : getClientId();
    
    // Build URL with clientId if not authenticated
    let url = `${API_URL}/api/research-sessions/${sessionId}/analyze`;
    if (clientId) {
      url += `?clientId=${encodeURIComponent(clientId)}`;
    }

    printLog(`[AI Analysis] Request: sessionId=${sessionId} url=${url} instructionsLen=${instructions.length} authed=${Boolean(token)}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ instructions })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    // Handle streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    let fullText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk(chunk);
    }
    
    return {
      success: true,
      analysis: fullText
    };
  } catch (error) {
    console.error('Analyze research session error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

/**
 * Analyze an ad-hoc set of pineconeIds (no research session required) with streaming response
 * @param pineconeIds - Ordered list of pinecone IDs to analyze
 * @param instructions - Analysis instructions for the AI
 * @param onChunk - Callback for each streamed chunk of text
 * @returns Promise that resolves when stream is complete
 */
export async function analyzeAdHocResearch(
  pineconeIds: string[],
  instructions: string,
  onChunk: (chunk: string) => void
): Promise<AnalysisResponse> {
  try {
    const token = localStorage.getItem('auth_token');
    const clientId = token ? undefined : getClientId();

    let url = `${API_URL}/api/research/analyze`;
    if (clientId) {
      url += `?clientId=${encodeURIComponent(clientId)}`;
    }

    printLog(
      `[AI Analysis] Request (ad-hoc): pineconeIds=${pineconeIds.length} url=${url} instructionsLen=${instructions.length} authed=${Boolean(token)}`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ instructions, pineconeIds })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk(chunk);
    }

    return {
      success: true,
      analysis: fullText
    };
  } catch (error) {
    console.error('Analyze ad-hoc research error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

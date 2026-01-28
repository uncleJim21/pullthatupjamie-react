import { API_URL, AuthConfig, printLog, ShareModalContext } from "../constants/constants.ts";
import { throwIfQuotaExceeded } from "../types/errors.ts";

/**
 * Build authorization headers using JWT Bearer token
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Custom error class to include HTTP status (kept for backward compatibility)
export class JamieAssistError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'JamieAssistError';
  }
}

export const generateAssistContent = async (
  lookupHash: string,
  additionalPrefs: string = "",
  auth: AuthConfig,  // Kept for backward compatibility, but auth now uses JWT from localStorage
  onContentUpdate: (content: string) => void,
  context: ShareModalContext = ShareModalContext.OTHER,
  videoMetadata?: {
    description?: string;
    customUrl?: string;
  }
): Promise<string> => {
  try {
    // Validate lookupHash
    if (!lookupHash || typeof lookupHash !== 'string') {
      throw new Error(`Invalid lookupHash: ${lookupHash}`);
    }
    
    // Check for "undefined-X" pattern which indicates an error
    if (lookupHash.startsWith('undefined-')) {
      throw new Error(`Invalid lookupHash format: ${lookupHash}`);
    }
    
    printLog(`Generating assist content for clip: ${lookupHash}`);
    
    const headers = getAuthHeaders();

    const response = await fetch(`${API_URL}/api/jamie-assist/${lookupHash}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        additionalPrefs,
        context,
        videoMetadata 
      })
    });

    // Check for quota exceeded (429) - throws QuotaExceededError with structured data
    await throwIfQuotaExceeded(response, 'jamie-assist');

    if (!response.ok) {
      // Handle other error status codes
      if (response.status === 401 || response.status === 403) {
        printLog(`Jamie Assist authentication error (${response.status})`);
        throw new JamieAssistError('Authentication failed. Please sign in again.', response.status);
      } else {
        printLog(`Jamie Assist HTTP error (${response.status})`);
        throw new JamieAssistError(`Service error: ${response.statusText}`, response.status);
      }
    }

    // Handle the streaming response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let result = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return result;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              result += parsed.content;
              // Update UI with the latest content
              onContentUpdate(result);
            }
          } catch (e) {
            // Handle parsing errors
            console.error('Error parsing Jamie Assist response:', e);
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('Jamie Assist error:', error);
    throw error;
  }
}; 
import { API_URL, AuthConfig, RequestAuthMethod, printLog } from "../constants/constants.ts";

// Custom error class to include HTTP status
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
  auth: AuthConfig,
  onContentUpdate: (content: string) => void
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
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add Authorization header based on auth type
    if (auth.type === RequestAuthMethod.LIGHTNING && auth.credentials) {
      const { preimage, paymentHash } = auth.credentials;
      headers.Authorization = `${preimage}:${paymentHash}`;
    } else if (auth.type === RequestAuthMethod.SQUARE && auth.credentials) {
      const { username } = auth.credentials;
      headers.Authorization = `Basic ${btoa(`${username}:`)}`;
    } else if (auth.type === RequestAuthMethod.ADMIN) {
      // Handle admin authentication - use Basic auth with username
      const username = localStorage.getItem('squareId');
      if (username) {
        headers.Authorization = `Basic ${btoa(`${username}:`)}`;
      }
    }

    const response = await fetch(`${API_URL}/api/jamie-assist/${lookupHash}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ additionalPrefs })
    });

    if (!response.ok) {
      // Handle different error status codes
      if (response.status === 429) {
        printLog('Jamie Assist rate limit exceeded (429)');
        throw new JamieAssistError('Rate limit exceeded. Please upgrade your account.', 429);
      } else if (response.status === 401 || response.status === 403) {
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
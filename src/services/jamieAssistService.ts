import { API_URL, AuthConfig, RequestAuthMethod, printLog } from "../constants/constants.ts";

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
    }

    const response = await fetch(`${API_URL}/api/jamie-assist/${lookupHash}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ additionalPrefs })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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
import { printLog, API_URL } from '../constants/constants.ts';

// Define type for Nostr window extension
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: any) => Promise<any>;
      nip04?: {
        encrypt?: (pubkey: string, plaintext: string) => Promise<string>;
        decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
      };
    };
  }
}

// Platform state interface
export interface PlatformState {
  enabled: boolean;
  available: boolean;
  authenticated: boolean;
  username?: string;
  error?: string;
}

// Twitter OAuth response interface
interface TwitterOAuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  requiresReauth?: boolean;
  username?: string;
}

// Platform integration service
export class PlatformIntegrationService {
  /**
   * Check if Nostr extension is available (copied from SocialShareModal)
   */
  static async checkNostrExtension(): Promise<PlatformState> {
    try {
      if (window.nostr) {
        return {
          enabled: false,
          available: true,
          authenticated: false,
          username: undefined
        };
      } else {
        return {
          enabled: false,
          available: false,
          authenticated: false,
          username: undefined
        };
      }
    } catch (error) {
      printLog('Error checking for Nostr extension:', error);
      return {
        enabled: false,
        available: false,
        authenticated: false,
        username: undefined,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Connect to Nostr extension (copied from SocialShareModal)
   */
  static async connectNostrExtension(): Promise<PlatformState> {
    try {
      if (window.nostr) {
        const pubKey = await window.nostr.getPublicKey();
        printLog(`Nostr extension connected with public key: ${pubKey}`);
        return {
          enabled: true,
          available: true,
          authenticated: true,
          username: pubKey ? `${pubKey.substring(0, 16)}...` : undefined
        };
      } else {
        return {
          enabled: false,
          available: false,
          authenticated: false,
          username: undefined,
          error: 'Nostr extension not available'
        };
      }
    } catch (error) {
      printLog("Failed to connect to Nostr extension");
      return {
        enabled: false,
        available: true,
        authenticated: false,
        username: undefined,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Check Twitter OAuth status (copied from SocialShareModal)
   */
  static async checkTwitterAuth(): Promise<PlatformState> {
    printLog('Checking Twitter auth status in PlatformIntegrationService...');
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        printLog('No auth token found for Twitter auth check');
        return {
          enabled: false,
          available: true,
          authenticated: false,
          username: undefined,
          error: 'No auth token found'
        };
      }

      const response = await fetch(`${API_URL}/api/twitter/tokens`, {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      if (response.ok) {
        const data = await response.json();
        printLog(`Twitter auth check response: ${JSON.stringify(data)}`);
        
        return {
          enabled: true,
          available: true,
          authenticated: data.authenticated === true,
          username: data.authenticated ? data.twitterUsername : undefined
        };
      } else {
        printLog(`Twitter auth check failed with status ${response.status}`);
        return {
          enabled: false,
          available: true,
          authenticated: false,
          username: undefined,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      printLog(`Error checking Twitter auth: ${error}`);
      return {
        enabled: false,
        available: true,
        authenticated: false,
        username: undefined,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Initiate Twitter OAuth connection
   */
  static async connectTwitter(): Promise<{ success: boolean; error?: string; redirectUrl?: string }> {
    try {
      const response = await fetch('/api/social/twitter/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.redirectUrl) {
        // Open Twitter OAuth in new window
        window.open(data.redirectUrl, 'twitter-oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');
        return { success: true, redirectUrl: data.redirectUrl };
      } else {
        return { success: false, error: data.error || 'Failed to initiate OAuth' };
      }
    } catch (error) {
      printLog('Twitter connect failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Disconnect Twitter OAuth
   */
  static async disconnectTwitter(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/social/twitter/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return { success: data.success, error: data.error };
    } catch (error) {
      printLog('Twitter disconnect failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Disconnect failed' 
      };
    }
  }

  /**
   * Get combined platform status
   */
  static async getPlatformStatus(): Promise<{
    twitter: PlatformState;
    nostr: PlatformState;
  }> {
    const [twitter, nostr] = await Promise.all([
      this.checkTwitterAuth(),
      this.checkNostrExtension()
    ]);

    return { twitter, nostr };
  }
}

export default PlatformIntegrationService;

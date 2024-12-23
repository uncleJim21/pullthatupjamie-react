// services/jamieAuth.ts
import { RequestAuthMethod } from '@/lib/searxng';

interface RegistrationResult {
  success: boolean;
  message: string;
  email?: string;
}

class JamieAuthService {
  private static readonly JAMIE_API_URL = process.env.NEXT_PUBLIC_API_URL;
  private static readonly TOKEN_KEY = 'auth_token';

  static getStoredToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setStoredToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static async registerSubscription(email: string): Promise<RegistrationResult> {
    const token = this.getStoredToken();
    
    if (!token) {
      return {
        success: false,
        message: 'No auth token found'
      };
    }

    try {
      const response = await fetch(`${this.JAMIE_API_URL}/register-sub`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, token })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to register subscription');
      }

      const data = await response.json();
      return {
        success: true,
        message: 'Subscription registered successfully',
        email: data.email
      };
    } catch (error) {
      console.error('Failed to register subscription:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export default JamieAuthService;
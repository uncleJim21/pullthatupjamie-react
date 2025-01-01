// services/authService.ts
interface SignInResponse {
    token: string;
    subscriptionValid: boolean;
    message: string;
  }
  
  class AuthService {
    private static readonly AUTH_SERVER_URL = 'https://cascdr-auth-backend-cw4nk.ondigitalocean.app';
  
    static async signIn(email: string, password: string): Promise<SignInResponse> {
      try {
        const response = await fetch(`${this.AUTH_SERVER_URL}/signin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });
  
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Sign in failed');
        }
  
        const data = await response.json();
        return {
          token: data.token,
          subscriptionValid: data.subscriptionValid,
          message: data.message
        };
      } catch (error) {
        console.error('Sign in error:', error);
        throw error;
      }
    }

    static async signUp(email: string, password: string): Promise<SignInResponse> {
        try {
          const response = await fetch(`${this.AUTH_SERVER_URL}/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
    
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Sign up failed');
          }
    
          const data = await response.json();
          return {
            token: data.token,
            subscriptionValid: data.subscriptionValid,
            message: data.message
          };
        } catch (error) {
          console.error('Sign up error:', error);
          throw error;
        }
      }
  }
  
  export default AuthService;
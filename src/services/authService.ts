// services/authService.ts
import { API_URL, AUTH_URL, printLog } from "../constants/constants.ts";

// Auth provider types for the new provider-agnostic system
export type AuthProvider = 'email' | 'nostr' | 'twitter';

interface SignInResponse {
    token: string;
    subscriptionValid: boolean;
    subscriptionType: 'subscriber' | 'admin' | null;
    message: string;
}

interface Privileges {
    feedId: string;
    feedUrl: string;
    access: 'admin' | 'user' | 'viewer'; // Adjust as needed
}

interface CheckPrivsResponse {
    privs: Privileges;
}

interface TwitterStatusResponse {
    authenticated: boolean;
    twitterUsername?: string;
}

class AuthService {
    private static readonly ADMIN_PRIVS_KEY = 'admin_privs';

    /**
     * Email sign-in using the new provider-based auth system
     */
    static async signIn(email: string, password: string): Promise<SignInResponse> {
        try {
            const response = await fetch(`${AUTH_URL}/auth/signin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: 'email',
                    credentials: { email, password }
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Sign in failed');
            }

            const data = await response.json();
            return {
                token: data.token,
                subscriptionValid: data.subscriptionValid,
                subscriptionType: data.subscriptionType || null,
                message: data.message
            };
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    /**
     * Email sign-up using the new provider-based auth system
     */
    static async signUp(email: string, password: string): Promise<SignInResponse> {
        try {
            const response = await fetch(`${AUTH_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: 'email',
                    credentials: { email, password }
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Sign up failed');
            }

            const data = await response.json();
            return {
                token: data.token,
                subscriptionValid: data.subscriptionValid,
                subscriptionType: data.subscriptionType || null,
                message: data.message
            };
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    }

    static async checkPrivs(token: string) {
        try {
            const response = await fetch(`${API_URL}/api/validate-privs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify({ token }),
                credentials: 'include',
                mode: 'cors'
            });

            if (!response.ok) {
                const error = await response.json();
                // Clear admin privs on error
                localStorage.removeItem(this.ADMIN_PRIVS_KEY);
                throw new Error(error.message || 'Sign up failed');
            }

            const privs = await response.json() as CheckPrivsResponse;
            
            // Store admin status in local storage
            if (privs.privs && privs.privs.access === 'admin') {
                localStorage.setItem(this.ADMIN_PRIVS_KEY, 'true');
            } else {
                localStorage.removeItem(this.ADMIN_PRIVS_KEY);
            }
            
            return {
                privs
            };
        } catch (error) {
            console.error('Sign up error:', error);
            // Clear admin privs on error
            localStorage.removeItem(this.ADMIN_PRIVS_KEY);
            throw error;
        }
    }

    static isAdmin(): boolean {
        return localStorage.getItem(this.ADMIN_PRIVS_KEY) === 'true';
    }

    static async checkTwitterStatus(): Promise<TwitterStatusResponse> {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                throw new Error('No auth token found');
            }

            printLog(`Checking Twitter status at ${API_URL}/api/twitter/tokens`);
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

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Failed to check Twitter status: ${response.status}`);
            }

            const data = await response.json();
            printLog(`Twitter status response: ${JSON.stringify(data)}`);
            return data;
        } catch (error) {
            printLog(`Twitter status check error: ${error}`);
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                throw new Error(`Could not connect to server at ${API_URL}. Please ensure the server is running and CORS is enabled.`);
            }
            throw error;
        }
    }

    static async startTwitterAuth(): Promise<string> {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                throw new Error('No auth token found');
            }

            printLog(`Starting Twitter auth at ${API_URL}/api/twitter/x-oauth`);
            const response = await fetch(`${API_URL}/api/twitter/x-oauth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify({ token }),
                credentials: 'include',
                mode: 'cors'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Failed to start Twitter auth: ${response.status}`);
            }

            const data = await response.json();
            printLog(`Twitter auth response: ${JSON.stringify(data)}`);
            return data.authUrl;
        } catch (error) {
            printLog(`Twitter auth error: ${error}`);
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                throw new Error(`Could not connect to server at ${API_URL}. Please ensure the server is running and CORS is enabled.`);
            }
            throw error;
        }
    }
}

export default AuthService;
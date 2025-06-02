// services/authService.ts
import { API_URL, printLog } from "../constants/constants.ts";
interface SignInResponse {
    token: string;
    subscriptionValid: boolean;
    message: string;
}

interface Privileges {
    feedId: string;
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
                throw new Error(error.message || 'Sign up failed');
            }

            const privs = await response.json() as CheckPrivsResponse;
            return {
                privs
            };
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
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
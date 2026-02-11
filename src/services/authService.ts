// services/authService.ts
import { API_URL, AUTH_URL, printLog } from "../constants/constants.ts";
import type { SignedNostrEvent } from "../types/nostr.ts";

// Auth provider types for the new provider-agnostic system
export type AuthProvider = 'email' | 'nostr' | 'twitter';

interface SignInResponse {
    token: string;
    subscriptionValid: boolean;
    subscriptionType: 'subscriber' | 'admin' | null;
    message: string;
}

interface NostrChallengeResponse {
    challenge: string;
    pubkey: string;
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

interface TwitterExchangeResponse {
    token: string;
    isNewUser: boolean;
    user: {
        twitterUsername?: string;
        twitterId?: string;
        subscriptionValid?: boolean;
        subscriptionType?: 'subscriber' | 'admin' | null;
    };
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

    /**
     * Request a Nostr authentication challenge from the server
     * @param pubkey - hex pubkey from the NIP-07 extension
     */
    static async getNostrChallenge(pubkey: string): Promise<NostrChallengeResponse> {
        try {
            // Convert hex pubkey to npub format for the backend
            const npub = this.hexToNpub(pubkey);
            printLog(`Requesting Nostr challenge for npub: ${npub.substring(0, 15)}...`);
            
            const response = await fetch(`${AUTH_URL}/auth/nostr/challenge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ npub }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || error.error || 'Failed to get Nostr challenge');
            }

            const data = await response.json();
            return {
                challenge: data.challenge,
                pubkey: pubkey // Return the original hex pubkey
            };
        } catch (error) {
            console.error('Nostr challenge error:', error);
            throw error;
        }
    }

    /**
     * Convert hex pubkey to npub (bech32) format
     * Uses nostr-tools for proper encoding
     */
    static hexToNpub(hexPubkey: string): string {
        // Import nip19 for bech32 encoding
        // We need to do this dynamically since nostr-tools uses ES modules
        try {
            const { nip19 } = require('nostr-tools');
            return nip19.npubEncode(hexPubkey);
        } catch (e) {
            // Fallback: if nostr-tools isn't available, just prefix with npub
            // This won't be valid bech32 but indicates the format expected
            console.warn('nostr-tools not available for npub encoding, sending hex with npub prefix');
            return `npub_hex_${hexPubkey}`;
        }
    }

    /**
     * Convert npub (bech32) to hex pubkey
     */
    static npubToHex(npub: string): string {
        try {
            const { nip19 } = require('nostr-tools');
            const decoded = nip19.decode(npub);
            if (decoded.type === 'npub') {
                return decoded.data as string;
            }
            throw new Error('Invalid npub format');
        } catch (e) {
            console.warn('Failed to decode npub:', e);
            throw new Error('Invalid npub format');
        }
    }

    /**
     * Verify a signed Nostr event and get JWT token
     * @param signedEvent - The signed event from the NIP-07 extension
     * @param npub - The npub (bech32) format of the user's public key
     */
    static async verifyNostrSignature(signedEvent: SignedNostrEvent, npub: string): Promise<SignInResponse> {
        try {
            printLog(`Verifying Nostr signature for npub: ${npub.substring(0, 15)}...`);
            const response = await fetch(`${AUTH_URL}/auth/nostr/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ npub, signedEvent }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || error.error || 'Failed to verify Nostr signature');
            }

            const data = await response.json();
            return {
                token: data.token,
                subscriptionValid: data.subscriptionValid,
                subscriptionType: data.subscriptionType || null,
                message: data.message
            };
        } catch (error) {
            console.error('Nostr verify error:', error);
            throw error;
        }
    }

    /**
     * Full Nostr NIP-07 authentication flow
     * Uses the browser extension to sign a challenge from the server
     */
    static async signInWithNostr(): Promise<SignInResponse> {
        if (!window.nostr) {
            throw new Error('No Nostr extension found. Please install a NIP-07 compatible extension like nos2x, Alby, or Flamingo.');
        }

        try {
            // Step 1: Get public key from extension (hex format)
            printLog('Getting public key from Nostr extension...');
            const hexPubkey = await window.nostr.getPublicKey();
            printLog(`Got hex pubkey: ${hexPubkey.substring(0, 8)}...`);

            // Step 2: Convert to npub format for backend
            const npub = this.hexToNpub(hexPubkey);
            printLog(`Converted to npub: ${npub.substring(0, 15)}...`);

            // Step 3: Request challenge from server
            const challengeResponse = await this.getNostrChallenge(hexPubkey);
            printLog(`Got challenge: ${challengeResponse.challenge.substring(0, 20)}...`);

            // Step 4: Create event to sign (kind 22242 for authentication)
            const eventToSign = {
                kind: 22242,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['challenge', challengeResponse.challenge],
                    ['relay', 'wss://relay.damus.io'] // Optional relay hint
                ],
                content: `Signing in to Jamie with challenge: ${challengeResponse.challenge}`
            };

            // Step 5: Sign with extension
            printLog('Requesting signature from Nostr extension...');
            const signedEvent = await window.nostr.signEvent(eventToSign);
            printLog(`Got signed event with id: ${signedEvent.id.substring(0, 8)}...`);

            // Step 6: Verify signature and get JWT (send both npub and signedEvent)
            const authResponse = await this.verifyNostrSignature(signedEvent, npub);
            printLog('Nostr authentication successful!');

            return authResponse;
        } catch (error) {
            console.error('Nostr sign in error:', error);
            if (error instanceof Error && error.message.includes('User rejected')) {
                throw new Error('Signature request was rejected. Please approve the signature to sign in.');
            }
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

    /**
     * Initiate Twitter OAuth by redirecting to the backend's auth-initiate endpoint
     * This kicks off the OAuth flow - user will be redirected to Twitter
     */
    static initiateTwitterOAuth(): void {
        const frontendUrl = window.location.origin;
        const redirectUri = encodeURIComponent(`${frontendUrl}/auth/twitter/complete`);
        const authUrl = `${API_URL}/api/twitter/auth-initiate?redirect_uri=${redirectUri}`;
        
        printLog(`Initiating Twitter OAuth, redirecting to: ${authUrl}`);
        window.location.href = authUrl;
    }

    /**
     * Exchange a temporary Twitter auth code for a JWT token
     * Called on the callback page after Twitter redirects back
     */
    static async exchangeTwitterCode(code: string): Promise<TwitterExchangeResponse> {
        try {
            printLog(`Exchanging Twitter code at ${AUTH_URL}/auth/twitter/exchange`);
            
            const response = await fetch(`${AUTH_URL}/auth/twitter/exchange`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to exchange Twitter authorization code');
            }

            printLog(`Twitter exchange successful, user: ${data.user?.twitterUsername}`);
            
            return {
                token: data.token,
                isNewUser: data.isNewUser,
                user: data.user
            };
        } catch (error) {
            console.error('Twitter code exchange error:', error);
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                throw new Error(`Could not connect to auth server at ${AUTH_URL}. Please ensure the server is running.`);
            }
            throw error;
        }
    }
}

export default AuthService;
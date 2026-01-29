// pages/TwitterAuthCallback.tsx
// Handles the OAuth callback from Twitter/X authentication

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import AuthService from '../services/authService.ts';

type AuthStatus = 'processing' | 'exchanging' | 'success' | 'error';

const TwitterAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>('processing');
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    async function exchangeCodeForToken() {
      const code = searchParams.get('code');
      const newUserParam = searchParams.get('isNewUser');
      const errorParam = searchParams.get('error');

      // Handle error from backend
      if (errorParam) {
        setStatus('error');
        setError(decodeURIComponent(errorParam));
        return;
      }

      // Validate code exists
      if (!code) {
        setStatus('error');
        setError('No authorization code received from Twitter');
        return;
      }

      setIsNewUser(newUserParam === 'true');

      try {
        setStatus('exchanging');

        const response = await AuthService.exchangeTwitterCode(code);

        // Store the auth token
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('authProvider', 'twitter');
        
        // Store user info
        if (response.user?.twitterUsername) {
          localStorage.setItem('squareId', `@${response.user.twitterUsername}`);
        }

        // Set subscription status
        if (response.user?.subscriptionValid || response.user?.subscriptionType) {
          localStorage.setItem('isSubscribed', 'true');
          if (response.user?.subscriptionType) {
            localStorage.setItem('subscriptionType', response.user.subscriptionType);
          }
        } else {
          localStorage.removeItem('isSubscribed');
          localStorage.removeItem('subscriptionType');
        }

        setStatus('success');

        // Redirect after a brief success message
        setTimeout(() => {
          if (response.isNewUser) {
            // New user - could redirect to onboarding
            navigate('/app', { replace: true });
          } else {
            // Existing user - redirect to main app
            navigate('/app', { replace: true });
          }
        }, 1500);

      } catch (err) {
        console.error('Twitter auth exchange failed:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to complete Twitter authentication');
      }
    }

    exchangeCodeForToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-8 shadow-2xl w-full max-w-md text-center">
        {/* Twitter/X Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-black border-2 border-gray-700 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </div>
        </div>

        {/* Processing State */}
        {status === 'processing' && (
          <>
            <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Completing Sign-In</h2>
            <p className="text-gray-400">Processing your Twitter authorization...</p>
          </>
        )}

        {/* Exchanging State */}
        {status === 'exchanging' && (
          <>
            <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Verifying Account</h2>
            <p className="text-gray-400">Securely signing you in...</p>
          </>
        )}

        {/* Success State */}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              {isNewUser ? 'Account Created!' : 'Welcome Back!'}
            </h2>
            <p className="text-gray-400">Redirecting to Jamie...</p>
          </>
        )}

        {/* Error State */}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Sign-In Failed</h2>
            <p className="text-red-300 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/app', { replace: true })}
                className="w-full bg-white text-black rounded-lg px-4 py-3 font-medium hover:bg-gray-100 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="w-full text-gray-400 hover:text-white transition-colors text-sm"
              >
                Return to Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TwitterAuthCallback;

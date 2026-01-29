// components/SignInModal.tsx
import React, { useState } from 'react';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import AuthService from '../services/authService.ts';
import '../types/nostr.ts'; // Import for window.nostr types

type AuthMode = 'signin' | 'signup';
type AuthProvider = 'select' | 'email' | 'nostr' | 'twitter';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInSuccess: () => void;
  onSignUpSuccess: () => void;
  customTitle?: string;
  initialMode?: AuthMode;
}

// Check if Nostr extension is available
const hasNostrExtension = (): boolean => {
  return typeof window !== 'undefined' && !!window.nostr;
};

export const SignInModal: React.FC<SignInModalProps> = ({ 
  isOpen, 
  onClose, 
  onSignInSuccess, 
  onSignUpSuccess, 
  customTitle, 
  initialMode 
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode || 'signin');
  const [provider, setProvider] = useState<AuthProvider>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
    }

    setIsLoading(true);

    try {
      const authResponse = mode === 'signin'
        ? await AuthService.signIn(email, password)
        : await AuthService.signUp(email, password);

      // Store auth token and user identifier
      localStorage.setItem('auth_token', authResponse.token);
      localStorage.setItem('squareId', email);

      // Set subscription status based on new subscriptionType field
      if (authResponse.subscriptionValid || authResponse.subscriptionType) {
        localStorage.setItem('isSubscribed', 'true');
        if (authResponse.subscriptionType) {
          localStorage.setItem('subscriptionType', authResponse.subscriptionType);
        }
      } else {
        localStorage.removeItem('isSubscribed');
        localStorage.removeItem('subscriptionType');
      }

      resetForm();
      mode === 'signin' ? onSignInSuccess() : onSignUpSuccess();
      onClose();
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNostrAuth = async () => {
    if (!hasNostrExtension()) {
      setError('No Nostr extension found. Please install a NIP-07 compatible extension like nos2x, Alby, or Flamingo.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // NIP-07 authentication flow
      const authResponse = await AuthService.signInWithNostr();

      // Store auth token
      localStorage.setItem('auth_token', authResponse.token);
      
      // For Nostr users, store the npub (bech32) as the identifier
      const hexPubkey = await window.nostr!.getPublicKey();
      const npub = AuthService.hexToNpub(hexPubkey);
      localStorage.setItem('squareId', npub);
      localStorage.setItem('authProvider', 'nostr');

      // Set subscription status
      if (authResponse.subscriptionValid || authResponse.subscriptionType) {
        localStorage.setItem('isSubscribed', 'true');
        if (authResponse.subscriptionType) {
          localStorage.setItem('subscriptionType', authResponse.subscriptionType);
        }
      } else {
        localStorage.removeItem('isSubscribed');
        localStorage.removeItem('subscriptionType');
      }

      resetForm();
      // Nostr auth is always "sign in" - there's no separate "sign up" for Nostr
      onSignInSuccess();
      onClose();
    } catch (err) {
      console.error('Nostr auth error:', err);
      setError(err instanceof Error ? err.message : 'Nostr authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwitterAuth = () => {
    // Initiate Twitter OAuth - this will redirect to Twitter
    setIsLoading(true);
    setError('');
    setProvider('twitter');
    
    // Small delay to show loading state before redirect
    setTimeout(() => {
      AuthService.initiateTwitterOAuth();
    }, 300);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleBack = () => {
    setProvider('select');
    resetForm();
  };

  const handleClose = () => {
    setProvider('select');
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // Provider Selection Screen
  const renderProviderSelection = () => (
    <div className="space-y-4">
      {/* Jamie Logo */}
      <div className="flex justify-center mb-2">
        <div className="w-16 h-16 rounded-full bg-black border-2 border-gray-700 flex items-center justify-center overflow-hidden shadow-lg">
          <img 
            src="/default-source-favicon.png" 
            alt="Jamie" 
            className="w-12 h-12 object-contain"
          />
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-white text-center mb-2">
        {customTitle || (mode === 'signin' ? 'Welcome Back' : 'Create Account')}
      </h2>
      <p className="hidden sm:block text-gray-400 text-center text-sm mb-6">
        {mode === 'signin' 
          ? 'Choose how you want to sign in' 
          : 'Choose how you want to create your account'}
      </p>

      {/* Provider Cards */}
      <div className="space-y-2">
        {/* Email */}
        <button
          onClick={() => setProvider('email')}
          className="w-full flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-gray-600 hover:bg-gray-900 transition-all group"
        >
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 30%, #d0d0d0 50%, #e0e0e0 70%, #f0f0f0 100%)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -1px 2px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            <Mail className="w-5 h-5 text-gray-800" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-white text-sm font-medium">Continue with Email</span>
            <p className="hidden sm:block text-gray-500 text-xs mt-0.5">Use your email and password</p>
          </div>
          <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Nostr */}
        <button
          onClick={() => setProvider('nostr')}
          className="w-full flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-purple-600/50 hover:bg-gray-900 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-purple-900/50 flex items-center justify-center border border-purple-700/50 overflow-hidden flex-shrink-0">
            <img 
              src="/nostr-logo-square.png" 
              alt="Nostr" 
              className="w-6 h-6 object-contain"
              style={{ filter: 'brightness(1.3)' }}
            />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">Continue with Nostr</span>
              {!hasNostrExtension() && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/50 text-purple-400 border border-purple-700/50">
                  Extension Required
                </span>
              )}
            </div>
            <p className="hidden sm:block text-gray-500 text-xs mt-0.5">Sign in with your NIP-07 extension</p>
          </div>
          <svg className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* X (Twitter) */}
        <button
          onClick={handleTwitterAuth}
          className="w-full flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-gray-600 hover:bg-gray-900 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center border border-gray-700 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <span className="text-white text-sm font-medium">Continue with X</span>
            <p className="hidden sm:block text-gray-500 text-xs mt-0.5">Use your X account</p>
          </div>
          <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="pt-4 border-t border-gray-800 mt-6">
        <p className="text-gray-400 text-sm text-center">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button 
                onClick={() => setMode('signup')} 
                className="text-white hover:text-gray-300 font-medium transition-colors underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button 
                onClick={() => setMode('signin')} 
                className="text-white hover:text-gray-300 font-medium transition-colors underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 mt-4">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-red-200 text-sm">{error}</span>
        </div>
      )}
    </div>
  );

  // Email Form Screen
  const renderEmailForm = () => (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to options</span>
      </button>

      {/* Header with Email Icon */}
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 30%, #d0d0d0 50%, #e0e0e0 70%, #f0f0f0 100%)',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -1px 2px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          <Mail className="w-5 h-5 text-gray-800" />
        </div>
        <h2 className="text-xl font-bold text-white">
          {mode === 'signin' ? 'Sign in with Email' : 'Sign up with Email'}
        </h2>
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/50 transition-colors"
            placeholder="Enter your email"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/50 transition-colors"
            placeholder="Enter your password"
            required
          />
        </div>

        {mode === 'signup' && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/50 transition-colors"
              placeholder="Confirm your password"
              required
            />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-red-200 text-sm">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-white text-black rounded-lg px-4 py-3 font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === 'signin' ? 'Signing In...' : 'Creating Account...'}
            </div>
          ) : mode === 'signin' ? (
            'Sign In'
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Mode Toggle */}
      <div className="pt-4 border-t border-gray-800">
        <p className="text-gray-400 text-sm text-center">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button 
                onClick={() => setMode('signup')} 
                className="text-white hover:text-gray-300 font-medium transition-colors underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button 
                onClick={() => setMode('signin')} 
                className="text-white hover:text-gray-300 font-medium transition-colors underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );

  // Nostr Auth Screen
  const renderNostrAuth = () => (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to options</span>
      </button>

      {/* Header with Nostr Icon */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-purple-900/50 flex items-center justify-center border border-purple-700/50 overflow-hidden">
          <img 
            src="/nostr-logo-square.png" 
            alt="Nostr" 
            className="w-6 h-6 object-contain"
            style={{ filter: 'brightness(1.3)' }}
          />
        </div>
        <h2 className="text-xl font-bold text-white">Sign in with Nostr</h2>
      </div>

      <div className="text-center py-6">
        {hasNostrExtension() ? (
          <>
            <div className="w-16 h-16 rounded-full bg-purple-900/30 border border-purple-600/50 flex items-center justify-center mx-auto mb-4">
              <img 
                src="/nostr-logo-square.png" 
                alt="Nostr" 
                className="w-10 h-10 object-contain"
                style={{ filter: 'brightness(1.3)' }}
              />
            </div>
            <p className="text-gray-300 mb-6">
              Click below to connect your Nostr identity via your browser extension.
            </p>
            <button
              onClick={handleNostrAuth}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg px-4 py-3 font-medium hover:from-purple-500 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </div>
              ) : (
                'Connect Nostr Extension'
              )}
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
              <img 
                src="/nostr-logo-square.png" 
                alt="Nostr" 
                className="w-10 h-10 object-contain opacity-50"
              />
            </div>
            <p className="text-gray-300 mb-4">
              No Nostr extension detected.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Install a NIP-07 compatible extension like{' '}
              <a 
                href="https://github.com/nickhthomas/nos2x" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                nos2x
              </a>
              {' '}or{' '}
              <a 
                href="https://getalby.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Alby
              </a>
              {' '}to continue.
            </p>
            <button
              onClick={() => window.open('https://nostr-nips.com/nip-07', '_blank')}
              className="text-purple-400 hover:text-purple-300 text-sm underline"
            >
              Learn more about NIP-07
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-red-200 text-sm">{error}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6 shadow-2xl relative w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Render appropriate screen based on provider selection */}
          {provider === 'select' && renderProviderSelection()}
          {provider === 'email' && renderEmailForm()}
          {provider === 'nostr' && renderNostrAuth()}
          {provider === 'twitter' && isLoading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Redirecting to X</h2>
              <p className="text-gray-400">You'll be redirected to authorize with X...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignInModal;

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Crown, ArrowRight } from 'lucide-react';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.ts';
import { SignInModal } from './SignInModal.tsx';
import { CheckoutModal } from './CheckoutModal.tsx';
import UpgradeSuccessModal from './UpgradeSuccessModal.tsx';

type UpgradePhase = 'loading' | 'sign-in' | 'checkout' | 'already-pro' | 'success';

const UpgradePage: React.FC = () => {
  const navigate = useNavigate();
  const subscription = useSubscriptionStatus();
  const [phase, setPhase] = useState<UpgradePhase>('loading');
  const [checkoutProduct, setCheckoutProduct] = useState<string>('amber');
  const [purchasedPlan, setPurchasedPlan] = useState<'jamie-plus' | 'jamie-pro'>('jamie-plus');

  const determinePhase = useCallback(() => {
    if (!subscription.isAuthenticated) {
      setPhase('sign-in');
      return;
    }

    const upgradeProduct = subscription.getUpgradeProduct();

    if (upgradeProduct === null) {
      setPhase('already-pro');
      return;
    }

    if (upgradeProduct === 'jamie-pro') {
      setCheckoutProduct('jamie-pro');
    } else {
      setCheckoutProduct('amber');
    }
    setPhase('checkout');
  }, [subscription]);

  useEffect(() => {
    determinePhase();
  }, [determinePhase]);

  const handleSignInSuccess = () => {
    subscription.refresh();
    // Small delay to let localStorage settle, then re-evaluate
    setTimeout(() => {
      subscription.refresh();
      determinePhase();
    }, 200);
  };

  const handleCheckoutSuccess = () => {
    const plan = checkoutProduct === 'jamie-pro' ? 'jamie-pro' : 'jamie-plus';
    setPurchasedPlan(plan);
    setPhase('success');
    subscription.refresh();
  };

  const handleCheckoutClose = () => {
    navigate('/app');
  };

  const handleSuccessContinue = () => {
    navigate('/app');
  };

  const handleGoToApp = () => {
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/50 via-black to-gray-900/30" />

      {/* Sign-in phase */}
      <SignInModal
        isOpen={phase === 'sign-in'}
        onClose={handleGoToApp}
        onSignInSuccess={handleSignInSuccess}
        onSignUpSuccess={handleSignInSuccess}
        customTitle="Sign in to Upgrade"
        initialMode="signin"
        pulseSource="upgrade_page"
        pulseIntent="upgrade"
      />

      {/* Checkout phase */}
      <CheckoutModal
        isOpen={phase === 'checkout'}
        onClose={handleCheckoutClose}
        onSuccess={handleCheckoutSuccess}
        productName={checkoutProduct}
      />

      {/* Upgrade success phase */}
      <UpgradeSuccessModal
        isOpen={phase === 'success'}
        onClose={handleSuccessContinue}
        planName={purchasedPlan}
      />

      {/* Already Pro notification */}
      {phase === 'already-pro' && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          <div className="relative w-full max-w-md mx-4 overflow-hidden">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 rounded-2xl blur-lg" />

            <div className="relative bg-[#0a0a0a] border border-gray-700/50 rounded-2xl p-8">
              {/* Crown icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-400/10 rounded-full blur-xl" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center">
                    <Crown className="w-10 h-10 text-black" strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center mb-2 text-white">
                You're Already on Jamie Pro
              </h2>

              <p className="text-gray-400 text-center text-sm mb-2">
                You have the highest tier subscription with full access to every feature.
              </p>

              <div className="flex items-center justify-center gap-2 mb-6">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm font-medium">All features unlocked</span>
              </div>

              {/* Feature highlights */}
              <div className="space-y-2 mb-8">
                {[
                  'Unlimited searches, clips & AI assists',
                  'Auto-transcription pipeline',
                  'Video editing from browser',
                  'Crosspost in seconds',
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-gray-800"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animation: 'fadeInUp 0.4s ease-out forwards',
                      opacity: 0,
                    }}
                  >
                    <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Go to app button */}
              <button
                onClick={handleGoToApp}
                className="w-full py-3 px-6 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 transition-all duration-300 shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
              >
                Go to Jamie
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <style>{`
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      )}

      {/* Loading state (brief, while subscription status resolves) */}
      {phase === 'loading' && (
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      )}
    </div>
  );
};

export default UpgradePage;

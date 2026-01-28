// components/QuotaExceededModal.tsx
import React from 'react';

// User tier types from the new auth system
export type UserTier = 'anonymous' | 'registered' | 'subscriber' | 'admin';

export interface QuotaExceededData {
  tier: UserTier;
  used: number;
  max: number;
  resetDate?: string;
  daysUntilReset?: number;
  entitlementType?: string;
}

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: QuotaExceededData;
  onSignUp?: () => void;      // For anonymous -> registered
  onUpgrade?: () => void;     // For registered -> subscriber (Basic)
  onUpgradePro?: () => void;  // For subscriber -> admin (Jamie Pro)
}

/**
 * Format the reset date for display
 */
function formatResetDate(resetDate?: string, daysUntilReset?: number): string {
  if (daysUntilReset !== undefined) {
    if (daysUntilReset === 0) return 'today';
    if (daysUntilReset === 1) return 'tomorrow';
    return `in ${daysUntilReset} days`;
  }
  
  if (resetDate) {
    try {
      const date = new Date(resetDate);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'soon';
    }
  }
  
  return 'soon';
}

/**
 * Get human-readable name for entitlement type
 */
function getEntitlementLabel(type?: string): string {
  const labels: Record<string, string> = {
    'search-quotes': 'searches',
    'search-quotes-3d': '3D searches',
    'make-clip': 'clips',
    'jamie-assist': 'AI assists',
    'ai-analyze': 'AI analyses',
    'submit-on-demand-run': 'on-demand runs',
  };
  return labels[type || ''] || 'requests';
}

export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  isOpen,
  onClose,
  data,
  onSignUp,
  onUpgrade,
  onUpgradePro,
}) => {
  if (!isOpen) return null;

  const { tier, used, max, resetDate, daysUntilReset, entitlementType } = data;
  const resetText = formatResetDate(resetDate, daysUntilReset);
  const entitlementLabel = getEntitlementLabel(entitlementType);

  // Determine content based on tier
  const getTierContent = () => {
    switch (tier) {
      case 'anonymous':
        return {
          title: 'Free Limit Reached',
          message: `You've used all ${max} free ${entitlementLabel}. Create an account to get more.`,
          primaryButton: 'Create Account',
          primaryAction: onSignUp,
          secondaryMessage: 'Already have an account? Sign in to continue.',
          showUpgradeHint: true,
        };
      
      case 'registered':
        return {
          title: 'Monthly Limit Reached',
          message: `You've used all ${max} ${entitlementLabel} this month.`,
          primaryButton: 'Upgrade to Jamie Basic',
          primaryAction: onUpgrade,
          secondaryMessage: `Your quota resets ${resetText}.`,
          showUpgradeHint: false,
          upgradeDescription: 'Unlock more searches, clips, and AI features with Jamie Basic.',
        };
      
      case 'subscriber':
        return {
          title: 'Plan Limit Reached',
          message: `You've used all ${max} ${entitlementLabel} on your Basic plan.`,
          primaryButton: 'Upgrade to Jamie Pro',
          primaryAction: onUpgradePro,
          secondaryMessage: `Your quota resets ${resetText}.`,
          showUpgradeHint: false,
          upgradeDescription: 'Get unlimited access and premium features with Jamie Pro.',
        };
      
      case 'admin':
        // Admins should never see this, but handle gracefully
        return {
          title: 'Unexpected Limit',
          message: 'Something went wrong. Please contact support.',
          primaryButton: 'Close',
          primaryAction: onClose,
          secondaryMessage: '',
          showUpgradeHint: false,
        };
      
      default:
        return {
          title: 'Limit Reached',
          message: `You've used all ${max} ${entitlementLabel}.`,
          primaryButton: 'Close',
          primaryAction: onClose,
          secondaryMessage: `Your quota resets ${resetText}.`,
          showUpgradeHint: false,
        };
    }
  };

  const content = getTierContent();

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4">
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 shadow-xl relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Warning Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white text-center mb-2">
            {content.title}
          </h2>

          {/* Usage indicator */}
          <div className="flex justify-center mb-4">
            <div className="bg-gray-800 rounded-full px-4 py-1 text-sm">
              <span className="text-amber-500 font-semibold">{used}</span>
              <span className="text-gray-400"> / {max} used</span>
            </div>
          </div>

          {/* Message */}
          <p className="text-gray-300 text-center mb-4">
            {content.message}
          </p>

          {/* Upgrade description (for registered/subscriber) */}
          {content.upgradeDescription && (
            <p className="text-gray-400 text-sm text-center mb-6">
              {content.upgradeDescription}
            </p>
          )}

          {/* Primary CTA */}
          {content.primaryAction && (
            <button
              onClick={content.primaryAction}
              className="w-full bg-white text-black rounded-lg px-4 py-3 font-medium hover:bg-gray-100 transition-colors mb-3"
            >
              {content.primaryButton}
            </button>
          )}

          {/* Secondary message / reset info */}
          {content.secondaryMessage && (
            <p className="text-gray-500 text-sm text-center">
              {content.secondaryMessage}
            </p>
          )}

          {/* Skip/Close for non-upgrade scenarios */}
          {tier !== 'admin' && (
            <button
              onClick={onClose}
              className="w-full mt-3 text-gray-400 text-sm hover:text-white transition-colors"
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuotaExceededModal;

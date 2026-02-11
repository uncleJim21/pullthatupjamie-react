// components/QuotaExceededModal.tsx
import React, { useEffect, useRef } from 'react';
import { Orbit, RadioTower } from 'lucide-react';
import {
  emitQuotaExceededShown,
  emitQuotaExceededAction,
  type QuotaAction,
} from '../services/pulseService.ts';

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
  onUpgrade?: () => void;     // For registered -> subscriber (Plus)
  onUpgradePro?: () => void;  // For subscriber -> admin (Jamie Pro)
  onPreview?: () => void;     // Optional: preview what upgrade unlocks
  icon?: 'orbit' | 'radio-tower'; // Icon style: orbit for search, radio-tower for podcast processing
}

/**
 * Format the reset time in a friendly way
 */
function formatResetTime(resetDate?: string, daysUntilReset?: number): string {
  if (daysUntilReset !== undefined) {
    if (daysUntilReset === 0) return 'tomorrow';
    if (daysUntilReset === 1) return 'in 2 days';
    return `in ${daysUntilReset + 1} days`;
  }
  
  if (resetDate) {
    try {
      const date = new Date(resetDate);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
      
      if (diffHours <= 24) return 'tomorrow';
      if (diffHours <= 48) return 'in 2 days';
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } catch {
      return 'soon';
    }
  }
  
  return 'soon';
}

/**
 * Get accomplishment text based on entitlement type
 */
function getAccomplishmentText(type?: string, used?: number): string {
  const count = used || 0;
  
  switch (type) {
    case 'search-quotes':
      return `You explored ${count} idea${count !== 1 ? 's' : ''} across the podcast universe`;
    case 'search-quotes-3d':
      return `You mapped ${count} concept${count !== 1 ? 's' : ''} in 3D space`;
    case 'make-clip':
      return `You captured ${count} moment${count !== 1 ? 's' : ''} worth sharing`;
    case 'jamie-assist':
      return `Jamie helped craft ${count} post${count !== 1 ? 's' : ''} for you`;
    case 'ai-analyze':
      return `You uncovered insights from ${count} analysis session${count !== 1 ? 's' : ''}`;
    case 'submit-on-demand-run':
      return `You added ${count} podcast${count !== 1 ? 's' : ''} to your library`;
    default:
      return `You've been exploring with Jamie`;
  }
}

/**
 * Get momentum-oriented title
 */
function getMomentumTitle(tier: UserTier): string {
  switch (tier) {
    case 'anonymous':
      return "You're on a roll";
    case 'registered':
      return "You've hit today's limit";
    case 'subscriber':
      return "You've maxed out this cycle";
    default:
      return "Pause in exploration";
  }
}

/**
 * Get continuation CTA text
 */
function getContinuationCTA(tier: UserTier): string {
  switch (tier) {
    case 'anonymous':
      return "Continue with a free account";
    case 'registered':
      return "Keep exploring with Jamie Plus";
    case 'subscriber':
      return "Go unlimited with Jamie Pro";
    default:
      return "Continue";
  }
}

export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  isOpen,
  onClose,
  data,
  onSignUp,
  onUpgrade,
  onUpgradePro,
  onPreview,
  icon = 'orbit', // Default to orbit for general use
}) => {
  // Track if we've already tracked the "shown" event for this open
  const hasTrackedShown = useRef(false);

  // Pulse: record when modal is shown
  useEffect(() => {
    if (isOpen && !hasTrackedShown.current) {
      hasTrackedShown.current = true;
      emitQuotaExceededShown(
        data.entitlementType || 'unknown',
        data.used,
        data.max
      );
    }
    
    // Reset when modal closes
    if (!isOpen) {
      hasTrackedShown.current = false;
    }
  }, [isOpen, data.entitlementType, data.used, data.max]);

  // Wrapper functions to track actions
  const handleClose = () => {
    emitQuotaExceededAction('dismissed');
    onClose();
  };

  const handleSignUp = () => {
    emitQuotaExceededAction('signup');
    onSignUp?.();
  };

  const handleUpgrade = () => {
    emitQuotaExceededAction('upgrade_plus');
    onUpgrade?.();
  };

  const handleUpgradePro = () => {
    emitQuotaExceededAction('upgrade_pro');
    onUpgradePro?.();
  };

  if (!isOpen) return null;

  const { tier, used, max, resetDate, daysUntilReset, entitlementType } = data;
  const resetTime = formatResetTime(resetDate, daysUntilReset);
  const accomplishment = getAccomplishmentText(entitlementType, used);
  const title = getMomentumTitle(tier);
  const ctaText = getContinuationCTA(tier);
  
  // Render the appropriate icon
  const IconComponent = icon === 'radio-tower' ? RadioTower : Orbit;

  // Determine the primary action based on tier (using tracked wrappers)
  const getPrimaryAction = () => {
    switch (tier) {
      case 'anonymous':
        return onSignUp ? handleSignUp : undefined;
      case 'registered':
        return onUpgrade ? handleUpgrade : undefined;
      case 'subscriber':
        return onUpgradePro ? handleUpgradePro : undefined;
      default:
        return handleClose;
    }
  };

  const primaryAction = getPrimaryAction();

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop with subtle blur to hint at content behind */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={handleClose} 
      />
      
      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm px-4">
        <div className="bg-[#0a0a0a] border border-gray-800/50 rounded-2xl p-8 shadow-2xl relative">
          
          {/* Subtle close affordance */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-600 hover:text-gray-400 transition"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Icon - contextual based on entitlement type */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <IconComponent className="w-6 h-6 text-white/80" />
            </div>
          </div>

          {/* Momentum title */}
          <h2 className="text-xl font-medium text-white text-center mb-3">
            {title}
          </h2>

          {/* Accomplishment - what they achieved */}
          <p className="text-gray-400 text-center text-sm mb-8">
            {accomplishment}
          </p>

          {/* Primary CTA - continuation focused */}
          {primaryAction && (
            <button
              onClick={primaryAction}
              className="w-full bg-white text-black rounded-xl px-4 py-3.5 font-medium hover:bg-gray-100 transition-colors mb-4"
            >
              {ctaText}
            </button>
          )}

          {/* Secondary path - low emphasis */}
          <div className="text-center space-y-3">
            {tier !== 'anonymous' && onPreview && (
              <button
                onClick={onPreview}
                className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
              >
                Preview what's included →
              </button>
            )}
            
            {/* Soft reset reminder */}
            <p className="text-gray-600 text-xs">
              {tier === 'anonymous' 
                ? "No credit card required"
                : `Your limit refreshes ${resetTime}`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaExceededModal;

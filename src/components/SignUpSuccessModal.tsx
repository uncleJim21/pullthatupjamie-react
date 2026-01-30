// components/SignUpSuccessModal.tsx
import React from 'react';
import { CheckCircle } from 'lucide-react';

interface SignUpSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onSkip: () => void;
}

export const SignUpSuccessModal: React.FC<SignUpSuccessModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  onSkip,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm px-4">
        <div className="bg-[#0a0a0a] border border-gray-800/50 rounded-2xl p-8 shadow-2xl relative">
          
          {/* Success checkmark */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-medium text-white text-center mb-2">
            Welcome to Jamie!
          </h2>

          {/* Subtitle */}
          <p className="text-gray-400 text-center text-sm mb-2">
            Your account is ready.
          </p>

          {/* Value prop for upgrading */}
          <p className="text-gray-500 text-center text-sm mb-8">
            Want more searches, clips, and AI assists each day? Unlock higher limits with Jamie Plus.
          </p>

          {/* Feature highlights */}
          <div className="mb-8 space-y-2">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="text-green-500">✓</span>
              <span>10x more daily searches</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="text-green-500">✓</span>
              <span>Visual concept exploration in 3D</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="text-green-500">✓</span>
              <span>AI summaries & key point analysis</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="text-green-500">✓</span>
              <span>Add any podcast to Jamie</span>
            </div>
          </div>

          {/* Primary CTA - Upgrade */}
          <button
            onClick={onUpgrade}
            className="w-full bg-white text-black rounded-xl px-4 py-3.5 font-medium hover:bg-gray-100 transition-colors mb-3"
          >
            Upgrade to Jamie Plus
          </button>

          {/* Secondary - Skip */}
          <button
            onClick={onSkip}
            className="w-full text-gray-500 text-sm hover:text-gray-300 transition-colors py-2"
          >
            Continue with free account
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignUpSuccessModal;

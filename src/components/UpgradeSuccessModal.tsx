import React from 'react';
import { Sparkles, Zap, Brain, Podcast, Check } from 'lucide-react';

interface UpgradeSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName?: 'jamie-plus' | 'jamie-pro';
}

export const UpgradeSuccessModal: React.FC<UpgradeSuccessModalProps> = ({
  isOpen,
  onClose,
  planName = 'jamie-plus',
}) => {
  if (!isOpen) return null;

  const isPro = planName === 'jamie-pro';

  const plusBenefits = [
    { icon: Zap, text: 'Higher search & clip limits' },
    { icon: Brain, text: 'AI-powered analysis & summaries' },
    { icon: Sparkles, text: 'Visual concept exploration' },
    { icon: Podcast, text: 'Add your own podcasts' },
  ];

  const proBenefits = [
    { icon: Zap, text: 'Unlimited usage across all features' },
    { icon: Brain, text: 'Auto-transcription pipeline' },
    { icon: Sparkles, text: 'Curated clips & automation' },
    { icon: Podcast, text: 'Video editing from browser' },
  ];

  const benefits = isPro ? proBenefits : plusBenefits;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 overflow-hidden">
        {/* Subtle glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-white/20 via-gray-400/20 to-white/20 rounded-2xl blur-lg" />
        
        {/* Content container */}
        <div className="relative bg-[#0a0a0a] border border-gray-700/50 rounded-2xl p-8">
          {/* Success checkmark */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 rounded-full blur-xl" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-white to-gray-400 flex items-center justify-center">
                <Check className="w-10 h-10 text-black" strokeWidth={3} />
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center mb-2 text-white">
            Welcome to Jamie {isPro ? 'Pro' : 'Plus'}!
          </h2>
          
          <p className="text-gray-400 text-center text-sm mb-6">
            Your upgrade is complete. Here's what's now unlocked:
          </p>

          {/* Benefits list */}
          <div className="space-y-3 mb-8">
            {benefits.map((benefit, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-gray-800"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.4s ease-out forwards',
                  opacity: 0,
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/20 to-gray-600/20 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-200 text-sm">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* Continue button */}
          <button
            onClick={onClose}
            className="w-full py-3 px-6 rounded-xl font-semibold text-black bg-gradient-to-r from-white to-gray-300 hover:from-gray-100 hover:to-gray-200 transition-all duration-300 shadow-lg shadow-white/10"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Keyframe animation */}
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
  );
};

export default UpgradeSuccessModal;

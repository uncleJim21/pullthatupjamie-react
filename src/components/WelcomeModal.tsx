import React from 'react';

interface WelcomeModalProps {
  isOpen: boolean;
  onQuickTour: () => void;
  onGetStarted: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onQuickTour, onGetStarted }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
      <div className="relative flex flex-col items-center justify-between w-full max-w-sm sm:max-w-md h-auto max-h-[90vh] rounded-2xl bg-[#111] border border-gray-800 shadow-2xl px-6 sm:px-8 py-8 sm:py-12">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6 sm:mb-8">
          <img
            src="/jamie-logo.png"
            alt="Jamie Logo"
            className="w-32 h-20 sm:w-48 sm:h-32 object-contain"
          />
        </div>
        
        {/* Welcome Text */}
        <div className="text-center mb-6 sm:mb-8 flex-1 flex flex-col justify-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome to Jamie</h1>
          <p className="text-gray-300 text-base sm:text-lg px-2">Your AI-powered podcast and web search companion</p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onQuickTour}
            className="w-full bg-white text-black px-6 py-3 rounded-md hover:bg-gray-200 transition-colors font-medium text-base sm:text-lg"
          >
            Quick Tour
          </button>
          <button
            onClick={onGetStarted}
            className="w-full bg-[#1A1A1A] hover:bg-[#252525] text-white px-6 py-3 rounded-md border border-gray-700 transition-colors font-medium text-base sm:text-lg"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal; 
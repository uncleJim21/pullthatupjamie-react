import React from 'react';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLightningSelect: () => void;
  onSubscribeSelect: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onLightningSelect, onSubscribeSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[95%] sm:max-w-md px-4 sm:px-0 text-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">Register or Connect to Continue</h2>
        <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">
          Unlock the full potential of Jamie<br />
          by registering or connecting your wallet
        </p>
        
        <div className="space-y-3 sm:space-y-4">
          <button 
              onClick={onSubscribeSelect}
              className="w-full bg-[#ffffff] text-black rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 font-medium hover:bg-[#ddd] transition-colors border border-gray-800"
            >
              <div className="flex items-center justify-center relative">
                <div className="absolute ml-1 left-0 w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src="/inverted-square.png"
                    alt="Square Logo"
                    width="28"
                    height="28"
                    className="p-1"
                  />
                </div>
                <div className="text-center">
                  <div className="font-medium text-sm sm:text-base">Subscribe</div>
                  <div className="text-xs sm:text-sm text-gray-600 ml-7 sm:ml-8 mr-7 sm:mr-8">Unlimited Access to Jamie & More</div>
                </div>
              </div>
            </button>

          <button 
            onClick={onLightningSelect}
            className="w-full bg-[#FFA500] text-black rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 font-medium hover:bg-[#FFB52E] transition-colors"
          >
            <div className="flex items-center justify-center relative">
              <div className="absolute ml-1 left-0 w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-black border border-white/20 flex items-center justify-center">
                <span className="text-base sm:text-lg">⚡</span>
              </div>
              <div className="text-center">
                <div className="font-medium text-sm sm:text-base">Connect Lightning Wallet</div>
                <div className="text-xs sm:text-sm ml-7 sm:ml-8 mr-7 sm:mr-8">Maximum Privacy</div>
              </div>
            </div>
          </button>

          <button 
            onClick={onClose}
            className="w-full bg-[#1A1A1A] text-gray-400 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 font-medium hover:bg-[#222] transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;
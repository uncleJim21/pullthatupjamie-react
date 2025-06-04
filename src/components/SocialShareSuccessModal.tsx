import React from 'react';
import { X, Twitter } from 'lucide-react';

interface SocialShareSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  successUrls: {
    twitter?: string;
    nostr?: string;
  };
}

const SocialShareSuccessModal: React.FC<SocialShareSuccessModalProps> = ({
  isOpen,
  onClose,
  successUrls
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-[110] p-4">
      <div className="bg-black border border-gray-800 rounded-xl p-6 w-full max-w-md text-center relative shadow-xl">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-6">Posts Published Successfully!</h2>

        <div className="space-y-4">
          {successUrls.twitter && (
            <a 
              href={successUrls.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-gray-900/60 border border-gray-700 rounded-lg hover:bg-gray-900 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <Twitter className="w-6 h-6 text-blue-400" />
                <span className="text-white text-sm group-hover:text-blue-400 transition-colors">View on Twitter</span>
              </div>
              <span className="text-gray-400 text-sm">→</span>
            </a>
          )}

          {successUrls.nostr && (
            <a 
              href={successUrls.nostr}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-gray-900/60 border border-gray-700 rounded-lg hover:bg-gray-900 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <img 
                  src="/nostr-logo-square.png" 
                  alt="Nostr" 
                  className="w-6 h-6"
                  style={{ filter: 'brightness(1.2)', mixBlendMode: 'screen' }}
                />
                <span className="text-white text-sm group-hover:text-purple-400 transition-colors">View on Primal</span>
              </div>
              <span className="text-gray-400 text-sm">→</span>
            </a>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-100 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default SocialShareSuccessModal; 
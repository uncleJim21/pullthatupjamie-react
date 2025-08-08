import React from 'react';
import { X, Twitter, Calendar } from 'lucide-react';
import { FRONTEND_URL } from '../constants/constants.ts';

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

        <h2 className="text-xl font-semibold text-white mb-6">Posts Scheduled Successfully!</h2>

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

        <div className="flex flex-col space-y-3 mt-6">
          <button
            onClick={() => {
              const currentUrl = window.location.href;
              const feedId = currentUrl.split('/feed/')[1]?.split('/')[0];
              if (feedId) {
                const jamieProUrl = `${FRONTEND_URL}/app/feed/${feedId}/jamieProHistory?view=scheduled-posts`;
                window.open(jamieProUrl, '_blank');
              }
            }}
            className="flex items-center justify-center space-x-2 px-6 py-2 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>Scheduled Posts</span>
          </button>
          
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default SocialShareSuccessModal; 
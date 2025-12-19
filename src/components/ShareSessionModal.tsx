import React, { useState, useEffect } from 'react';
import { X, Share2 } from 'lucide-react';

interface ShareSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title?: string) => void;
  suggestedTitle?: string;
  isSharing?: boolean;
}

const ShareSessionModal: React.FC<ShareSessionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  suggestedTitle = '',
  isSharing = false
}) => {
  const [title, setTitle] = useState(suggestedTitle);

  // Update title when suggestedTitle changes
  useEffect(() => {
    setTitle(suggestedTitle);
  }, [suggestedTitle]);

  // Reset title when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle(suggestedTitle);
    }
  }, [isOpen, suggestedTitle]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Pass undefined if title is empty or only whitespace
    const trimmedTitle = title.trim();
    onConfirm(trimmedTitle.length > 0 ? trimmedTitle : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md relative shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Close button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          disabled={isSharing}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-gray-300" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Share Research Session</h2>
            <p className="text-sm text-gray-400">Create a shareable link</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="session-title" className="block text-sm font-medium text-gray-300 mb-2">
              Session Title <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="session-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your research session..."
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              maxLength={100}
              disabled={isSharing}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              If no title is provided, one will be generated automatically
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              disabled={isSharing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSharing}
            >
              {isSharing ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Share
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShareSessionModal;

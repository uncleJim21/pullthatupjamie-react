import React from 'react';
import { X, Lightbulb, Zap, AlertTriangle } from 'lucide-react';

interface SearchModeExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModeExplainerModal: React.FC<SearchModeExplainerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 shadow-xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-lg font-bold text-white mb-5">Search Modes</h2>

          <div className="space-y-4">
            {/* Smart Mode */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="font-semibold text-amber-400">Smart Mode</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Uses AI to understand your intent — identifies people, shows, and topics, 
                then automatically applies the right filters and rewrites your query 
                for the best results. Slightly slower but significantly more accurate 
                for natural-language searches.
              </p>
              <div className="flex items-start gap-2 mt-3 p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Because Smart Mode handles filtering automatically, it is disabled 
                  when manual filters (date range, episode) are active. Tap the 
                  toggle to clear filters and re-enable Smart Mode.
                </p>
              </div>
            </div>

            {/* Speed Mode */}
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-cyan-500/15 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <span className="font-semibold text-cyan-400">Speed Mode</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Runs a direct vector search with no query rewriting. 
                Fastest possible results — ideal when you already know exactly 
                what you're looking for. Supports manual filters for fine-grained control.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-5 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchModeExplainerModal;

import React from 'react';
import { X, Microscope, Zap } from 'lucide-react';

// Mirrors SearchModeExplainerModal (used by the Smart/Speed toggle in
// SearchInterface) so the two help-modals feel like part of the same kit.
// Keep the visual structure here aligned with that file: backdrop +
// blurred overlay, centered card, two color-tinted mode sections, and a
// "Got it" dismiss button.
//
// Layout note: uses a flex-centered container with `py-8 sm:py-12` outer
// padding (instead of an absolutely-centered transform) so the modal
// always has visible top and bottom breathing room — even on short
// mobile viewports — and overflows into a scrollable region rather than
// extending past the viewport edges. Body text scales down a notch on
// mobile (`text-xs sm:text-sm`) to keep the Deep + Fast cards within a
// single screenful where possible.

interface JamiePullAgentModelExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const JamiePullAgentModelExplainerModal: React.FC<JamiePullAgentModelExplainerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:py-12 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-full">
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 sm:p-6 shadow-xl relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-5">Agent Modes</h2>

          <div className="space-y-3 sm:space-y-4">
            {/* Deep Mode — DeepSeek-blue palette to match the toggle pill */}
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Microscope className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />
                </div>
                <span className="font-semibold text-blue-400 text-sm sm:text-base">Deep</span>
                <span className="ml-auto text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500">Default</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                Uses our most capable models to fully explore your question — multi-step
                reasoning, exhaustive context gathering, and nuanced synthesis across
                sources. Best for exploratory questions, multi-document research, and
                anything where you want the agent to leave no stone unturned.
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2">
                Typically <span className="text-blue-400">60–90 seconds</span> per answer.
              </p>
            </div>

            {/* Fast Mode — Bitcoin-orange palette */}
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-500/15 flex items-center justify-center">
                  <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400" />
                </div>
                <span className="font-semibold text-orange-400 text-sm sm:text-base">Fast</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                Uses lighter, snappier models that answer in a single pass. Ideal when
                you already know what you're looking for and just want a direct response
                — lookups, definitions, single-document Q&amp;A. Same call price as Deep,
                roughly half the wait.
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2">
                Typically <span className="text-orange-400">30–45 seconds</span> per answer.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 sm:mt-5 px-4 py-2 sm:py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors text-xs sm:text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default JamiePullAgentModelExplainerModal;

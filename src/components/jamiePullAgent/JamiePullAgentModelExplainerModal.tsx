import React from 'react';
import { X, Microscope, Zap } from 'lucide-react';

// Mirrors SearchModeExplainerModal (used by the Smart/Speed toggle in
// SearchInterface) so the two help-modals feel like part of the same kit.
// Keep the visual structure here aligned with that file: backdrop +
// blurred overlay, centered card, two color-tinted mode sections, and a
// "Got it" dismiss button.

interface JamiePullAgentModelExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const JamiePullAgentModelExplainerModal: React.FC<JamiePullAgentModelExplainerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4">
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 shadow-xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-lg font-bold text-white mb-5">Agent Modes</h2>

          <div className="space-y-4">
            {/* Deep Mode — DeepSeek-blue palette to match the toggle pill */}
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Microscope className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="font-semibold text-blue-400">Deep</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">Default</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Thinks longer and runs more reasoning steps before answering — better for
                exploratory questions, nuanced multi-source synthesis, and when you want
                the agent to fully consider context. Slightly slower and slightly higher
                cost per call, but the answer is more thorough.
              </p>
            </div>

            {/* Fast Mode — Bitcoin-orange palette */}
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-orange-500/15 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <span className="font-semibold text-orange-400">Fast</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Quick, cost-efficient answers with a single reasoning pass. Ideal when
                you already know what you're looking for and just want a direct response
                — lookups, definitions, single-document Q&amp;A. Lower latency, lower cost.
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

export default JamiePullAgentModelExplainerModal;

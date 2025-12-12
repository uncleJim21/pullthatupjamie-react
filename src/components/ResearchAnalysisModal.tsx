import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Loader, BrainCircuit, AlertCircle, RotateCcw } from 'lucide-react';
import { analyzeResearchSession } from '../services/researchSessionAnalysisService.ts';
import { getCurrentSessionId } from '../services/researchSessionService.ts';

interface ResearchAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
}

const DEFAULT_INSTRUCTIONS = "Analyze this research session and summarize the main themes, key insights, and 3-5 follow-up questions.";

export const ResearchAnalysisPanel: React.FC<ResearchAnalysisPanelProps> = ({
  isOpen,
  onClose,
  sessionId: propSessionId
}) => {
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Get session ID from props or localStorage
  const sessionId = propSessionId || getCurrentSessionId();

  useEffect(() => {
    if (isOpen) {
      setAnalysis('');
      setError(null);
      setIsCollapsed(false);
    }
  }, [isOpen]);

  const handleAnalyze = async () => {
    if (!sessionId) {
      setError('No research session found. Please save your session first.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis('');

    const result = await analyzeResearchSession(
      sessionId,
      instructions,
      (chunk) => {
        setAnalysis(prev => prev + chunk);
        // Auto-scroll to bottom as new content arrives
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
      }
    );

    setIsAnalyzing(false);

    if (!result.success) {
      setError(result.error || 'Analysis failed');
    }
  };

  // Auto-analyze when panel opens if no analysis yet
  useEffect(() => {
    if (isOpen && !analysis && !isAnalyzing && !error && sessionId) {
      handleAnalyze();
    }
  }, [isOpen]);

  // Parse the analysis into title and content
  const lines = analysis.split('\n');
  const titleLine = lines.find(line => line.trim().startsWith('TITLE:'));
  const title = titleLine ? titleLine.replace('TITLE:', '').trim() : '';
  const content = lines
    .filter(line => !line.trim().startsWith('TITLE:'))
    .join('\n')
    .trim();

  const panelWidthClass = !isOpen
    ? 'w-0 border-l-0'
    : isCollapsed
      ? 'w-[32px]'
      : 'w-[600px]';

  return (
    <div
      className={`absolute top-0 right-0 h-full bg-black border-l border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${panelWidthClass} overflow-hidden flex-shrink-0 z-50`}
    >
      {/* Collapsed State - Tab */}
      {isCollapsed && isOpen && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center justify-center h-full hover:bg-gray-900 transition-colors group"
          aria-label="Expand panel"
        >
          <div className="flex flex-col items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
            <div className="writing-mode-vertical text-xs text-gray-400 group-hover:text-white transition-colors whitespace-nowrap">
              AI Analysis
            </div>
          </div>
        </button>
      )}

      {/* Expanded State - Full Panel */}
      {!isCollapsed && isOpen && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-gray-800 flex items-center gap-2 justify-between bg-[#0A0A0A]">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium text-gray-400">AI Analysis</h3>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Collapse panel"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div ref={contentRef} className="flex-1 overflow-y-auto p-4">
            {error ? (
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium mb-1 text-sm">Analysis Error</div>
                    <div className="text-xs">{error}</div>
                  </div>
                </div>
              </div>
            ) : isAnalyzing && !analysis ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader className="w-8 h-8 animate-spin mb-4" />
                <p className="text-sm">Analyzing research session...</p>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                {title && (
                  <div className="pb-4 border-b border-gray-800">
                    <h3 className="text-lg font-bold text-white leading-tight">{title}</h3>
                  </div>
                )}
                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap space-y-4">
                  {content}
                </div>
                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-blue-400 text-sm pt-4">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <BrainCircuit className="w-12 h-12 mb-4" />
                <p className="text-sm">No analysis available</p>
              </div>
            )}
          </div>

          {/* Footer - Re-analyze Button */}
          {!isAnalyzing && analysis && (
            <div className="border-t border-gray-800 p-3 bg-[#0A0A0A]">
              <button
                onClick={handleAnalyze}
                disabled={!sessionId}
                className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Re-analyze
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .writing-mode-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
};

export default ResearchAnalysisPanel;

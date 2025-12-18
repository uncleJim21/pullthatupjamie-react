import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Loader, BrainCircuit, AlertCircle, RotateCcw, BookText, History } from 'lucide-react';
import { analyzeResearchSession } from '../services/researchSessionAnalysisService.ts';
import { getCurrentSessionId, fetchAllResearchSessions, ResearchSession } from '../services/researchSessionService.ts';
import PodcastContextPanel from './PodcastContextPanel.tsx';
import { AuthConfig } from '../constants/constants.ts';
import { extractImageFromAny } from '../utils/hierarchyImageUtils.ts';

enum PanelMode {
  CONTEXT = 'context',
  ANALYSIS = 'analysis',
  SESSIONS = 'sessions'
}

interface UnifiedSidePanelProps {
  // Context panel props
  paragraphId: string | null;
  isContextOpen: boolean;
  onCloseContext: () => void;
  smartInterpolation?: boolean;
  onTimestampClick?: (timestamp: number) => void;
  onKeywordSearch?: (keyword: string, feedId?: string, episodeName?: string, forceSearchAll?: boolean) => void;
  auth?: AuthConfig;
  audioUrl?: string;
  episodeTitle?: string;
  episodeImage?: string;
  creator?: string;
  listenLink?: string;
  timeContext?: {
    start_time: number;
    end_time: number;
  };
  date?: string;
  autoPlayOnOpen?: boolean;
  
  // Analysis panel props
  isAnalysisOpen: boolean;
  onCloseAnalysis: () => void;
  sessionId?: string;
  
  // Sessions panel props
  isSessionsOpen: boolean;
  onCloseSessions: () => void;
  
  // Width callback for layout
  onWidthChange?: (width: number) => void;
}

const DEFAULT_INSTRUCTIONS = "Analyze this research session and summarize the main themes, key insights, and 3-5 follow-up questions.";

export const UnifiedSidePanel: React.FC<UnifiedSidePanelProps> = ({
  paragraphId,
  isContextOpen,
  onCloseContext,
  smartInterpolation,
  onTimestampClick,
  onKeywordSearch,
  auth,
  audioUrl,
  episodeTitle,
  episodeImage,
  creator,
  listenLink,
  timeContext,
  date,
  autoPlayOnOpen,
  isAnalysisOpen,
  onCloseAnalysis,
  sessionId: propSessionId,
  isSessionsOpen,
  onCloseSessions,
  onWidthChange
}) => {
  // Determine which mode is active
  const [activeMode, setActiveMode] = useState<PanelMode>(PanelMode.CONTEXT);
  const isPanelOpen = isContextOpen || isAnalysisOpen || isSessionsOpen;
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Analysis state
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions] = useState(DEFAULT_INSTRUCTIONS);
  const contentRef = useRef<HTMLDivElement>(null);
  const sessionId = propSessionId || getCurrentSessionId();
  
  // Sessions state
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  
  // Update active mode based on which panel is being opened from parent
  useEffect(() => {
    if (isContextOpen && !isAnalysisOpen && !isSessionsOpen) {
      setActiveMode(PanelMode.CONTEXT);
    } else if (isAnalysisOpen) {
      setActiveMode(PanelMode.ANALYSIS);
    } else if (isSessionsOpen) {
      setActiveMode(PanelMode.SESSIONS);
    }
  }, [isContextOpen, isAnalysisOpen, isSessionsOpen]);
  
  // Handle tab clicks - just switch mode, don't close anything
  const handleModeSwitch = (mode: PanelMode) => {
    setActiveMode(mode);
  };

  // Reset analysis when panel closes
  useEffect(() => {
    if (!isPanelOpen) {
      setAnalysis('');
      setError(null);
    }
  }, [isPanelOpen]);

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

  // Auto-analyze when analysis mode opens
  useEffect(() => {
    if (activeMode === PanelMode.ANALYSIS && isPanelOpen && !analysis && !isAnalyzing && !error && sessionId) {
      handleAnalyze();
    }
  }, [activeMode, isPanelOpen]);

  // Fetch sessions when sessions mode opens
  useEffect(() => {
    const loadSessions = async () => {
      if (activeMode === PanelMode.SESSIONS && isPanelOpen && sessions.length === 0 && !isLoadingSessions) {
        setIsLoadingSessions(true);
        setSessionsError(null);
        try {
          const allSessions = await fetchAllResearchSessions();
          setSessions(allSessions);
        } catch (err) {
          setSessionsError(err instanceof Error ? err.message : 'Failed to load sessions');
        } finally {
          setIsLoadingSessions(false);
        }
      }
    };
    void loadSessions();
  }, [activeMode, isPanelOpen]);

  // Parse the analysis into title and content
  const lines = analysis.split('\n');
  const titleLine = lines.find(line => line.trim().startsWith('TITLE:'));
  const title = titleLine ? titleLine.replace('TITLE:', '').trim() : '';
  const content = lines
    .filter(line => !line.trim().startsWith('TITLE:'))
    .join('\n')
    .trim();

  const isContextMode = activeMode === PanelMode.CONTEXT;
  const isAnalysisMode = activeMode === PanelMode.ANALYSIS;
  const isSessionsMode = activeMode === PanelMode.SESSIONS;

  // Calculate panel width including tabs
  const panelWidth = !isPanelOpen ? 0 : isCollapsed ? 32 : 600;
  const tabsWidth = isPanelOpen && !isCollapsed ? 60 : 0;
  const totalWidth = panelWidth + tabsWidth;

  // Report total width to parent
  useEffect(() => {
    onWidthChange?.(totalWidth);
  }, [totalWidth, onWidthChange]);

  const panelWidthClass = !isPanelOpen
    ? 'w-0 border-l-0'
    : isCollapsed
      ? 'w-[32px]'
      : 'w-[600px]';

  // Render single unified container with tabs always visible
  return (
    <div className="flex h-screen">
      {/* Folder-style tabs - ALWAYS visible when panel is open and not collapsed */}
      {isPanelOpen && !isCollapsed && (
        <div className="flex flex-col gap-1 pt-4 pr-0 bg-transparent">
          <button
            onClick={() => handleModeSwitch(PanelMode.CONTEXT)}
            className={`
              px-3 py-4 rounded-l-lg border-l border-t border-b transition-all
              ${isContextMode 
                ? 'bg-black border-gray-700 text-white -mr-[1px] z-20' 
                : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'
              }
            `}
            title="Context"
          >
            <BookText className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => handleModeSwitch(PanelMode.ANALYSIS)}
            disabled={true}
            className={`
              px-3 py-4 rounded-l-lg border-l border-t border-b transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isAnalysisMode 
                ? 'bg-black border-gray-700 text-white -mr-[1px] z-20' 
                : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'
              }
            `}
            title="AI Analysis (Coming Soon)"
          >
            <BrainCircuit className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => handleModeSwitch(PanelMode.SESSIONS)}
            className={`
              px-3 py-4 rounded-l-lg border-l border-t border-b transition-all
              ${isSessionsMode 
                ? 'bg-black border-gray-700 text-white -mr-[1px] z-20' 
                : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'
              }
            `}
            title="Sessions"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Panel Content - Context, Analysis, or Sessions */}
      {isContextMode ? (
        <PodcastContextPanel
          paragraphId={paragraphId}
          isOpen={isPanelOpen}
          onClose={onCloseContext}
          smartInterpolation={smartInterpolation}
          onTimestampClick={onTimestampClick}
          onKeywordSearch={onKeywordSearch}
          auth={auth}
          audioUrl={audioUrl}
          episodeTitle={episodeTitle}
          episodeImage={episodeImage}
          creator={creator}
          listenLink={listenLink}
          timeContext={timeContext}
          date={date}
          autoPlayOnOpen={autoPlayOnOpen}
          onWidthChange={() => {}} // We handle width reporting at the wrapper level
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      ) : isAnalysisMode ? (
        // Analysis Panel - matching PodcastContextPanel structure exactly
        <div
          className={`sticky top-0 h-screen bg-black border-l border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${panelWidthClass} overflow-hidden flex-shrink-0`}
        >
          {/* Collapsed State - Tab */}
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="flex items-center justify-center h-full hover:bg-gray-900 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Expand panel"
              disabled={true}
            >
              <div className="flex flex-col items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                <div
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  className="text-xs text-gray-800 group-hover:text-white transition-colors whitespace-nowrap"
                >
                  AI Analysis
                </div>
              </div>
            </button>
          ) : (
            /* Expanded State - Full Panel matching PodcastContextPanel structure */
            <div className="flex-1 flex overflow-hidden">
              {/* Left Side - Main Content */}
              <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
                <div className="p-3 border-b border-gray-800 bg-[#0A0A0A]">
                  <h3 className="text-sm font-medium text-gray-400">AI Analysis</h3>
                </div>

                <div ref={contentRef} className="flex-1 overflow-y-auto p-4">
                  {!sessionId ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <BrainCircuit className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-sm text-center px-8">
                        Add items to your research session to perform AI analysis
                      </p>
                      <p className="text-xs text-gray-600 text-center px-8 mt-2">
                        Right-click stars in the galaxy and select "Add to Research"
                      </p>
                    </div>
                  ) : error ? (
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
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
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
                      <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
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
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <BrainCircuit className="w-12 h-12 mb-4" />
                      <p className="text-sm mb-4">No analysis available</p>
                      <button
                        onClick={handleAnalyze}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                      >
                        Analyze Session
                      </button>
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

              {/* Right Side - Close/Collapse Controls */}
              <div className="w-[40px] bg-[#0A0A0A] border-l border-gray-800 flex flex-col items-center py-3">
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="text-gray-400 hover:text-white transition-colors mb-2"
                  aria-label="Collapse panel"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Sessions Panel - matching the same structure
        <div
          className={`sticky top-0 h-screen bg-black border-l border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${panelWidthClass} overflow-hidden flex-shrink-0`}
        >
          {/* Collapsed State - Tab */}
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="flex items-center justify-center h-full hover:bg-gray-900 transition-colors group"
              aria-label="Expand panel"
            >
              <div className="flex flex-col items-center gap-2">
                <History className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                <div
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  className="text-xs text-gray-400 group-hover:text-white transition-colors whitespace-nowrap"
                >
                  Sessions
                </div>
              </div>
            </button>
          ) : (
            /* Expanded State - Full Panel */
            <div className="flex-1 flex overflow-hidden">
              {/* Left Side - Main Content */}
              <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
                <div className="p-3 border-b border-gray-800 bg-[#0A0A0A]">
                  <h3 className="text-sm font-medium text-gray-400">Research Sessions</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {isLoadingSessions ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <Loader className="w-8 h-8 animate-spin mb-4" />
                      <p className="text-sm">Loading sessions...</p>
                    </div>
                  ) : sessionsError ? (
                    <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium mb-1 text-sm">Error Loading Sessions</div>
                          <div className="text-xs">{sessionsError}</div>
                        </div>
                      </div>
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <History className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-sm text-center px-8">
                        No research sessions yet
                      </p>
                      <p className="text-xs text-gray-600 text-center px-8 mt-2">
                        Start adding items to create your first session
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map((session) => {
                        const metadata = session.lastItemMetadata;
                        const itemCount = session.pineconeIdsCount || session.pineconeIds?.length || 0;
                        const createdDate = session.createdAt ? new Date(session.createdAt).toLocaleDateString() : '';
                        
                        // Use helper to extract image with fallback chain
                        const sessionImage = metadata ? extractImageFromAny(metadata) : undefined;
                        
                        return (
                          <div
                            key={session.id}
                            className="flex items-center gap-3 p-3 bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800 rounded-lg transition-all cursor-pointer"
                          >
                            {/* Episode Image */}
                            <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-800">
                              {sessionImage ? (
                                <img
                                  src={sessionImage}
                                  alt={metadata?.episode || 'Session'}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <History className="w-6 h-6 text-gray-600" />
                                </div>
                              )}
                            </div>

                            {/* Session Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium line-clamp-1">
                                {metadata?.title || metadata?.episode || 'Research Session'}
                              </p>
                              <p className="text-xs text-gray-500 line-clamp-1">
                                {metadata?.creator || 'Unknown creator'} • {itemCount} {itemCount === 1 ? 'item' : 'items'}
                              </p>
                              {createdDate && (
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {createdDate}
                                </p>
                              )}
                            </div>

                            {/* Open Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Open session:', session.id);
                                // TODO: Implement open session functionality
                              }}
                              className="px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-gray-200 transition-colors flex-shrink-0"
                            >
                              Open
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Close/Collapse Controls */}
              <div className="w-[40px] bg-[#0A0A0A] border-l border-gray-800 flex flex-col items-center py-3">
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="text-gray-400 hover:text-white transition-colors mb-2"
                  aria-label="Collapse panel"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedSidePanel;

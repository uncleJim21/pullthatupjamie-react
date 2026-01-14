import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, ChevronUp, Loader, BrainCircuit, AlertCircle, RotateCcw, BookText, History, Bot, Link as LinkIcon, Settings2, TextSearch, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { analyzeAdHocResearch, analyzeResearchSession } from '../services/researchSessionAnalysisService.ts';
import { getCurrentSessionId, fetchAllResearchSessions, ResearchSession } from '../services/researchSessionService.ts';
import PodcastContextPanel from './PodcastContextPanel.tsx';
import { AuthConfig, printLog } from '../constants/constants.ts';
import { extractImageFromAny } from '../utils/hierarchyImageUtils.ts';

type AnalysisCardJson = {
  pineconeId: string;
  episodeImage?: string;
  title?: string;
};

type ParsedAnalysisPart =
  | { kind: 'text'; text: string }
  | { kind: 'card'; card: AnalysisCardJson }
  | { kind: 'card_loading' };

function parseCardJsonMentions(input: string): ParsedAnalysisPart[] {
  const parts: ParsedAnalysisPart[] = [];

  let i = 0;
  while (i < input.length) {
    const markerIdx = input.indexOf('CARD_JSON:', i);
    if (markerIdx === -1) {
      parts.push({ kind: 'text', text: input.slice(i) });
      break;
    }

    // push text before marker
    if (markerIdx > i) {
      parts.push({ kind: 'text', text: input.slice(i, markerIdx) });
    }

    // find JSON object after marker
    const braceStart = input.indexOf('{', markerIdx);
    if (braceStart === -1) {
      // We have the marker but not the JSON yet (streaming). Show a loading placeholder.
      parts.push({ kind: 'card_loading' });
      break;
    }

    let depth = 0;
    let j = braceStart;
    for (; j < input.length; j++) {
      const ch = input[j];
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          j++; // include closing brace
          break;
        }
      }
    }

    // If we hit end of input without closing braces, we're mid-stream; show loading.
    if (depth !== 0) {
      parts.push({ kind: 'card_loading' });
      break;
    }

    const jsonText = input.slice(braceStart, j);
    try {
      const parsed = JSON.parse(jsonText) as AnalysisCardJson;
      if (parsed && typeof parsed.pineconeId === 'string') {
        parts.push({ kind: 'card', card: parsed });
      } else {
        parts.push({ kind: 'text', text: `CARD_JSON: ${jsonText}` });
      }
    } catch {
      // If JSON is malformed (rare, but could happen mid-stream), render loading.
      parts.push({ kind: 'card_loading' });
      break;
    }

    i = j;
  }

  return parts;
}

function buildMarkdownWithCardPlaceholders(input: string): {
  markdown: string;
  cardsByIndex: Record<number, AnalysisCardJson>;
} {
  const parts = parseCardJsonMentions(input);
  const cardsByIndex: Record<number, AnalysisCardJson> = {};
  let cardIdx = 0;

  const chunks: string[] = [];
  for (const p of parts) {
    if (p.kind === 'text') {
      chunks.push(p.text);
      continue;
    }

    // Keep citations inline: if the model put the CARD_JSON on its own line, trim that whitespace.
    if (chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      if (typeof last === 'string') {
        chunks[chunks.length - 1] = last.replace(/\s+$/, ' ');
      }
    }

    if (p.kind === 'card_loading') {
      chunks.push(`[[CARD_LOADING:${cardIdx++}]]`);
      continue;
    }

    const idx = cardIdx++;
    cardsByIndex[idx] = p.card;
    chunks.push(`[[CARD:${idx}]]`);
  }

  return { markdown: chunks.join(''), cardsByIndex };
}

function injectInlineTokens(
  node: React.ReactNode,
  cardsByIndex: Record<number, AnalysisCardJson>,
  onCardClick: (pineconeId: string) => void
): React.ReactNode {
  const tokenRe = /\[\[(CARD|CARD_LOADING):(\d+)\]\]/g;

  if (typeof node === 'string') {
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(node)) !== null) {
      const [full, kind, idxStr] = m;
      const idx = Number(idxStr);
      const start = m.index;
      if (start > last) out.push(node.slice(last, start));
      if (kind === 'CARD_LOADING') {
        out.push(<InlineCardMentionLoading key={`l-${idx}-${start}`} />);
      } else {
        const card = cardsByIndex[idx];
        if (card) {
          out.push(
            <InlineCardMention
              key={`c-${idx}-${start}`}
              card={card}
              onClick={onCardClick}
            />
          );
        } else {
          out.push(full);
        }
      }
      last = start + full.length;
    }
    if (last < node.length) out.push(node.slice(last));
    return out.length === 1 ? out[0] : out;
  }

  if (Array.isArray(node)) {
    return node.map((child, i) =>
      injectInlineTokens(child, cardsByIndex, onCardClick) as any
    );
  }

  if (React.isValidElement(node)) {
    const children = (node.props as any)?.children;
    if (!children) return node;
    return React.cloneElement(node as any, {
      ...(node.props as any),
      children: injectInlineTokens(children, cardsByIndex, onCardClick),
    });
  }

  return node;
}

function isCardOnlyParagraphContent(node: React.ReactNode): boolean {
  // After injection, a "card-only" paragraph tends to look like:
  // [" ", <InlineCardMention ... />, " "] (possibly with newlines/spaces)
  const isWhitespace = (x: unknown) => typeof x === 'string' && x.trim() === '';

  if (React.isValidElement(node)) {
    const t = (node.type as any);
    return t === InlineCardMention || t === InlineCardMentionLoading;
  }

  if (Array.isArray(node)) {
    const filtered = node.filter((n) => !isWhitespace(n));
    return (
      filtered.length === 1 &&
      React.isValidElement(filtered[0]) &&
      (((filtered[0] as any).type === InlineCardMention) || ((filtered[0] as any).type === InlineCardMentionLoading))
    );
  }

  return false;
}

const InlineCardMentionLoading: React.FC = () => {
  return (
    <span
      className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-gray-800 bg-gray-900/30 align-middle select-none max-w-[220px]"
      aria-label="Loading source card"
    >
      <span className="w-[14px] h-[14px] rounded-sm bg-gray-800 flex items-center justify-center flex-shrink-0">
        <Loader className="w-3 h-3 text-gray-500 animate-spin" />
      </span>
      <span className="text-xs text-gray-400 truncate">Loading…</span>
    </span>
  );
};

const InlineCardMention: React.FC<{
  card: AnalysisCardJson;
  onClick?: (pineconeId: string) => void;
}> = ({ card, onClick }) => {
  const title = card.title || 'Open source';
  const imageUrl = card.episodeImage;

  return (
    <span
      className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-gray-800 bg-gray-900/40 align-middle cursor-pointer hover:bg-gray-900/70 transition-colors max-w-[420px]"
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(card.pineconeId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(card.pineconeId);
        }
      }}
      title={title}
      aria-label={`Open source: ${title}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="w-[14px] h-[14px] rounded-sm object-cover flex-shrink-0 opacity-90"
          loading="lazy"
        />
      ) : (
        <span className="w-[14px] h-[14px] rounded-sm bg-gray-800 flex items-center justify-center flex-shrink-0">
          <LinkIcon className="w-3 h-3 text-gray-500" />
        </span>
      )}
      <span className="text-xs text-gray-200 truncate">{title}</span>
    </span>
  );
};

enum PanelMode {
  CONTEXT = 'context',
  ANALYSIS = 'analysis',
  SESSIONS = 'sessions'
}

interface UnifiedSidePanelProps {
  layoutMode?: 'side' | 'bottom';
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
  onOpenSession?: (sessionId: string, sessionTitle?: string) => void;
  
  // Width callback for layout
  onWidthChange?: (width: number) => void;

  // AI Analysis: current on-screen results (used for "Current Search" analysis mode)
  currentSearchResults?: any[];

  // Research session controls (for Context panel "add to research" toggle)
  researchSessionShareLinks?: string[];
  onAddToResearch?: (result: any) => void;
  onRemoveFromResearch?: (shareLink: string) => void;
}

const DEFAULT_INSTRUCTIONS = "Analyze this research session and summarize the main themes, key insights, and definitive conclusion. Keep it succinct and to the point no more than a few sentences when focus is on a single episode. You can take a bit more liberty when talking about common themes or disagreements. Don't explicitly mention the word research session.";

export const UnifiedSidePanel: React.FC<UnifiedSidePanelProps> = ({
  layoutMode = 'side',
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
  onOpenSession,
  onWidthChange,
  currentSearchResults,
  researchSessionShareLinks,
  onAddToResearch,
  onRemoveFromResearch
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

  type AnalysisSource = 'current_search' | 'compiled_session';
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource | null>(() => {
    try {
      const raw = localStorage.getItem('userSettings');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const v = parsed?.aiAnalysisSource;
      return v === 'current_search' || v === 'compiled_session' ? v : null;
    } catch {
      return null;
    }
  });
  const [showAnalysisSourceChooser, setShowAnalysisSourceChooser] = useState(false);
  const [showAnalysisModeChooser, setShowAnalysisModeChooser] = useState(true);

  const persistAnalysisSource = (source: AnalysisSource) => {
    try {
      const raw = localStorage.getItem('userSettings');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.aiAnalysisSource = source;
      localStorage.setItem('userSettings', JSON.stringify(parsed));
    } catch (e) {
      // If localStorage/userSettings is corrupted, overwrite with a minimal object
      localStorage.setItem('userSettings', JSON.stringify({ aiAnalysisSource: source }));
    }
    setAnalysisSource(source);
  };
  
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
      setShowAnalysisSourceChooser(false);
      setShowAnalysisModeChooser(true);
    }
  }, [isPanelOpen]);

  const handleAnalyze = async (overrideSource?: AnalysisSource) => {
    const effectiveSource = overrideSource || analysisSource;
    if (!effectiveSource) {
      setShowAnalysisSourceChooser(true);
      return;
    }

    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    if (effectiveSource === 'current_search') {
      for (const r of currentSearchResults || []) {
        const id = (r as any)?.shareLink || (r as any)?.id;
        if (typeof id === 'string' && id && !seen.has(id)) {
          uniqueIds.push(id);
          seen.add(id);
          if (uniqueIds.length >= 50) break;
        }
      }
      if (uniqueIds.length === 0) {
        setError('No current search results to analyze.');
        return;
      }
    } else {
      if (!sessionId) {
        setError('No research session found. Please save your session first.');
        return;
      }
    }

    const compiledSessionId = sessionId || undefined;
    printLog(
      `[AI Analysis] AnalyzeNow clicked: source=${effectiveSource} sessionId=${sessionId || 'null'} ids=${uniqueIds.length} instructionsLen=${instructions.length}`,
    );
    setIsAnalyzing(true);
    setError(null);
    setAnalysis('');

    const onChunk = (chunk: string) => {
      setAnalysis(prev => prev + chunk);
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    };

    const result = effectiveSource === 'current_search'
      ? await analyzeAdHocResearch(uniqueIds, instructions, onChunk)
      : await analyzeResearchSession(compiledSessionId as string, instructions, onChunk);

    setIsAnalyzing(false);

    if (!result.success) {
      setError(result.error || 'Analysis failed');
    }
  };

  // No auto-analyze on open; user triggers analysis explicitly from UI.

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

  // Debug: log whenever we enter analysis mode (and what sessionId is)
  useEffect(() => {
    if (activeMode === PanelMode.ANALYSIS && isPanelOpen) {
      printLog(`[AI Analysis] Tab active: sessionId=${sessionId || 'null'} analysisLen=${analysis.length}`);
    }
  }, [activeMode, isPanelOpen, sessionId, analysis.length]);

  const effectiveAnalysisSource = analysisSource;
  const effectiveSourceLabel =
    effectiveAnalysisSource === 'current_search'
      ? 'Current Search'
      : effectiveAnalysisSource === 'compiled_session'
        ? 'Compiled Session'
        : null;

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
  const isBottomLayout = layoutMode === 'bottom';

  // Bottom-sheet state (mobile / narrow layout): shown by default when a panel is open.
  type SheetMode = 'peek' | 'full' | 'dock';
  const [sheetMode, setSheetMode] = useState<SheetMode>('peek');

  // If the app opens the panel (e.g. auto-select on search), ensure the sheet is visible.
  useEffect(() => {
    if (!isBottomLayout) return;
    if (isPanelOpen && sheetMode === 'dock') {
      setSheetMode('peek');
    }
  }, [isBottomLayout, isPanelOpen, sheetMode]);

  // In bottom layout, width is irrelevant; never push/offset the main content.
  useEffect(() => {
    if (!isBottomLayout) return;
    onWidthChange?.(0);
  }, [isBottomLayout, onWidthChange]);

  const closeAllPanels = () => {
    onCloseContext();
    onCloseAnalysis();
    onCloseSessions();
  };

  if (isBottomLayout) {
    // If nothing is open, hide the sheet entirely (consistent with existing open/close state).
    if (!isPanelOpen) {
      return null;
    }

    const sheetHeight = sheetMode === 'full' ? '92vh' : sheetMode === 'peek' ? '60vh' : '44px';

    return (
      <div className="fixed left-0 right-0 bottom-0 z-[70]">
        <div
          className="bg-black border-t border-gray-800 rounded-t-xl shadow-2xl overflow-hidden"
          style={{
            height: sheetHeight,
            transition: 'height 240ms ease',
          }}
        >
          {/* Sheet header: handle + tabs + controls */}
          <div className="border-b border-gray-800 bg-[#0A0A0A]">
            <div className="flex items-center justify-between px-3 pt-2 pb-1 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-1 w-10 rounded-full bg-gray-700/70" aria-hidden="true" />
              </div>

              {/* Right-side controls are aligned with the tabs row below */}
              <div className="w-8" />
            </div>

            {/* Tabs + controls row */}
            <div className="flex items-end justify-between px-3 pb-2 gap-2">
              <div className="flex items-end gap-1 overflow-x-auto max-w-[75%] min-w-0">
                <button
                  onClick={() => handleModeSwitch(PanelMode.CONTEXT)}
                  className={`flex-shrink-0 px-3 py-2 rounded-t-md text-xs font-medium border transition-colors ${
                    isContextMode
                      ? 'bg-black text-white border-gray-700'
                      : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-900/70'
                  }`}
                  aria-label="Context"
                  title="Context"
                >
                  <BookText className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleModeSwitch(PanelMode.ANALYSIS)}
                  className={`flex-shrink-0 px-3 py-2 rounded-t-md text-xs font-medium border transition-colors ${
                    isAnalysisMode
                      ? 'bg-black text-white border-gray-700'
                      : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-900/70'
                  }`}
                  aria-label="AI Analysis"
                  title="AI Analysis"
                >
                  <BrainCircuit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleModeSwitch(PanelMode.SESSIONS)}
                  className={`flex-shrink-0 px-3 py-2 rounded-t-md text-xs font-medium border transition-colors ${
                    isSessionsMode
                      ? 'bg-black text-white border-gray-700'
                      : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-900/70'
                  }`}
                  aria-label="Sessions"
                  title="Sessions"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>

              {/* Controls (right side) */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setSheetMode((prev) => (prev === 'full' ? 'peek' : 'full'))}
                  className="p-1.5 text-gray-400 hover:text-white border border-gray-800 rounded-md hover:bg-gray-900 transition-colors"
                  aria-label={sheetMode === 'full' ? 'Shrink panel' : 'Expand panel'}
                  title={sheetMode === 'full' ? 'Shrink' : 'Expand'}
                >
                  {sheetMode === 'full' ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setSheetMode((prev) => (prev === 'dock' ? 'peek' : 'dock'))}
                  className="p-1.5 text-gray-400 hover:text-white border border-gray-800 rounded-md hover:bg-gray-900 transition-colors"
                  aria-label={sheetMode === 'dock' ? 'Undock panel' : 'Dock panel down'}
                  title={sheetMode === 'dock' ? 'Undock' : 'Dock'}
                >
                  {sheetMode === 'dock' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="h-full min-h-0 overflow-hidden flex flex-col">
            {isContextMode ? (
              <div className="h-full min-h-0">
                <PodcastContextPanel
                  layoutMode="bottom"
                  paragraphId={paragraphId}
                  isOpen={true}
                  onClose={() => {
                    onCloseContext();
                    setSheetMode('dock');
                  }}
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
                  onWidthChange={() => {}}
                  researchSessionShareLinks={researchSessionShareLinks}
                  onAddToResearch={onAddToResearch}
                  onRemoveFromResearch={onRemoveFromResearch}
                />
              </div>
            ) : isAnalysisMode ? (
              <div className="h-full bg-black flex flex-col overflow-hidden">
                {/* Header (bottom-sheet variant) */}
                <div className="p-3 border-b border-gray-800 bg-[#0A0A0A] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-medium text-gray-400">AI Analysis (Beta)</h3>
                    {effectiveSourceLabel && (
                      <span className="text-[11px] text-gray-600 truncate">• {effectiveSourceLabel}</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowAnalysisModeChooser(false);
                      setShowAnalysisSourceChooser(true);
                    }}
                    className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-900"
                    aria-label="Choose what to analyze"
                    title="Choose what to analyze"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>

                <div ref={contentRef} className="flex-1 overflow-y-auto p-4">
                  {showAnalysisSourceChooser ? (
                    <div className="max-w-xl w-full pt-6 text-gray-200">
                      <div className="space-y-4">
                        <div className="text-lg font-semibold text-white">Choose What to Analyze</div>

                        <button
                          onClick={() => {
                            persistAnalysisSource('current_search');
                            setShowAnalysisSourceChooser(false);
                            void handleAnalyze('current_search');
                          }}
                          disabled={isAnalyzing}
                          className="w-full p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <TextSearch className="w-4 h-4 text-blue-400" />
                            <span>Current Search (Recommended)</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">Analyze the items currently on screen</div>
                        </button>

                        <button
                          onClick={() => {
                            persistAnalysisSource('compiled_session');
                            setShowAnalysisSourceChooser(false);
                            void handleAnalyze('compiled_session');
                          }}
                          disabled={isAnalyzing}
                          className="w-full p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Layers className="w-4 h-4 text-gray-300" />
                            <span>Compiled Session</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">Analyze the items you compiled into your current session</div>
                        </button>
                      </div>
                    </div>
                  ) : effectiveAnalysisSource === 'compiled_session' && !sessionId ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <BrainCircuit className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-sm text-center px-8">
                        Add items to your research session to perform AI analysis
                      </p>
                      <p className="text-xs text-gray-600 text-center px-8 mt-2">
                        Long-press stars in the galaxy and select "Add to Research"
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
                      <div className="text-sm text-gray-300 leading-relaxed">
                        {(() => {
                          const { markdown, cardsByIndex } = buildMarkdownWithCardPlaceholders(content);
                          const onCardClick = (pineconeId: string) => {
                            printLog(`[AI Analysis] Card click: pineconeId=${pineconeId}`);
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(
                                new CustomEvent('analysisCardClick', { detail: { pineconeId } }),
                              );
                            }
                          };

                          return (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              components={{
                                p: ({ children }) => {
                                  const injected = injectInlineTokens(children, cardsByIndex, onCardClick);
                                  const isCardOnly = isCardOnlyParagraphContent(injected);
                                  return <p className={isCardOnly ? 'my-1' : 'my-2'}>{injected}</p>;
                                },
                                ul: ({ children }) => <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>,
                                li: ({ children }) => (
                                  <li className="my-1">{injectInlineTokens(children, cardsByIndex, onCardClick)}</li>
                                ),
                                strong: ({ children }) => <strong>{injectInlineTokens(children, cardsByIndex, onCardClick)}</strong>,
                                em: ({ children }) => <em>{injectInlineTokens(children, cardsByIndex, onCardClick)}</em>,
                                h1: ({ children }) => <h1 className="text-2xl font-bold text-white my-2">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xl font-bold text-white my-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-lg font-semibold text-white my-2">{children}</h3>,
                              }}
                            >
                              {markdown}
                            </ReactMarkdown>
                          );
                        })()}
                      </div>
                      {isAnalyzing && (
                        <div className="flex items-center gap-2 text-blue-400 text-sm pt-4">
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Generating...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col h-full text-gray-200">
                      <div className="max-w-xl w-full pt-6">
                        {showAnalysisModeChooser ? (
                          <>
                            <div className="mb-2 text-lg font-semibold text-white">AI Analysis</div>
                            <div className="text-sm text-gray-400 mb-6">
                              Turn your saved podcast clips into key themes, takeaways, and next questions.
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => {
                                  setShowAnalysisModeChooser(false);
                                  if (!analysisSource) {
                                    setShowAnalysisSourceChooser(true);
                                    return;
                                  }
                                  void handleAnalyze();
                                }}
                                disabled={isAnalyzing}
                                className="p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                              >
                                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                                  <BrainCircuit className="w-4 h-4 text-blue-400" />
                                  <span>Analyze</span>
                                </div>
                                <div className="text-xs text-gray-400">
                                  Use an LLM to summarize and expand on your selected source
                                </div>
                              </button>

                              <button
                                disabled={true}
                                className="p-4 rounded-lg border border-gray-800 bg-gray-950/40 opacity-60 cursor-not-allowed text-left"
                              >
                                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                                  <Bot className="w-4 h-4 text-gray-400" />
                                  <span>Agent Mode (Soon™)</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Use an Agent to perform searches, sift through content and explain high signal content related to your research intent
                                </div>
                              </button>
                            </div>
                          </>
                        ) : (!effectiveAnalysisSource || showAnalysisSourceChooser) ? (
                          <div className="space-y-4">
                            <div className="text-lg font-semibold text-white">Choose What to Analyze</div>

                            <button
                              onClick={() => {
                                persistAnalysisSource('current_search');
                                setShowAnalysisSourceChooser(false);
                                void handleAnalyze('current_search');
                              }}
                              disabled={isAnalyzing}
                              className="w-full p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <TextSearch className="w-4 h-4 text-blue-400" />
                                <span>Current Search (Recommended)</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">Analyze the items currently on screen</div>
                            </button>

                            <button
                              onClick={() => {
                                persistAnalysisSource('compiled_session');
                                setShowAnalysisSourceChooser(false);
                                void handleAnalyze('compiled_session');
                              }}
                              disabled={isAnalyzing}
                              className="w-full p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <Layers className="w-4 h-4 text-gray-300" />
                                <span>Compiled Session</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">Analyze the items you compiled into your current session</div>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="mb-2 text-lg font-semibold text-white">AI Analysis (Beta)</div>
                            <div className="text-sm text-gray-400 mb-1">
                              Turn your saved podcast clips into key themes, takeaways, and next questions.
                            </div>
                            <div className="text-xs text-gray-600 mb-6">(ChatGPT 4o-mini)</div>

                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => void handleAnalyze()}
                                disabled={
                                  isAnalyzing ||
                                  (effectiveAnalysisSource === 'compiled_session' ? !sessionId : false)
                                }
                                className="p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                              >
                                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                                  <BrainCircuit className="w-4 h-4 text-blue-400" />
                                  <span>Analyze Now</span>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {effectiveAnalysisSource === 'current_search'
                                    ? 'Use an LLM to summarize and expand on the items currently on screen'
                                    : 'Use an LLM to summarize and expand on your compiled research'}
                                </div>
                              </button>

                              <button
                                disabled={true}
                                className="p-4 rounded-lg border border-gray-800 bg-gray-950/40 opacity-60 cursor-not-allowed text-left"
                              >
                                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                                  <Bot className="w-4 h-4 text-gray-400" />
                                  <span>Agent Mode (Soon™)</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Use an Agent to perform searches, sift through content and explain high signal content related to your research intent
                                </div>
                              </button>
                            </div>

                            <div className="mt-6 text-xs text-gray-600">
                              Session ID: <span className="text-gray-500">{sessionId || 'none'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!isAnalyzing && analysis && (
                  <div className="border-t border-gray-800 p-3 bg-[#0A0A0A]">
                    <button
                      onClick={() => void handleAnalyze()}
                      disabled={!sessionId && effectiveAnalysisSource === 'compiled_session'}
                      className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Re-analyze
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full">
                {/* Sessions tab content is already self-contained; keep behavior consistent */}
                <div className="h-full bg-black flex flex-col overflow-hidden">
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
                        <p className="text-sm text-center px-8">No research sessions yet</p>
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
                          const sessionImage = metadata ? extractImageFromAny(metadata) : undefined;
                          const displayTitle =
                            session.title || metadata?.title || metadata?.headline || metadata?.episode || 'Research Session';

                          return (
                            <div
                              key={session.id}
                              className="flex items-center gap-3 p-3 bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800 rounded-lg transition-all cursor-pointer"
                            >
                              <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-800">
                                {sessionImage ? (
                                  <img
                                    src={sessionImage}
                                    alt={displayTitle}
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

                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium line-clamp-1">{displayTitle}</p>
                                <p className="text-xs text-gray-500 line-clamp-1">
                                  {metadata?.creator || 'Unknown creator'} • {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                </p>
                                {createdDate && (
                                  <p className="text-xs text-gray-600 mt-0.5">{createdDate}</p>
                                )}
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenSession && session.id) {
                                    onOpenSession(session.id, displayTitle);
                                  }
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
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
            disabled={false}
            className={`
              px-3 py-4 rounded-l-lg border-l border-t border-b transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isAnalysisMode 
                ? 'bg-black border-gray-700 text-white -mr-[1px] z-20' 
                : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'
              }
            `}
            title="AI Analysis (Beta)"
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
          researchSessionShareLinks={researchSessionShareLinks}
          onAddToResearch={onAddToResearch}
          onRemoveFromResearch={onRemoveFromResearch}
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
              className="flex items-center justify-center h-full hover:bg-gray-900 transition-colors group"
              aria-label="Expand panel"
            >
                <div className="flex flex-col items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                <div
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  className="text-xs text-gray-400 group-hover:text-white transition-colors whitespace-nowrap"
                >
                  AI Analysis (Beta)
                </div>
              </div>
            </button>
          ) : (
            /* Expanded State - Full Panel matching PodcastContextPanel structure */
            <div className="flex-1 flex overflow-hidden">
              {/* Left Side - Main Content */}
              <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
                <div className="p-3 border-b border-gray-800 bg-[#0A0A0A] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-medium text-gray-400">AI Analysis (Beta)</h3>
                    {effectiveSourceLabel && (
                      <span className="text-[11px] text-gray-600 truncate">• {effectiveSourceLabel}</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      // Always allow reopening the analysis source chooser.
                      setShowAnalysisModeChooser(false);
                      setShowAnalysisSourceChooser(true);
                    }}
                    className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-900"
                    aria-label="Choose what to analyze"
                    title="Choose what to analyze"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>

                <div ref={contentRef} className="flex-1 overflow-y-auto p-4">
                  {showAnalysisSourceChooser ? (
                    <div className="max-w-xl w-full pt-6 text-gray-200">
                      <div className="space-y-4">
                        <div className="text-lg font-semibold text-white">Choose What to Analyze</div>

                        <button
                          onClick={() => {
                            persistAnalysisSource('current_search');
                            setShowAnalysisSourceChooser(false);
                            // Move directly into the analysis phase
                            void handleAnalyze('current_search');
                          }}
                          disabled={isAnalyzing}
                          className="w-full p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <TextSearch className="w-4 h-4 text-blue-400" />
                            <span>Current Search (Recommended)</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Analyze the items currently on screen
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            persistAnalysisSource('compiled_session');
                            setShowAnalysisSourceChooser(false);
                            // Move directly into the analysis phase
                            void handleAnalyze('compiled_session');
                          }}
                          disabled={isAnalyzing}
                          className="w-full p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Layers className="w-4 h-4 text-gray-300" />
                            <span>Compiled Session</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Analyze the items you compiled into your current session
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : effectiveAnalysisSource === 'compiled_session' && !sessionId ? (
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
                      <div className="text-sm text-gray-300 leading-relaxed">
                        {(() => {
                          const { markdown, cardsByIndex } = buildMarkdownWithCardPlaceholders(content);
                          const onCardClick = (pineconeId: string) => {
                            printLog(`[AI Analysis] Card click: pineconeId=${pineconeId}`);
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(
                                new CustomEvent('analysisCardClick', { detail: { pineconeId } }),
                              );
                            }
                          };

                          return (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              components={{
                                // Inject our inline chips anywhere placeholders appear, without breaking markdown structure.
                                p: ({ children }) => {
                                  const injected = injectInlineTokens(children, cardsByIndex, onCardClick);
                                  const isCardOnly = isCardOnlyParagraphContent(injected);
                                  // Keep markdown spacing tight; especially for citation-only paragraphs.
                                  return (
                                    <p className={isCardOnly ? 'my-1' : 'my-2'}>
                                      {injected}
                                    </p>
                                  );
                                },
                                ul: ({ children }) => <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>,
                                li: ({ children }) => (
                                  <li className="my-1">
                                    {injectInlineTokens(children, cardsByIndex, onCardClick)}
                                  </li>
                                ),
                                strong: ({ children }) => <strong>{injectInlineTokens(children, cardsByIndex, onCardClick)}</strong>,
                                em: ({ children }) => <em>{injectInlineTokens(children, cardsByIndex, onCardClick)}</em>,
                                h1: ({ children }) => <h1 className="text-2xl font-bold text-white my-2">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xl font-bold text-white my-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-lg font-semibold text-white my-2">{children}</h3>,
                              }}
                            >
                              {markdown}
                            </ReactMarkdown>
                          );
                        })()}
                      </div>
                      {isAnalyzing && (
                        <div className="flex items-center gap-2 text-blue-400 text-sm pt-4">
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Generating...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col h-full text-gray-200">
                      <div className="max-w-xl w-full pt-6">
                        {showAnalysisModeChooser ? (
                          <>
                            <div className="mb-2 text-lg font-semibold text-white">AI Analysis</div>
                            <div className="text-sm text-gray-400 mb-6">
                              Turn your saved podcast clips into key themes, takeaways, and next questions.
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => {
                                  setShowAnalysisModeChooser(false);
                                  // Step 3: choose source (or run immediately if already chosen)
                                  if (!analysisSource) {
                                    setShowAnalysisSourceChooser(true);
                                    return;
                                  }
                                  void handleAnalyze();
                                }}
                                disabled={isAnalyzing}
                                className="p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                              >
                                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                                  <BrainCircuit className="w-4 h-4 text-blue-400" />
                                  <span>Analyze</span>
                                </div>
                                <div className="text-xs text-gray-400">
                                  Use an LLM to summarize and expand on your selected source
                                </div>
                              </button>

                              <button
                                disabled={true}
                                className="p-4 rounded-lg border border-gray-800 bg-gray-950/40 opacity-60 cursor-not-allowed text-left"
                              >
                                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                                  <Bot className="w-4 h-4 text-gray-400" />
                                  <span>Agent Mode (Soon™)</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Use an Agent to perform searches, sift through content and explain high signal content related to your research intent
                                </div>
                              </button>
                            </div>
                          </>
                        ) : (!effectiveAnalysisSource || showAnalysisSourceChooser) ? (
                          <div className="space-y-4">
                            <div className="text-lg font-semibold text-white">Choose What to Analyze</div>

                            <button
                              onClick={() => {
                                persistAnalysisSource('current_search');
                                setShowAnalysisSourceChooser(false);
                                void handleAnalyze('current_search');
                              }}
                              disabled={isAnalyzing}
                              className="w-full p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <TextSearch className="w-4 h-4 text-blue-400" />
                                <span>Current Search (Recommended)</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Analyze the items currently on screen
                              </div>
                            </button>

                            <button
                              onClick={() => {
                                persistAnalysisSource('compiled_session');
                                setShowAnalysisSourceChooser(false);
                                void handleAnalyze('compiled_session');
                              }}
                              disabled={isAnalyzing}
                              className="w-full p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <Layers className="w-4 h-4 text-gray-300" />
                                <span>Compiled Session</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Analyze the items you compiled into your current session
                              </div>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="mb-2 text-lg font-semibold text-white">AI Analysis (Beta)</div>
                            <div className="text-sm text-gray-400 mb-1">
                              Turn your saved podcast clips into key themes, takeaways, and next questions.
                            </div>
                            <div className="text-xs text-gray-600 mb-6">
                              (ChatGPT 4o-mini)
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => void handleAnalyze()}
                            disabled={
                              isAnalyzing ||
                              (effectiveAnalysisSource === 'compiled_session' ? !sessionId : false)
                            }
                            className="p-4 rounded-lg border border-gray-700 bg-gray-900/40 hover:bg-gray-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                              <BrainCircuit className="w-4 h-4 text-blue-400" />
                              <span>Analyze Now</span>
                            </div>
                            <div className="text-xs text-gray-400">
                              {effectiveAnalysisSource === 'current_search'
                                ? 'Use an LLM to summarize and expand on the items currently on screen'
                                : 'Use an LLM to summarize and expand on your compiled research'}
                            </div>
                          </button>

                          <button
                            disabled={true}
                            className="p-4 rounded-lg border border-gray-800 bg-gray-950/40 opacity-60 cursor-not-allowed text-left"
                          >
                            <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                              <Bot className="w-4 h-4 text-gray-400" />
                              <span>Agent Mode (Soon™)</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Use an Agent to perform searches, sift through content and explain high signal content related to your research intent
                            </div>
                          </button>
                        </div>

                        <div className="mt-6 text-xs text-gray-600">
                          Session ID: <span className="text-gray-500">{sessionId || 'none'}</span>
                        </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer - Re-analyze Button */}
                {!isAnalyzing && analysis && (
                  <div className="border-t border-gray-800 p-3 bg-[#0A0A0A]">
                    <button
                      onClick={() => void handleAnalyze()}
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
                        
                        // Use title from API response, fallback to metadata fields
                        const displayTitle = session.title || metadata?.title || metadata?.headline || metadata?.episode || 'Research Session';
                        
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
                                  alt={displayTitle}
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
                                {displayTitle}
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
                                if (onOpenSession && session.id) {
                                  onOpenSession(session.id, displayTitle);
                                }
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

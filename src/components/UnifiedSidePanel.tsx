import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Loader, BrainCircuit, AlertCircle, RotateCcw, BookText, History, Bot, Link as LinkIcon, Settings2, TextSearch, Layers, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { analyzeAdHocResearch, analyzeResearchSession } from '../services/researchSessionAnalysisService.ts';
import { getCurrentSessionId, fetchAllResearchSessions, ResearchSession } from '../services/researchSessionService.ts';
import PodcastContextPanel from './PodcastContextPanel.tsx';
import { AuthConfig, printLog } from '../constants/constants.ts';
import { copyToClipboard } from '../services/researchSessionShareService.ts';
import { FRONTEND_URL } from '../config/urls.js';
import { extractImageFromAny } from '../utils/hierarchyImageUtils.ts';
import { QuotaExceededError } from '../types/errors.ts';
import QuotaExceededModal, { QuotaExceededData } from './QuotaExceededModal.tsx';

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
  forceAnalysisKey?: number; // Increments to force-switch to Analysis tab even when already open
  onCloseAnalysis: () => void;
  sessionId?: string;
  
  // Sessions panel props
  isSessionsOpen: boolean;
  onCloseSessions: () => void;
  onOpenSession?: (sessionId: string, sessionTitle?: string) => void;
  // Active session tracking (to show "Active" chip in Sessions list)
  activeSessionId?: string | null;
  activeSessionItemCount?: number;
  
  // Width callback for layout
  onWidthChange?: (width: number) => void;

  // AI Analysis: current on-screen results (used for "Current Search" analysis mode)
  currentSearchResults?: any[];

  // Research session controls (for Context panel "add to research" toggle)
  researchSessionShareLinks?: string[];
  onAddToResearch?: (result: any) => void;
  onRemoveFromResearch?: (shareLink: string) => void;
  // Track navigation for the Details mini player
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;

  // Bottom layout: allow parent to treat the panel as "expanded only" and collapse back
  // to a mini player UI. When provided, the bottom-sheet will render a single down-chevron
  // control to invoke this callback.
  onRequestCollapseToMiniPlayer?: () => void;
  defaultSheetMode?: 'peek' | 'full' | 'dock';
  
  // Quota exceeded modal callbacks
  onQuotaExceededSignUp?: () => void;
  onQuotaExceededUpgrade?: () => void;
  onQuotaExceededUpgradePro?: () => void;
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
  forceAnalysisKey,
  onCloseAnalysis,
  sessionId: propSessionId,
  isSessionsOpen,
  onCloseSessions,
  onOpenSession,
  activeSessionId,
  activeSessionItemCount,
  onWidthChange,
  currentSearchResults,
  researchSessionShareLinks,
  onAddToResearch,
  onRemoveFromResearch,
  onPreviousTrack,
  onNextTrack,
  onRequestCollapseToMiniPlayer,
  defaultSheetMode = 'peek',
  onQuotaExceededSignUp,
  onQuotaExceededUpgrade,
  onQuotaExceededUpgradePro,
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
  const sheetRef = useRef<HTMLDivElement>(null);
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
  
  // Copy-to-clipboard feedback: stores the session ID that was just copied, cleared after 2s
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  const handleCopySessionLink = async (sessionId: string) => {
    const url = `${FRONTEND_URL}/app?researchSessionId=${encodeURIComponent(sessionId)}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedSessionId(sessionId);
      setTimeout(() => setCopiedSessionId(null), 2000);
    }
  };

  // Quota exceeded state
  const [quotaExceededData, setQuotaExceededData] = useState<QuotaExceededData | null>(null);
  
  // Update active mode based on which panel is being opened from parent
  // forceAnalysisKey allows parent to force-switch to Analysis even when isAnalysisOpen was already true
  useEffect(() => {
    if (isContextOpen && !isAnalysisOpen && !isSessionsOpen) {
      setActiveMode(PanelMode.CONTEXT);
    } else if (isAnalysisOpen) {
      setActiveMode(PanelMode.ANALYSIS);
    } else if (isSessionsOpen) {
      setActiveMode(PanelMode.SESSIONS);
    }
  }, [isContextOpen, isAnalysisOpen, isSessionsOpen, forceAnalysisKey]);
  
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

    try {
      const result = effectiveSource === 'current_search'
        ? await analyzeAdHocResearch(uniqueIds, instructions, onChunk)
        : await analyzeResearchSession(compiledSessionId as string, instructions, onChunk);

      setIsAnalyzing(false);

      if (!result.success) {
        setError(result.error || 'Analysis failed');
      }
    } catch (err) {
      setIsAnalyzing(false);
      if (err instanceof QuotaExceededError) {
        setQuotaExceededData(err.data);
      } else {
        setError(err instanceof Error ? err.message : 'Analysis failed');
      }
    }
  };

  // No auto-analyze on open; user triggers analysis explicitly from UI.

  // Fetch sessions when sessions mode opens, or when the active session changes.
  // Uses a cancelled flag so stale fetches don't clobber newer results, and retries
  // once if the active session isn't in the list yet (save may still be in-flight).
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const loadSessions = async () => {
      if (activeMode !== PanelMode.SESSIONS || !isPanelOpen) return;

      setIsLoadingSessions(true);
      setSessionsError(null);
      try {
        const allSessions = await fetchAllResearchSessions();
        if (cancelled) return;
        setSessions(allSessions);

        // If the active session isn't in the fetched list it may still be saving
        // to the backend (race between optimistic local state and async save).
        // Retry once after a short delay so the user sees it appear.
        if (activeSessionId && !allSessions.some(s => s.id === activeSessionId)) {
          retryTimer = setTimeout(async () => {
            if (cancelled) return;
            try {
              const retried = await fetchAllResearchSessions();
              if (!cancelled) setSessions(retried);
            } catch { /* silent retry */ }
          }, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          setSessionsError(err instanceof Error ? err.message : 'Failed to load sessions');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSessions(false);
        }
      }
    };

    void loadSessions();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [activeMode, isPanelOpen, activeSessionId]);

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
  const effectiveSourceColor =
    effectiveAnalysisSource === 'current_search'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : effectiveAnalysisSource === 'compiled_session'
        ? 'bg-green-100/40 text-green-400 border-green-300/30'
        : 'bg-gray-700/20 text-gray-400 border-gray-700/30';

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
  const [sheetMode, setSheetMode] = useState<SheetMode>(defaultSheetMode);

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

  // Debug: log sheet mode and layout info
  useEffect(() => {
    if (!isBottomLayout || !isPanelOpen) return;
    printLog(
      `[ScrollDebug] UnifiedSidePanel bottom layout: sheetMode=${defaultSheetMode} ` +
      `activeMode=${activeMode} isContextMode=${activeMode === PanelMode.CONTEXT}`
    );
    // Log sheet dimensions after transition completes
    const timer = setTimeout(() => {
      const el = sheetRef.current;
      if (!el) {
        printLog(`[ScrollDebug] sheetRef is NULL`);
        return;
      }
      const rect = el.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(el);
      printLog(
        `[ScrollDebug] Sheet container: ` +
        `boundingH=${Math.round(rect.height)} ` +
        `computedH=${computedStyle.height} ` +
        `overflow=${computedStyle.overflow} ` +
        `display=${computedStyle.display} ` +
        `flexDir=${computedStyle.flexDirection}`
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [isBottomLayout, isPanelOpen, defaultSheetMode, activeMode]);

  if (isBottomLayout) {
    // If nothing is open, hide the sheet entirely (consistent with existing open/close state).
    if (!isPanelOpen) {
      return null;
    }

    // Peek is the default "stacked" height on narrow/mobile. Now that the inner panes scroll,
    // we can keep this shorter to leave more galaxy visible.
    // Reduced by ~30% from 60vh → 42vh.
    const sheetHeight = sheetMode === 'full' ? '92vh' : sheetMode === 'peek' ? '42vh' : '44px';

    const sheet = (
      <div
        ref={sheetRef}
        className="bg-black border-t border-gray-800 rounded-t-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
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
                {typeof onRequestCollapseToMiniPlayer === 'function' ? (
                  <button
                    onClick={() => onRequestCollapseToMiniPlayer()}
                    className="p-1.5 text-gray-400 hover:text-white border border-gray-800 rounded-md hover:bg-gray-900 transition-colors"
                    aria-label="Collapse"
                    title="Collapse"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                ) : (
                  <>
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
                    {sheetMode !== 'full' && (
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
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {isContextMode ? (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
                  onPreviousTrack={onPreviousTrack}
                  onNextTrack={onNextTrack}
                />
              </div>
            ) : isAnalysisMode ? (
              <div className="flex-1 min-h-0 bg-black flex flex-col overflow-hidden">
                {/* Header (bottom-sheet variant) */}
                <div className="p-3 border-b border-gray-800 bg-[#0A0A0A] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-medium text-gray-400">AI Analysis</h3>
                    {effectiveSourceLabel && (
                      <button
                        onClick={() => {
                          setShowAnalysisModeChooser(false);
                          setShowAnalysisSourceChooser(true);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border truncate hover:opacity-80 transition-opacity ${effectiveSourceColor}`}
                        style={{ cursor: 'pointer' }}
                        title="Click to change analysis source"
                      >
                        {effectiveSourceLabel}
                      </button>
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

                <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto p-4">
                  {showAnalysisSourceChooser ? (
                    <div className="max-w-xl w-full pt-2 text-gray-200">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowAnalysisSourceChooser(false)}
                            className="p-1.5 -ml-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                            aria-label="Back to analysis"
                            title="Back to analysis"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div className="text-lg font-semibold text-white">Choose What to Analyze</div>
                        </div>

                        <button
                          onClick={() => {
                            persistAnalysisSource('current_search');
                            setShowAnalysisSourceChooser(false);
                            void handleAnalyze('current_search');
                          }}
                          disabled={isAnalyzing}
                          className={`w-full p-4 rounded-lg border transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                            analysisSource === 'current_search'
                              ? 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/15'
                              : 'border-gray-700 bg-gray-900/40 hover:bg-gray-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <TextSearch className="w-4 h-4 text-blue-400" />
                            <span>Current Search</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-normal">Recommended</span>
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
                          className={`w-full p-4 rounded-lg border transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                            analysisSource === 'compiled_session'
                              ? 'border-green-300/40 bg-green-100/30 hover:bg-green-100/40'
                              : 'border-gray-700 bg-gray-900/40 hover:bg-gray-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Layers className="w-4 h-4 text-green-400" />
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
                        Right-click stars or use the stack button in the info panel
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
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {/* Sessions tab content is already self-contained; keep behavior consistent */}
                <div className="flex-1 min-h-0 bg-black flex flex-col overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-y-auto p-4">
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
                          const isActive = session.id === activeSessionId;
                          // For active session, use live item count from parent; otherwise use backend count
                          const itemCount = isActive && activeSessionItemCount !== undefined
                            ? activeSessionItemCount
                            : (session.pineconeIdsCount || session.pineconeIds?.length || 0);
                          const createdDate = session.createdAt ? new Date(session.createdAt).toLocaleDateString() : '';
                          const sessionImage = metadata ? extractImageFromAny(metadata) : undefined;
                          // Use lastItemMetadata for all display fields (title/image/creator stay in sync)
                          // Prioritize episode title over quote text
                          const displayTitle =
                            metadata?.episode || metadata?.title || metadata?.headline || 'Research Session';

                          return (
                            <div
                              key={session.id}
                              className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-emerald-900/20 hover:bg-emerald-900/30 border border-emerald-700/50'
                                  : 'bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800'
                              }`}
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
                                  <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-2">
                                    {createdDate}
                                    {isActive && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/90 text-gray-800 font-medium">
                                        Active
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {session.id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleCopySessionLink(session.id!);
                                    }}
                                    className="p-1.5 text-gray-500 hover:text-white border border-gray-700 rounded-md hover:bg-gray-800 transition-colors"
                                    aria-label="Copy session link"
                                    title={copiedSessionId === session.id ? 'Copied!' : 'Copy link'}
                                  >
                                    {copiedSessionId === session.id ? (
                                      <Check className="w-3.5 h-3.5 text-green-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenSession && session.id) {
                                      onOpenSession(session.id, displayTitle);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                                >
                                  Open
                                </button>
                              </div>
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
    );

    // Both expanded and peek/dock: use pointer-events-none on wrapper, pointer-events-auto on sheet.
    // The sheet's z-index ensures it's above the galaxy. No backdrop needed.
    return (
      <>
        <div className="fixed left-0 right-0 bottom-0 z-[70] pointer-events-none">
          {sheet}
        </div>
        <QuotaExceededModal
          isOpen={quotaExceededData !== null}
          onClose={() => setQuotaExceededData(null)}
          data={quotaExceededData || { tier: 'anonymous', used: 0, max: 0 }}
          onSignUp={() => {
            setQuotaExceededData(null);
            onQuotaExceededSignUp?.();
          }}
          onUpgrade={() => {
            setQuotaExceededData(null);
            onQuotaExceededUpgrade?.();
          }}
          onUpgradePro={() => {
            setQuotaExceededData(null);
            onQuotaExceededUpgradePro?.();
          }}
        />
      </>
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
          onPreviousTrack={onPreviousTrack}
          onNextTrack={onNextTrack}
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
                    <h3 className="text-sm font-medium text-gray-400">AI Analysis</h3>
                    {effectiveSourceLabel && (
                      <button
                        onClick={() => {
                          setShowAnalysisModeChooser(false);
                          setShowAnalysisSourceChooser(true);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border truncate hover:opacity-80 transition-opacity ${effectiveSourceColor}`}
                        style={{ cursor: 'pointer' }}
                        title="Click to change analysis source"
                      >
                        {effectiveSourceLabel}
                      </button>
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
                    <div className="max-w-xl w-full pt-2 text-gray-200">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowAnalysisSourceChooser(false)}
                            className="p-1.5 -ml-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                            aria-label="Back to analysis"
                            title="Back to analysis"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div className="text-lg font-semibold text-white">Choose What to Analyze</div>
                        </div>

                        <button
                          onClick={() => {
                            persistAnalysisSource('current_search');
                            setShowAnalysisSourceChooser(false);
                            // Move directly into the analysis phase
                            void handleAnalyze('current_search');
                          }}
                          disabled={isAnalyzing}
                          className={`w-full p-4 rounded-lg border transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                            analysisSource === 'current_search'
                              ? 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/15'
                              : 'border-gray-700 bg-gray-900/40 hover:bg-gray-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <TextSearch className="w-4 h-4 text-blue-400" />
                            <span>Current Search</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-normal">Recommended</span>
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
                          className={`w-full p-4 rounded-lg border transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                            analysisSource === 'compiled_session'
                              ? 'border-green-300/40 bg-green-100/30 hover:bg-green-100/40'
                              : 'border-gray-700 bg-gray-900/40 hover:bg-gray-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Layers className="w-4 h-4 text-green-400" />
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
                        Right-click stars or use the stack button in the info panel
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
                      disabled={!sessionId && effectiveAnalysisSource === 'compiled_session'}
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
                        const isActive = session.id === activeSessionId;
                        // For active session, use live item count from parent; otherwise use backend count
                        const itemCount = isActive && activeSessionItemCount !== undefined
                          ? activeSessionItemCount
                          : (session.pineconeIdsCount || session.pineconeIds?.length || 0);
                        const createdDate = session.createdAt ? new Date(session.createdAt).toLocaleDateString() : '';
                        
                        // Use helper to extract image with fallback chain
                        const sessionImage = metadata ? extractImageFromAny(metadata) : undefined;
                        
                        // Use lastItemMetadata for all display fields (title/image/creator stay in sync)
                        // Prioritize episode title over quote text
                        const displayTitle = metadata?.episode || metadata?.title || metadata?.headline || 'Research Session';
                        
                        return (
                          <div
                            key={session.id}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                              isActive
                                ? 'bg-emerald-900/20 hover:bg-emerald-900/30 border border-emerald-700/50'
                                : 'bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800'
                            }`}
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
                                <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-2">
                                  {createdDate}
                                  {isActive && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/90 text-gray-800 font-medium">
                                      Active
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>

                            {/* Copy Link + Open Buttons */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {session.id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleCopySessionLink(session.id!);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-white border border-gray-700 rounded-md hover:bg-gray-800 transition-colors"
                                  aria-label="Copy session link"
                                  title={copiedSessionId === session.id ? 'Copied!' : 'Copy link'}
                                >
                                  {copiedSessionId === session.id ? (
                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenSession && session.id) {
                                    onOpenSession(session.id, displayTitle);
                                  }
                                }}
                                className="px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                              >
                                Open
                              </button>
                            </div>
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
      <QuotaExceededModal
        isOpen={quotaExceededData !== null}
        onClose={() => setQuotaExceededData(null)}
        data={quotaExceededData || { tier: 'anonymous', used: 0, max: 0 }}
        onSignUp={() => {
          setQuotaExceededData(null);
          onQuotaExceededSignUp?.();
        }}
        onUpgrade={() => {
          setQuotaExceededData(null);
          onQuotaExceededUpgrade?.();
        }}
        onUpgradePro={() => {
          setQuotaExceededData(null);
          onQuotaExceededUpgradePro?.();
        }}
      />
    </div>
  );
};

export default UnifiedSidePanel;

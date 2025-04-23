// types/conversation.ts
import { Source } from './source';
import { QuoteResult } from './quote';
export interface BaseConversationItem {
  id: number;
  query: string;
  timestamp: Date;
  isStreaming: boolean;
}

export interface WebSearchModeData {
  result: string;
  sources: Source[];
}

export interface ExpertModeData {
  result: string;
  sources: Source[];
}

export interface PodcastSearchData {
  quotes: QuoteResult[];
}

export interface WebSearchModeItem extends BaseConversationItem {
  type: 'web-search';
  data: WebSearchModeData;
}

export interface ExpertModeItem extends BaseConversationItem {
  type: 'expert';
  data: ExpertModeData;
}

export interface PodcastSearchItem extends BaseConversationItem {
  type: 'podcast-search';
  data: PodcastSearchData;
}

// For backward compatibility, alias WebSearchModeItem as QuickModeItem
export type QuickModeItem = WebSearchModeItem;
export type QuickModeData = WebSearchModeData;

export type ConversationItem = WebSearchModeItem | ExpertModeItem | PodcastSearchItem;
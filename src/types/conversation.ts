// types/conversation.ts
import { Source } from './source';
import { QuoteResult } from './quote';
export interface BaseConversationItem {
  id: number;
  query: string;
  timestamp: Date;
  isStreaming: boolean;
}

export interface QuickModeData {
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

export interface QuickModeItem extends BaseConversationItem {
  type: 'quick';
  data: QuickModeData;
}

export interface ExpertModeItem extends BaseConversationItem {
  type: 'expert';
  data: ExpertModeData;
}

export interface PodcastSearchItem extends BaseConversationItem {
  type: 'podcast-search';
  data: PodcastSearchData;
}

export type ConversationItem = QuickModeItem | ExpertModeItem | PodcastSearchItem;
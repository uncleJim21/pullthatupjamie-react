// types/quote.ts
export interface QuoteResult {
  quote: string;
  episode: string;
  creator: string;
  audioUrl: string;
  date: string;
  artworkUrl?: string;
  similarity: number;
  timeContext: {
    start_time: number;
    end_time: number;
  };
}
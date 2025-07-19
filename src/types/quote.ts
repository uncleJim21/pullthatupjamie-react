// types/quote.ts
export interface QuoteResult {
  quote: string;
  episode: string;
  creator: string;
  audioUrl: string;
  date: string;
  episodeImage?: string; // New field for episode artwork
  similarity: number;
  timeContext: {
    start_time: number;
    end_time: number;
  };
  shareable?: boolean;
}
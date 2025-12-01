// types/quote.ts
export interface QuoteResult {
  id?: string;                             // Paragraph ID
  shareLink?: string;                      // Share link identifier
  shareUrl?: string;                       // Full share URL
  quote: string;
  episode: string;
  creator: string;
  audioUrl: string;
  date: string;
  episodeImage?: string;                   // Episode artwork
  similarity: number | {                   // Similarity score (can be number or object)
    combined: number;
    vector: number;
  };
  timeContext: {
    start_time: number;
    end_time: number;
  };
  shareable?: boolean;
  hierarchyLevel?: 'feed' | 'episode' | 'chapter' | 'paragraph';  // For 3D view
  coordinates3d?: {                        // For 3D galaxy view
    x: number;
    y: number;
    z: number;
  };
}
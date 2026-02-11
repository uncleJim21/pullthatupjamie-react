// types/quote.ts
export interface QuoteResult {
  id?: string;                             // Paragraph or node ID
  shareLink?: string;                      // Share link identifier
  shareUrl?: string;                       // Full share URL
  listenLink?: string;                     // Optional listen link

  // Core textual fields
  quote: string;                           // Primary snippet / label
  summary?: string;                        // Optional long-form summary (chapters, etc.)
  headline?: string;                       // Chapter headline when available
  description?: string;                    // Optional HTML description (episode / chapter)

  // Episode / creator context
  episode: string;                         // Episode title or identifier
  creator: string;
  audioUrl: string;
  date: string;                            // Human-readable date (may be "Date not provided")
  published?: string | null;              // ISO published date when available
  episodeImage?: string;                   // Episode artwork

  // Tooltip abstraction fields (preferred by UI; fall back to above when missing)
  tooltipTitle?: string;
  tooltipSubtitle?: string;
  tooltipImage?: string;

  similarity: number | {                   // Similarity score (can be number or object)
    combined: number;
    vector: number;
  };
  timeContext: {
    start_time: number | null;
    end_time: number | null;
  };
  additionalFields?: Record<string, unknown>;
  shareable?: boolean;
  hierarchyLevel?: 'feed' | 'episode' | 'chapter' | 'paragraph';  // For 3D view
  coordinates3d?: {                        // For 3D galaxy view
    x: number;
    y: number;
    z: number;
  };
}
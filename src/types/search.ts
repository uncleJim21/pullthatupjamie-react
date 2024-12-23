export interface SearchResult {
    title: string;
    url: string;
    content: string;
    publishedDate?: string | null;
    thumbnail?: string | null;
    score: number;
    engine: string;
    category: string;
  }
  
  export interface SearchResponse {
    query: string;
    number_of_results: number;
    results: SearchResult[];
  }
  
  export interface AISearchResponse {
    query: string;
    result: string;
    intermediateSteps?: any[];
  }
  
  export type SearchMode = 'raw' | 'ai';

export interface ClipRequest {
  status: string;
  lookupHash: string;
  pollUrl: string;
}

export interface ClipRequestResponse {
    status: "processing" | "completed";
    lookupHash: string;
    pollUrl?: string;  // Only present if status is "processing"
    url?: string;      // Only present if status is "completed"
}
  

export interface ClipStatus {
  status: string;
  queuePosition?: string;
  lookupHash: string;
  url?: string;
}

export interface ClipProgress {
  isProcessing: boolean;
  creator: string;
  episode: string;
  timestamps: number[];
  clipId: string;
  cdnLink?: string;
  episodeImage: string;
  pollUrl?: string;
  lookupHash: string;  // Ensure lookupHash is always defined
}

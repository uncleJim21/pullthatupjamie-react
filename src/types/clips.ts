
export interface ClipRequest {
  status: string;
  lookupHash: string;
  pollUrl: string;
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
  }
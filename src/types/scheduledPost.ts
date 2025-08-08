export interface ScheduledPost {
  postId: string;
  adminEmail: string;
  platform: 'twitter' | 'nostr';
  status: 'scheduled' | 'processing' | 'posted' | 'failed' | 'cancelled';
  scheduledFor: string; // ISO date string
  timezone: string;
  content: {
    text: string;
    mediaUrl?: string;
  };
  platformData?: {
    twitterPostUrl?: string;
    nostrEventId?: string;
    errorMessage?: string;
  };
  createdAt: string;
  updatedAt: string;
  retryCount?: number;
  maxRetries?: number;
}

export interface CreateScheduledPostRequest {
  text: string;
  mediaUrl?: string;
  scheduledFor: string; // ISO date string
  platforms: ('twitter' | 'nostr')[];
  timezone: string;
}

export interface UpdateScheduledPostRequest {
  text?: string;
  mediaUrl?: string;
  scheduledFor?: string;
  timezone?: string;
}

export interface ScheduledPostsResponse {
  posts: ScheduledPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ScheduledPostsQuery {
  status?: 'scheduled' | 'processing' | 'posted' | 'failed' | 'cancelled';
  platform?: 'twitter' | 'nostr';
  limit?: number;
  page?: number;
  sortBy?: 'scheduledFor' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ScheduledPostStats {
  total: number;
  scheduled: number;
  processing: number;
  posted: number;
  failed: number;
  cancelled: number;
}




export interface ScheduledPost {
  postId: string;
  _id?: string; // MongoDB ID field (for backend compatibility)
  adminEmail: string;
  platform: 'twitter' | 'nostr';
  status: 'unsigned' | 'scheduled' | 'processing' | 'posted' | 'failed' | 'cancelled';
  scheduledFor: string; // ISO date string
  timezone: string;
  content: {
    text: string;
    mediaUrl?: string;
  };
  platformData?: {
    twitterPostUrl?: string;
    nostrEventId?: string;
    nostrSignature?: string;
    nostrPubkey?: string;
    nostrCreatedAt?: number;
    nostrRelays?: string[];
    nostrPostUrl?: string;
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
  // Optional platform-specific data required by backend for validation (e.g., Nostr signatures)
  platformData?: {
    nostrEventId?: string;
    nostrSignature?: string;
    nostrPubkey?: string;
    nostrCreatedAt?: number;
    nostrRelays?: string[];
    nostrPostUrl?: string;
  };
}

export interface UpdateScheduledPostRequest {
  text?: string;
  mediaUrl?: string;
  scheduledFor?: string;
  timezone?: string;
  // Allow passing platform-specific data on update if required by backend
  platformData?: {
    nostrEventId?: string;
    nostrSignature?: string;
    nostrPubkey?: string;
    nostrCreatedAt?: number;
    nostrRelays?: string[];
    nostrPostUrl?: string;
  };
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
  status?: 'unsigned' | 'scheduled' | 'processing' | 'posted' | 'failed' | 'cancelled';
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




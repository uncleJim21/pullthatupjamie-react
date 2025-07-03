interface MentionSearchRequest {
  query: string;
  platforms?: ('twitter' | 'nostr')[];
  includePersonalPins?: boolean;
  includeCrossPlatformMappings?: boolean;
  limit?: number;
}

interface TwitterResult {
  platform: 'twitter';
  id: string;
  username: string;
  name: string;
  verified: boolean;
  verified_type?: 'blue' | 'business' | 'government' | null;
  profile_image_url?: string;
  description?: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  protected: boolean;
  isPinned: boolean;
  pinId?: string;
  lastUsed?: string;
  crossPlatformMapping?: {
    hasNostrMapping: boolean;
    nostrNpub?: string;
    nostrDisplayName?: string;
    confidence?: number;
    verificationMethod?: string;
    isAdopted?: boolean;
    mappingId?: string;
  };
}

interface NostrResult {
  platform: 'nostr';
  npub: string;
  displayName?: string;
  nip05?: string;
  about?: string;
  picture?: string;
  isPinned: boolean;
  pinId?: string;
  lastUsed?: string;
  crossPlatformMapping?: {
    hasTwitterMapping: boolean;
    twitterUsername?: string;
    twitterDisplayName?: string;
    confidence?: number;
    verificationMethod?: string;
    isAdopted?: boolean;
    mappingId?: string;
  };
}

type MentionResult = TwitterResult | NostrResult;

interface MentionSearchResponse {
  results: MentionResult[];
  meta: {
    totalResults: number;
    platforms: string[];
    searchTerm: string;
    includePersonalPins: boolean;
    includeCrossPlatformMappings: boolean;
  };
}

export type {
  MentionSearchRequest,
  TwitterResult,
  NostrResult,
  MentionResult,
  MentionSearchResponse
}; 
interface MentionSearchRequest {
  query: string;
  platforms?: ('twitter' | 'nostr')[];
  includePersonalPins?: boolean;
  includeCrossPlatformMappings?: boolean;
  limit?: number;
}

interface TwitterProfileData {
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
}

interface NostrProfileData {
  npub: string;
  displayName?: string;
  nip05?: string;
  about?: string;
  picture?: string;
}

interface PersonalPin {
  id: string;
  platform: 'twitter' | 'nostr';
  username: string;
  targetPlatform?: 'twitter' | 'nostr';
  targetUsername?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  profileData?: TwitterProfileData | NostrProfileData;
}

interface CreatePinRequest {
  platform: 'twitter' | 'nostr';
  username: string;
  targetPlatform?: 'twitter' | 'nostr';
  targetUsername?: string;
  notes?: string;
  profileData?: TwitterProfileData | NostrProfileData;
}

interface UpdatePinRequest {
  targetPlatform?: 'twitter' | 'nostr';
  targetUsername?: string;
  notes?: string;
  profileData?: TwitterProfileData | NostrProfileData;
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
  // Personal pin fields
  isPersonalPin?: boolean;
  personalPin?: PersonalPin | null;
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
  // Personal pin fields
  isPersonalPin?: boolean;
  personalPin?: PersonalPin | null;
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

interface PinsResponse {
  pins: PersonalPin[];
}

interface PinResponse {
  pin: PersonalPin;
}

export type {
  MentionSearchRequest,
  PersonalPin,
  CreatePinRequest,
  UpdatePinRequest,
  TwitterProfileData,
  NostrProfileData,
  TwitterResult,
  NostrResult,
  MentionResult,
  MentionSearchResponse,
  PinsResponse,
  PinResponse
}; 
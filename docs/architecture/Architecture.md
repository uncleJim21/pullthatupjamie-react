# PullThatUpJamie Architecture

This document outlines the technical architecture of the PullThatUpJamie application, including critical schemas, operating modes, and flow charts showing process and relationships between client and server.

## System Overview

PullThatUpJamie is a React-based web application that provides podcast search and clip creation functionality. The application allows users to search for podcast content, create clips, and share them. It supports multiple authentication methods including Lightning Network payments and traditional subscription-based access.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                        │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │    React    │    │   Services  │    │     Components      │  │
│  │  Frontend   │◄───┤   Layer     │◄───┤                     │  │
│  │             │    │             │    │                     │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│          ▲                 ▲                      ▲              │
└──────────┼─────────────────┼──────────────────────┼──────────────┘
           │                 │                      │
           ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                         API Layer                                 │
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │  Auth API   │    │  Clip API   │    │   Podcast API       │   │
│  │             │    │             │    │                     │   │
│  └─────────────┘    └─────────────┘    └─────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
           ▲                 ▲                      ▲
           │                 │                      │
           ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Backend Services                            │
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │ Auth Server │    │ Clip Server │    │   Podcast Server    │   │
│  │             │    │             │    │                     │   │
│  └─────────────┘    └─────────────┘    └─────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Critical Schemas

### Authentication Schema

```typescript
// Authentication Types
enum RequestAuthMethod {
  LIGHTNING = 'lightning',
  SQUARE = 'square',
  FREE = 'free',
  FREE_EXPENDED = 'free-expended' // User in limbo and has to choose
}

interface AuthConfig {
  type: RequestAuthMethod;
  credentials: {
    username?: string;
    password?: string;
    preimage?: string;
    paymentHash?: string;
  };
}

interface SignInResponse {
  token: string;
  subscriptionValid: boolean;
  message: string;
}

interface Privileges {
  feedId: string;
  access: 'admin' | 'user' | 'viewer';
}

interface CheckPrivsResponse {
  privs: Privileges;
}
```

### Clip Schema

```typescript
interface ClipRequest {
  status: string;
  lookupHash: string;
  pollUrl: string;
}

interface ClipRequestResponse {
  status: "processing" | "completed";
  lookupHash: string;
  pollUrl?: string;  // Only present if status is "processing"
  url?: string;      // Only present if status is "completed"
}

interface ClipStatus {
  status: string;
  queuePosition?: string;
  lookupHash: string;
  url?: string;
}

interface ClipProgress {
  isProcessing: boolean;
  creator: string;
  episode: string;
  timestamps: number[];
  clipId: string;
  cdnLink?: string;
  episodeImage: string;
  pollUrl?: string;
  lookupHash: string;
}
```

### Conversation Schema

```typescript
interface BaseConversationItem {
  id: number;
  query: string;
  timestamp: Date;
  isStreaming: boolean;
}

interface QuickModeData {
  result: string;
  sources: Source[];
}

interface ExpertModeData {
  result: string;
  sources: Source[];
}

interface PodcastSearchData {
  quotes: QuoteResult[];
}

interface QuickModeItem extends BaseConversationItem {
  type: 'quick';
  data: QuickModeData;
}

interface ExpertModeItem extends BaseConversationItem {
  type: 'expert';
  data: ExpertModeData;
}

interface PodcastSearchItem extends BaseConversationItem {
  type: 'podcast-search';
  data: PodcastSearchData;
}

type ConversationItem = QuickModeItem | ExpertModeItem | PodcastSearchItem;
```

### Podcast Schema

```typescript
interface Episode {
  id: string;
  title: string;
  date: string;
  duration: string;
  audioUrl: string;
  description?: string;
  episodeNumber?: string;
  episodeImage?: string;
  listenLink?: string;
}

interface PodcastFeedData {
  id: string;
  headerColor: string;
  logoUrl: string;
  title: string;
  creator: string;
  lightningAddress?: string;
  description: string;
  episodes: Episode[];
  subscribeLinks: SubscribeLinks;
}

interface SubscribeLinks {
  apple?: string;
  spotify?: string;
  google?: string;
  rss?: string;
  youtube?: string;
}
```

### Lightning Payment Schema

```typescript
interface Invoice {
  pr: string;
  paymentHash: string;
  paid?: boolean;
  preimage?: string;
}

interface WebLNProvider {
  sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
}
```

## Operating Modes

The application supports several operating modes:

### 1. Search Modes

The application supports different search modes:

```typescript
type SearchMode = 'quick' | 'depth' | 'expert' | 'podcast-search';
```

- **Quick Mode**: Provides fast, concise answers with basic source information
- **Depth Mode**: Provides more detailed answers with comprehensive source information
- **Expert Mode**: Provides expert-level analysis with detailed source information
- **Podcast Search Mode**: Specifically searches podcast content for relevant clips

### 2. Authentication Modes

The application supports multiple authentication methods:

- **Lightning Network Payments**: Pay-per-use model using Bitcoin Lightning Network
- **Square Subscription**: Traditional subscription-based access
- **Free Tier**: Limited free access for new users
- **Free Expended**: State when free tier is used up and user must choose a payment method

### 3. Clip Creation Mode

The application allows users to create and share clips from podcasts:

- **Clip Request**: User requests a clip from a specific podcast episode
- **Clip Processing**: Server processes the clip request
- **Clip Sharing**: User can share the created clip

## Process Flow Charts

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   Client    │     │   Server    │
│             │     │             │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  Request Access   │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │  Check Free Tier  │
       │                   │──────────────────>│
       │                   │                   │
       │                   │  Eligibility      │
       │                   │<──────────────────│
       │                   │                   │
       │  Choose Auth      │                   │
       │  Method           │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │  Auth Request     │
       │                   │──────────────────>│
       │                   │                   │
       │                   │  Auth Response    │
       │                   │<──────────────────│
       │                   │                   │
       │  Access Granted   │                   │
       │<──────────────────│                   │
       │                   │                   │
```

### Lightning Payment Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   Client    │     │   Server    │     │  Bitcoin    │
│             │     │             │     │             │     │  Connect    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  Select Lightning │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │  Initialize       │                   │
       │                   │  Bitcoin Connect  │                   │
       │                   │──────────────────────────────────────>│
       │                   │                   │                   │
       │                   │  Connect with NWC │                   │
       │                   │<──────────────────────────────────────│
       │                   │                   │                   │
       │                   │  Request Invoice  │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │  Return Invoice   │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │                   │  Process Payment  │                   │
       │                   │  (Using NWC)      │                   │
       │                   │──────────────────────────────────────>│
       │                   │                   │                   │
       │                   │  Payment Result   │                   │
       │                   │  (preimage)       │                   │
       │                   │<──────────────────────────────────────│
       │                   │                   │                   │
       │                   │  Request with     │                   │
       │                   │  Payment Proof    │                   │
       │                   │  (preimage)       │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │  Verify & Perform │                   │
       │                   │  Job in Single    │                   │
       │                   │  Volley           │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │  Access/Result    │                   │                   │
       │  Confirmed        │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
```

### Clip Creation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   Client    │     │   Server    │
│             │     │             │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  Request Clip     │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │  Make Clip Request│
       │                   │──────────────────>│
       │                   │                   │
       │                   │  Processing       │
       │                   │<──────────────────│
       │                   │                   │
       │  Show Processing  │                   │
       │<──────────────────│                   │
       │                   │                   │
       │                   │  Poll Status      │
       │                   │──────────────────>│
       │                   │                   │
       │                   │  Status Update    │
       │                   │<──────────────────│
       │                   │                   │
       │  Update Progress  │                   │
       │<──────────────────│                   │
       │                   │                   │
       │                   │  Poll Status      │
       │                   │──────────────────>│
       │                   │                   │
       │                   │  Clip Ready       │
       │                   │<──────────────────│
       │                   │                   │
       │  Display Clip     │                   │
       │<──────────────────│                   │
       │                   │                   │
```

## Client-Server Interaction

### API Endpoints

The application interacts with several backend services:

1. **Authentication API**
   - `/signin` - User sign-in
   - `/signup` - User registration
   - `/validate-privs` - Validate user privileges

2. **Clip API**
   - `/api/clip/:clipId` - Fetch clip by ID
   - `/api/make-clip` - Create a new clip
   - Status polling endpoint (dynamic URL)

3. **Podcast API**
   - Podcast feed endpoints
   - Quote search endpoints

4. **Lightning API**
   - `/invoice-pool` - Get Lightning invoice

### Data Flow

1. **Client to Server**:
   - Authentication requests
   - Search queries
   - Clip creation requests
   - Status polling requests

2. **Server to Client**:
   - Authentication responses
   - Search results
   - Clip processing status
   - Clip URLs

### Admin Privileges Verification

The front end implements a privilege verification system for podcast feed pages (/feed/{feedId}), allowing podcast owners and administrators to access special features:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   Client    │     │   Server    │
│             │     │             │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  Access Feed Page │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │  Check Local      │
       │                   │  Storage for      │
       │                   │  Auth Token       │
       │                   │                   │
       │                   │  Request Privs    │
       │                   │  Validation       │
       │                   │  (token + feedId) │
       │                   │──────────────────>│
       │                   │                   │
       │                   │  Verify Token     │
       │                   │  Against Admin    │
       │                   │  Email in         │
       │                   │  ProPodcastDetails│
       │                   │                   │
       │                   │  Return Privileges│
       │                   │  (admin/user/     │
       │                   │   viewer)         │
       │                   │<──────────────────│
       │                   │                   │
       │  Render UI with   │                   │
       │  Admin Controls   │                   │
       │  (if authorized)  │                   │
       │<──────────────────│                   │
       │                   │                   │
```

The process works as follows:

1. When a user navigates to a podcast feed page (/feed/{feedId}), the client checks for an authentication token in local storage.

2. If a token exists, the client makes a request to the `/api/validate-privs` endpoint, sending both the token and the feedId.

3. The server verifies the token and checks if the authenticated user's email matches the adminEmail field in the ProPodcastDetails collection for the specified feedId.

4. The server returns a privileges object containing:
   - feedId: The podcast feed ID
   - access: The access level ('admin', 'user', or 'viewer')

5. Based on the returned privileges, the client conditionally renders admin controls and features:
   - Admin users can:
     - Edit podcast details and manage episodes
     - Pin top clips associated with their podcast
     - Upload clips to a CDN
     - Access AI-curated clips and social media posts
   - Regular users and viewers see the standard podcast feed interface

This implementation ensures that only authorized podcast owners can access administrative features while maintaining a seamless experience for regular users.

Code implementation in the PodcastFeedPage component:

```typescript
useEffect(() => {
    const checkPrivileges = async () => {
        try {
            const token = localStorage.getItem("auth_token") as string;
            if(!token) return;
            
            const response = await AuthService.checkPrivs(token);
            
            if (response && response.privs.privs && response.privs.privs.feedId === feedId) {
                setIsAdmin(response.privs.privs.access === 'admin');
            } else {
                setIsAdmin(false);
            }
        } catch (error) {
            console.error("Error checking privileges:", error);
            setIsAdmin(false);
        }
    };

    if (feedId) {
        checkPrivileges();
    }
}, [feedId]);
```

## Development Configuration

The application uses environment-specific configuration:

```typescript
// Development vs Production
export const DEBUG_MODE = true;
export const FRONTEND_URL = DEBUG_MODE ? 'http://localhost:3000' : 'https://pullthatupjamie.ai';
export const API_URL = DEBUG_MODE ? "http://localhost:4132" : "https://pullthatupjamie-nsh57.ondigitalocean.app";
```

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **State Management**: React Hooks
- **Authentication**: Custom auth with JWT
- **Payment Processing**: Lightning Network, Square
- **Routing**: React Router
- **Styling**: Tailwind CSS, MUI components
- **Deployment**: DigitalOcean 
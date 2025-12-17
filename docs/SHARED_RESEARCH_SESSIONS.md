# Shared Research Sessions - Public Share Route

## Overview

This feature implements a public share route at `/researchSession/[shareId]` that supports social link previews (Open Graph + Twitter Cards) for sharing research sessions on social media platforms like X/Twitter, Slack, and iMessage.

## Implementation

### 1. Server-Side Rendering for Meta Tags

Since this is a Create React App (CRA) project without native SSR support, we use **Vercel Serverless Functions** to handle server-side rendering of meta tags.

**File**: `/api/researchSession/[shareId].js`

This serverless function:
- Fetches share metadata from the backend API
- Returns HTML with proper Open Graph and Twitter Card meta tags
- Includes a client-side redirect script that loads the React app with the shareId
- Handles 404 and error cases gracefully

### 2. Vercel Configuration

**File**: `/vercel.json`

Routes the `/researchSession/:shareId` path to the serverless function and sets appropriate caching headers.

### 3. Client-Side Route Handling

**File**: `/src/components/SearchInterface.tsx`

When the React app loads with `?sharedSession=<shareId>` query parameter, it:
- Fetches the shared session data from the backend
- Transforms the nodes into galaxy view format
- Displays the research session in the 3D galaxy view

### 4. Service Layer

**File**: `/src/services/researchSessionShareService.ts`

Added `fetchSharedResearchSession()` function to fetch public shared sessions.

## Environment Variables

Add these to your `.env` file or Vercel environment variables:

```bash
# Backend API Base URL
BACKEND_BASE_URL=http://localhost:4132  # Development
# BACKEND_BASE_URL=https://your-backend-url  # Production

# Frontend Base URL (for canonical URLs in meta tags)
NEXT_PUBLIC_FRONTEND_URL=https://pullthatupjamie.ai
```

### Setting Environment Variables in Vercel

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add:
   - `BACKEND_BASE_URL` → Your production backend URL
   - `NEXT_PUBLIC_FRONTEND_URL` → `https://pullthatupjamie.ai`

## How It Works

### For Social Media Scrapers (X, Slack, iMessage)

1. Scraper requests `/researchSession/abc123`
2. Vercel routes to serverless function
3. Function fetches metadata from backend
4. Returns HTML with meta tags in initial response
5. Scraper reads meta tags and displays rich preview

### For Human Users

1. User clicks link to `/researchSession/abc123`
2. Serverless function returns HTML with meta tags
3. JavaScript redirect immediately sends user to `/app?sharedSession=abc123`
4. React app loads and displays the shared research session in galaxy view
5. User can interact with the full research session

## Meta Tags Generated

The serverless function generates:

- **Primary**: title, description
- **Open Graph**: og:type, og:url, og:title, og:description, og:image, og:image:alt, og:site_name
- **Twitter**: twitter:card (summary_large_image), twitter:url, twitter:title, twitter:description, twitter:image, twitter:image:alt

## Backend API Contract

The serverless function expects this endpoint to exist:

```
GET /api/shared-research-sessions/:shareId
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "title": "Research Session Title",
    "description": "Description of the research session",
    "previewImageUrl": "https://cdn.example.com/preview.png",
    "nodes": [
      {
        "pineconeId": "unique-id",
        "x": 0.5,
        "y": 0.3,
        "z": 0.1,
        "color": "#ffffff",
        "metadata": {
          "quote": "Quote text",
          "summary": "Summary text",
          "headline": "Headline",
          "episode": "Episode Title",
          "creator": "Creator Name",
          "episodeImage": "https://...",
          "date": "2024-01-01",
          "hierarchyLevel": "paragraph"
        }
      }
    ]
  }
}
```

## Testing

### Local Development

1. Start your backend: `cd backend && npm start` (should run on port 4132)
2. Start Vercel dev: `vercel dev` (runs on port 3000)
3. Visit: `http://localhost:3000/researchSession/test-share-id`

### Testing Social Previews

Use these tools to test meta tags:

- **Twitter**: https://cards-dev.twitter.com/validator
- **Facebook/Meta**: https://developers.facebook.com/tools/debug/
- **LinkedIn**: https://www.linkedin.com/post-inspector/

## Files Created/Modified

### Created
- `/api/researchSession/[shareId].js` - Serverless function for SSR
- `/vercel.json` - Vercel configuration
- `/docs/SHARED_RESEARCH_SESSIONS.md` - This documentation

### Modified
- `/src/components/SearchInterface.tsx` - Added shared session loading logic
- `/src/services/researchSessionShareService.ts` - Added fetch function

## Troubleshooting

### Meta tags not showing in social previews

- Ensure serverless function is deployed and accessible
- Check that backend API returns proper data
- Verify meta tags in HTML source (View Page Source)
- Clear social media cache (each platform has a debugger/validator tool)

### Shared session not loading in React app

- Check browser console for errors
- Verify `sharedSession` query parameter is present
- Ensure backend API is accessible from frontend
- Check network tab for API request/response

### 404 Errors

- Verify `vercel.json` is properly configured
- Check that `/api` directory exists at project root
- Ensure serverless function file name matches route pattern

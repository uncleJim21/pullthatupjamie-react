# URL Configuration System

## Single Source of Truth

All URLs are now managed in **`src/config/urls.js`** - this file works in both client-side React and server-side Node.js environments.

## File: `src/config/urls.js`

```javascript
const DEBUG_MODE = true;  // ← Set to false for production

function getFrontendUrl() {
  if (DEBUG_MODE) return 'http://localhost:3000';
  
  // Server-side: Use Vercel's automatic VERCEL_URL
  if (typeof window === 'undefined') {
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://pullthatupjamie.ai';
  }
  
  // Client-side: Use actual origin in production
  if (window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  
  return 'http://localhost:3000';
}
```

## How It Works

### Development (DEBUG_MODE = true)
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4132`
- All files use these URLs automatically

### Production (DEBUG_MODE = false)
Vercel deployments automatically provide:
- `VERCEL_URL` environment variable (e.g., `your-app-abc123.vercel.app`)
- `VERCEL_ENV` = 'production' or 'preview'

The config automatically uses:
- **Server-side**: `https://${VERCEL_URL}` (from Vercel's env var)
- **Client-side**: `window.location.origin` (actual browser URL)
- **Fallback**: `https://pullthatupjamie.ai`

## Usage

### Client-side (React/TypeScript)
```typescript
import { FRONTEND_URL, API_URL, DEBUG_MODE } from '../config/urls.js';

// Use directly
console.log(FRONTEND_URL); // http://localhost:3000 (dev) or actual URL (prod)
```

### Server-side (Node.js/Vercel Functions)
```javascript
const { FRONTEND_URL, API_URL } = require('../../src/config/urls.js');

// Use directly
console.log(FRONTEND_URL); // http://localhost:3000 (dev) or deployment URL (prod)
```

## Files That Import From This Config

1. **`src/constants/constants.ts`** - Exports for use throughout React app
2. **`src/utils/urlUtils.ts`** - Share URL generation
3. **`api/researchSession/[shareId].js`** - Serverless function redirects

## Environment Variables (Optional)

You can override defaults with environment variables:

```bash
# .env.local (for local development)
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# Vercel Dashboard (for production)
NEXT_PUBLIC_FRONTEND_URL=https://pullthatupjamie.ai
```

But typically, you don't need to set these! Vercel's `VERCEL_URL` is automatic.

## Deployment Process

### Preview Deployments
```bash
git push origin feature-branch
# Vercel deploys to: feature-branch-abc123.vercel.app
# FRONTEND_URL automatically becomes: https://feature-branch-abc123.vercel.app
```

### Production Deployment
```bash
git push origin main
# Vercel deploys to custom domain
# FRONTEND_URL automatically becomes: https://pullthatupjamie.ai
```

## Switching Between Dev and Prod

**To switch to production mode:**

1. Edit `src/config/urls.js`:
   ```javascript
   const DEBUG_MODE = false;  // ← Change this line
   ```

2. Restart dev servers:
   ```bash
   # Stop servers (Ctrl+C)
   npm start
   vercel dev
   ```

**That's it!** All URLs update automatically.

## Benefits

✅ **Single source of truth** - Change URLs in one place  
✅ **Works everywhere** - Client, server, serverless functions  
✅ **Automatic Vercel URLs** - Uses deployment URL automatically  
✅ **Type-safe** - Can be imported in TypeScript  
✅ **Preview deployments** - Each branch gets correct URL  
✅ **No environment variable juggling** - Just works™

## Troubleshooting

### URLs still showing production in dev?
- Check `DEBUG_MODE = true` in `src/config/urls.js`
- Restart dev servers

### Preview deployment using wrong URL?
- Vercel automatically sets `VERCEL_URL`
- No action needed, should work automatically

### Need custom URL logic?
- Edit `getFrontendUrl()` in `src/config/urls.js`
- All files inherit the changes automatically

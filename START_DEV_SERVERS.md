# Starting Development Servers

## Setup Complete! ✅

Your shared research sessions feature is ready. Here's how to run it locally:

## Option 1: Two Terminals (Recommended for Testing Share Feature)

### Terminal 1: React Dev Server
```bash
cd /Users/jamescarucci/Documents/GitLab/pullthatupjamie-react
npm start
```
This runs on **port 3000** - your normal React development.

### Terminal 2: Vercel Dev (For Serverless Functions Only)
```bash
cd /Users/jamescarucci/Documents/GitLab/pullthatupjamie-react
vercel dev --listen 3001
```
This runs on **port 3001** - ONLY for testing the `/researchSession/:shareId` endpoint.

### Test the Share Feature
```bash
# Test meta tags (should show dynamic data from backend)
curl "http://localhost:3001/researchSession/8d5417e36d3d" | grep "og:title"

# Test in browser (will redirect to React app)
open "http://localhost:3001/researchSession/8d5417e36d3d"
```

---

## Option 2: Just React Dev (For Regular Development)

If you're NOT testing the share feature, just run:
```bash
npm start
```

The share feature serverless function only works:
- With `vercel dev` locally
- On production Vercel deployment

---

## What's Configured

### vercel.json
- Routes `/researchSession/:shareId` → Serverless function (generates meta tags)
- Routes everything else → Your React app on port 3000
- No webpack compilation by Vercel (avoids the stream polyfill errors)

### .vercelignore
- Tells Vercel to ignore source files
- Only the `/api` folder is processed for serverless functions

---

## Troubleshooting

### "webpack compiled with 1 error"
This is **expected** when running `vercel dev`. Vercel tries to detect your framework but fails. This is **harmless** because:
- Vercel is configured to proxy to your React dev server (port 3000)
- Only the serverless functions in `/api` are built by Vercel
- Your React app runs separately with `npm start`

### Port already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill

# Kill process on port 3001
lsof -ti:3001 | xargs kill
```

### Backend not responding
Make sure your backend is running:
```bash
cd pullthatupjamie-backend
npm start  # Should run on port 4132
```

---

## Quick Start Commands

```bash
# Terminal 1: Backend
cd /path/to/pullthatupjamie-backend && npm start

# Terminal 2: React Dev
cd /Users/jamescarucci/Documents/GitLab/pullthatupjamie-react && npm start

# Terminal 3: Vercel (for testing share links)
cd /Users/jamescarucci/Documents/GitLab/pullthatupjamie-react && vercel dev --listen 3001
```

---

## Testing Checklist

- [ ] Backend running on port 4132
- [ ] React dev running on port 3000
- [ ] Vercel dev running on port 3001
- [ ] Test: `curl "http://localhost:3001/researchSession/8d5417e36d3d" | grep "og:title"`
- [ ] Should see: `<meta property="og:title" content="I I this isn't the end..."`

---

## Deploy to Production

When ready to deploy:
```bash
vercel --prod
```

Then test: `https://pullthatupjamie.ai/researchSession/8d5417e36d3d`

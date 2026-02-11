# Testing Guide for Shared Research Sessions

## ❌ Problem Identified

You're currently running `npm start` (Create React App dev server), which **does NOT support Vercel serverless functions**. That's why you're seeing the default meta tags instead of the dynamic ones.

## ✅ Solution: Use Vercel Dev Server

### Step 1: Stop Current Dev Server

Stop the `npm start` process running on port 3000:

```bash
# Press Ctrl+C in the terminal running npm start
# OR kill the processes:
kill 3236 89177
```

### Step 2: Start Vercel Dev Server

```bash
cd /Users/jamescarucci/Documents/GitLab/pullthatupjamie-react
vercel dev
```

**Important**: The first time you run `vercel dev`, it will ask you to link your project. Follow the prompts.

### Step 3: Test the Serverless Function

Once Vercel dev is running (should be on port 3000), test the endpoint:

```bash
curl "http://localhost:3000/researchSession/8d5417e36d3d"
```

You should now see the **dynamic meta tags** with the actual research session data:

```html
<meta property="og:title" content="I I this isn't the end. Yeah. We're gonna see a lot more efficient models. Okay. Great." />
<meta property="og:image" content="https://pullthatupjamie-dbs-backup.nyc3.digitaloceanspaces.com/shared-sessions/8d5417e36d3d/preview.jpg" />
```

### Step 4: Test in Browser

Open in your browser:
```
http://localhost:3000/researchSession/8d5417e36d3d
```

You should be redirected to:
```
http://localhost:3000/app?sharedSession=8d5417e36d3d
```

And see the 3D galaxy view with 4 stars.

## 📝 Why This Happened

| Server Type | Supports Serverless Functions? | Meta Tags |
|------------|-------------------------------|-----------|
| `npm start` (CRA dev server) | ❌ No | Static from index.html |
| `vercel dev` | ✅ Yes | Dynamic from serverless function |
| Production (Vercel) | ✅ Yes | Dynamic from serverless function |

**CRA's dev server** only serves static files and doesn't execute serverless functions. The serverless function at `/api/researchSession/[shareId].js` only runs with:
- `vercel dev` (local development)
- Production Vercel deployment

## 🔧 Alternative: Test with Production Build

If you want to stick with CRA dev server for regular development, you can test the serverless function separately:

### Option A: Run Backend on Different Port

Keep your CRA dev server on port 3000, run Vercel on a different port:

```bash
# Terminal 1: CRA dev server
npm start  # Runs on :3000

# Terminal 2: Vercel dev (for testing serverless functions)
vercel dev --listen 3001  # Runs on :3001
```

Then test: `http://localhost:3001/researchSession/8d5417e36d3d`

### Option B: Test Serverless Function Directly

Run the serverless function as a standalone Node script:

```bash
# Create test script
node -e "
const handler = require('./api/researchSession/[shareId].js').default;
const mockReq = { query: { shareId: '8d5417e36d3d' } };
const mockRes = {
  status: (code) => ({ send: (html) => console.log(html) }),
  setHeader: () => {}
};
handler(mockReq, mockRes);
"
```

## 🚀 Production Testing

Once deployed to Vercel, this will work automatically. The serverless function will execute on:

```
https://pullthatupjamie.ai/researchSession/8d5417e36d3d
```

And scrapers will see the dynamic meta tags.

## 📋 Quick Command Reference

```bash
# Install Vercel CLI (already done)
npm install -g vercel

# Link project (first time only)
vercel link

# Start Vercel dev server
vercel dev

# Test endpoint
curl "http://localhost:3000/researchSession/8d5417e36d3d"

# Deploy to production
vercel --prod
```

## 🐛 Troubleshooting

### "Port 3000 already in use"

Stop other processes on port 3000:
```bash
lsof -ti:3000 | xargs kill
```

### "Backend not accessible"

Make sure your backend is running:
```bash
# Terminal 1: Backend
cd pullthatupjamie-backend && npm start  # Port 4132

# Terminal 2: Vercel dev
cd pullthatupjamie-react && vercel dev   # Port 3000
```

### "vercel: command not found"

Install globally:
```bash
npm install -g vercel
```

Or use npx:
```bash
npx vercel dev
```

## ✅ Success Criteria

You'll know it's working when:

1. **curl shows dynamic meta tags**:
   ```bash
   curl "http://localhost:3000/researchSession/8d5417e36d3d" | grep "og:title"
   ```
   Should output: `<meta property="og:title" content="I I this isn't the end...`

2. **Browser redirects**: Opening the URL redirects to `/app?sharedSession=8d5417e36d3d`

3. **Galaxy view loads**: You see 4 stars in 3D space

4. **View Page Source**: Shows dynamic meta tags (not default ones)

## 📚 Next Steps

Once you confirm it works locally with `vercel dev`:

1. Commit changes: `git add . && git commit -m "Add shared research sessions"`
2. Deploy: `vercel --prod`
3. Test production: `https://pullthatupjamie.ai/researchSession/8d5417e36d3d`
4. Validate social: https://cards-dev.twitter.com/validator

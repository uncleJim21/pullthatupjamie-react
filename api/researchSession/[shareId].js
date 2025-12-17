/**
 * Vercel Serverless Function for /researchSession/[shareId]
 * Handles server-side rendering of meta tags for social media scrapers (X/Twitter, Slack, iMessage)
 * Then redirects human users to the React app with the shareId
 */

const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  const { shareId } = req.query;

  // Determine the backend URL based on environment
  const backendUrl = process.env.BACKEND_BASE_URL || 'http://localhost:4132';
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://pullthatupjamie.ai';
  
  try {
    console.log('[SharedSession] Fetching:', `${backendUrl}/api/shared-research-sessions/${shareId}`);
    
    // Fetch share metadata from backend
    const response = await fetch(`${backendUrl}/api/shared-research-sessions/${shareId}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log('[SharedSession] Response status:', response.status);

    // Handle 404 - share not found
    if (response.status === 404) {
      return res.status(404).send(generateNotFoundHTML(frontendUrl));
    }

    // Handle other errors
    if (!response.ok) {
      console.error(`Backend error: ${response.status} ${response.statusText}`);
      return res.status(500).send(generateErrorHTML(frontendUrl));
    }

    const data = await response.json();
    
    // Extract metadata with fallbacks
    const title = data.data?.title || 'Shared Research Session';
    const description = data.data?.description || 'Explore this research session on Pull That Up Jamie';
    const previewImageUrl = data.data?.previewImageUrl || `${frontendUrl}/social-preview.png`;
    const canonicalUrl = `${frontendUrl}/researchSession/${shareId}`;

    // Generate HTML with meta tags
    const html = generateHTML({
      title,
      description,
      previewImageUrl,
      canonicalUrl,
      shareId,
      frontendUrl,
    });

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    
    return res.status(200).send(html);
  } catch (error) {
    console.error('[SharedSession] Error fetching shared research session:', error);
    console.error('[SharedSession] Error stack:', error.stack);
    return res.status(500).send(generateErrorHTML(frontendUrl));
  }
};

// For local testing with Node.js require()
if (typeof module !== 'undefined' && module.exports) {
  module.exports.default = module.exports;
}

/**
 * Generate HTML with meta tags and client-side redirect
 */
function generateHTML({ title, description, previewImageUrl, canonicalUrl, shareId, frontendUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    
    <!-- Primary Meta Tags -->
    <title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}" />
    <meta name="description" content="${escapeHtml(description)}" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(previewImageUrl)}" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta property="og:site_name" content="Pull That Up Jamie" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(previewImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
    
    <!-- Favicon -->
    <link rel="icon" href="${frontendUrl}/favicon.ico" />
    
    <!-- Immediate client-side redirect for human users -->
    <!-- This runs after meta tags are served to scrapers -->
    <script>
      // Only redirect if this is a browser with JavaScript enabled
      // Scrapers typically don't execute JavaScript
      if (typeof window !== 'undefined') {
        window.location.href = '${frontendUrl}/app?sharedSession=${encodeURIComponent(shareId)}';
      }
    </script>
    
    <!-- Fallback meta refresh for browsers without JS (rare) -->
    <noscript>
      <meta http-equiv="refresh" content="0; url=${frontendUrl}/app?sharedSession=${encodeURIComponent(shareId)}" />
    </noscript>
    
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
          sans-serif;
        background: #000;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        text-align: center;
      }
      .container {
        max-width: 500px;
        padding: 20px;
      }
      h1 {
        font-size: 24px;
        margin-bottom: 16px;
      }
      p {
        font-size: 16px;
        color: #aaa;
        margin-bottom: 20px;
      }
      .spinner {
        border: 3px solid #333;
        border-top: 3px solid #fff;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 20px auto;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      a {
        color: #fff;
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Loading Research Session...</h1>
      <div class="spinner"></div>
      <p>Redirecting you to the interactive view</p>
      <p>
        <a href="${frontendUrl}/app?sharedSession=${encodeURIComponent(shareId)}">
          Click here if you're not redirected automatically
        </a>
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Generate 404 Not Found HTML
 */
function generateNotFoundHTML(frontendUrl) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shared Session Not Found - Pull That Up Jamie</title>
    <meta name="description" content="This shared research session could not be found." />
    <link rel="icon" href="${frontendUrl}/favicon.ico" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
          sans-serif;
        background: #000;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        text-align: center;
      }
      .container {
        max-width: 500px;
        padding: 20px;
      }
      h1 {
        font-size: 48px;
        margin-bottom: 16px;
      }
      h2 {
        font-size: 24px;
        margin-bottom: 16px;
        font-weight: normal;
      }
      p {
        font-size: 16px;
        color: #aaa;
        margin-bottom: 20px;
      }
      a {
        display: inline-block;
        margin-top: 20px;
        padding: 12px 24px;
        background: #fff;
        color: #000;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
        transition: background 0.2s;
      }
      a:hover {
        background: #eee;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>404</h1>
      <h2>Shared Session Not Found</h2>
      <p>This research session doesn't exist or has been removed.</p>
      <a href="${frontendUrl}">Go to Homepage</a>
    </div>
  </body>
</html>`;
}

/**
 * Generate Error HTML
 */
function generateErrorHTML(frontendUrl) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Error Loading Session - Pull That Up Jamie</title>
    <meta name="description" content="An error occurred while loading this research session." />
    <link rel="icon" href="${frontendUrl}/favicon.ico" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
          sans-serif;
        background: #000;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        text-align: center;
      }
      .container {
        max-width: 500px;
        padding: 20px;
      }
      h1 {
        font-size: 36px;
        margin-bottom: 16px;
      }
      p {
        font-size: 16px;
        color: #aaa;
        margin-bottom: 20px;
      }
      a {
        display: inline-block;
        margin-top: 20px;
        padding: 12px 24px;
        background: #fff;
        color: #000;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
        transition: background 0.2s;
      }
      a:hover {
        background: #eee;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Error Loading Session</h1>
      <p>We encountered an error while loading this research session. Please try again later.</p>
      <a href="${frontendUrl}">Go to Homepage</a>
    </div>
  </body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

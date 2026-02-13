/**
 * Vercel Serverless Function for /blog/[slug]
 *
 * Serves full HTML with SEO meta tags (canonical, OpenGraph, JSON-LD)
 * for crawlers (Google, Twitter, Slack, iMessage).
 * Redirects human users (who execute JS) into the SPA at /app/blog/:slug.
 *
 * Pattern mirrors api/researchSession/[shareId].js
 */

const fetch = require('node-fetch');
const { FRONTEND_URL, API_URL } = require('../../src/config/urls.js');

module.exports = async function handler(req, res) {
  const { slug } = req.query;
  const backendUrl = API_URL;
  const frontendUrl = FRONTEND_URL;

  try {
    console.log('[Blog] Fetching:', `${backendUrl}/api/blog/${slug}`);

    const response = await fetch(`${backendUrl}/api/blog/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
    });

    console.log('[Blog] Response status:', response.status);

    if (response.status === 404) {
      return res.status(404).send(generateNotFoundHTML(frontendUrl));
    }

    if (!response.ok) {
      console.error(`[Blog] Backend error: ${response.status} ${response.statusText}`);
      return res.status(500).send(generateErrorHTML(frontendUrl));
    }

    const post = await response.json();
    const seo = post.seo || {};

    // Build metadata with fallbacks
    const title = post.title || 'Blog Post';
    const description = seo.meta_description || post.summary || 'A blog post from Pull That Up Jamie';
    const canonicalUrl = seo.canonical_url || `${frontendUrl}/blog/${slug}`;
    const ogTitle = seo.og_title || title;
    const ogDescription = seo.og_description || description;
    const ogUrl = seo.og_url || canonicalUrl;
    const ogImage = seo.og_image || `${frontendUrl}/social-preview.png`;
    const jsonLd = seo.json_ld || null;

    console.log('[Blog] Serving SEO page for:', title);

    const html = generateHTML({
      title,
      description,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogUrl,
      ogImage,
      jsonLd,
      slug,
      frontendUrl,
      post,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=120');

    return res.status(200).send(html);
  } catch (error) {
    console.error('[Blog] Error:', error);
    console.error('[Blog] Stack:', error.stack);
    return res.status(500).send(generateErrorHTML(frontendUrl));
  }
};

// ============================================================
// HTML GENERATORS
// ============================================================

function generateHTML({
  title,
  description,
  canonicalUrl,
  ogTitle,
  ogDescription,
  ogUrl,
  ogImage,
  jsonLd,
  slug,
  frontendUrl,
  post,
}) {
  const publishDate = post.created_at
    ? new Date(post.created_at * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />

    <!-- Primary Meta Tags -->
    <title>${escapeHtml(title)} - Pull That Up Jamie</title>
    <meta name="title" content="${escapeHtml(title)}" />
    <meta name="description" content="${escapeHtml(description)}" />

    <!-- Canonical -->
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(ogUrl)}" />
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDescription)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta property="og:site_name" content="Pull That Up Jamie" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escapeHtml(ogUrl)}" />
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(title)}" />

    <!-- JSON-LD Structured Data -->
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}

    <!-- Favicon -->
    <link rel="icon" href="${frontendUrl}/favicon.ico" />

    <!-- Redirect human users into the SPA -->
    <script>
      if (typeof window !== 'undefined') {
        window.location.replace('${frontendUrl}/app/blog/${encodeURIComponent(slug)}');
      }
    </script>
    <noscript>
      <meta http-equiv="refresh" content="0; url=${frontendUrl}/app/blog/${encodeURIComponent(slug)}" />
    </noscript>

    <style>
      body {
        margin: 0; padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          'Helvetica Neue', sans-serif;
        background: #000; color: #fff;
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; text-align: center;
      }
      .container { max-width: 500px; padding: 20px; }
      h1 { font-size: 24px; margin-bottom: 8px; }
      .date { font-size: 14px; color: #777; margin-bottom: 20px; }
      .spinner {
        border: 3px solid #333; border-top: 3px solid #fff;
        border-radius: 50%; width: 40px; height: 40px;
        animation: spin 1s linear infinite; margin: 20px auto;
      }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      p { font-size: 16px; color: #aaa; margin-bottom: 20px; }
      a { color: #fff; text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>${escapeHtml(title)}</h1>
      ${publishDate ? `<div class="date">${escapeHtml(publishDate)}</div>` : ''}
      <div class="spinner"></div>
      <p>Loading article...</p>
      <p>
        <a href="${frontendUrl}/app/blog/${encodeURIComponent(slug)}">
          Click here if you're not redirected automatically
        </a>
      </p>
    </div>
  </body>
</html>`;
}

function generateNotFoundHTML(frontendUrl) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Post Not Found - Pull That Up Jamie</title>
    <meta name="description" content="This blog post could not be found." />
    <link rel="icon" href="${frontendUrl}/favicon.ico" />
    <style>
      body {
        margin: 0; padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          'Helvetica Neue', sans-serif;
        background: #000; color: #fff;
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; text-align: center;
      }
      .container { max-width: 500px; padding: 20px; }
      h1 { font-size: 48px; margin-bottom: 16px; }
      h2 { font-size: 24px; margin-bottom: 16px; font-weight: normal; }
      p { font-size: 16px; color: #aaa; margin-bottom: 20px; }
      a {
        display: inline-block; margin-top: 20px;
        padding: 12px 24px; background: #fff; color: #000;
        text-decoration: none; border-radius: 8px; font-weight: 500;
      }
      a:hover { background: #eee; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>404</h1>
      <h2>Post Not Found</h2>
      <p>This blog post doesn't exist or has been removed.</p>
      <a href="${frontendUrl}/blog">Back to Blog</a>
    </div>
  </body>
</html>`;
}

function generateErrorHTML(frontendUrl) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Error Loading Post - Pull That Up Jamie</title>
    <meta name="description" content="An error occurred while loading this blog post." />
    <link rel="icon" href="${frontendUrl}/favicon.ico" />
    <style>
      body {
        margin: 0; padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          'Helvetica Neue', sans-serif;
        background: #000; color: #fff;
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; text-align: center;
      }
      .container { max-width: 500px; padding: 20px; }
      h1 { font-size: 36px; margin-bottom: 16px; }
      p { font-size: 16px; color: #aaa; margin-bottom: 20px; }
      a {
        display: inline-block; margin-top: 20px;
        padding: 12px 24px; background: #fff; color: #000;
        text-decoration: none; border-radius: 8px; font-weight: 500;
      }
      a:hover { background: #eee; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Error Loading Post</h1>
      <p>We encountered an error while loading this blog post. Please try again later.</p>
      <a href="${frontendUrl}/blog">Back to Blog</a>
    </div>
  </body>
</html>`;
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

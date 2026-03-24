/**
 * Vercel Serverless Function for /blog/[slug]
 *
 * Serves full HTML with article content, SEO meta tags (canonical, OpenGraph,
 * JSON-LD), and rendered markdown body for crawlers, LLM agents, and AEO.
 * Human users (who execute JS) are redirected into the SPA at /app/blog/:slug
 * before the body renders.
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

    const data = await response.json();
    const post = data.post || data;
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

  const articleHtml = markdownToHtml(post.content_md || '');
  const tags = Array.isArray(post.tags) ? post.tags : [];

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

    <!-- Redirect human users into the SPA (fires before body renders) -->
    <script>
      if (typeof window !== 'undefined') {
        window.location.replace('${frontendUrl}/app/blog/${encodeURIComponent(slug)}');
      }
    </script>

    <style>
      body {
        margin: 0; padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          'Helvetica Neue', sans-serif;
        background: #000; color: #e0e0e0;
        line-height: 1.7;
      }
      article {
        max-width: 720px; margin: 0 auto;
        padding: 40px 20px;
      }
      article header { margin-bottom: 32px; }
      article h1 { font-size: 32px; color: #fff; margin-bottom: 8px; line-height: 1.3; }
      article time { font-size: 14px; color: #777; }
      .article-body h2 { font-size: 24px; color: #fff; margin-top: 32px; }
      .article-body h3 { font-size: 20px; color: #fff; margin-top: 24px; }
      .article-body p { margin: 16px 0; }
      .article-body a { color: #6cb4ff; }
      .article-body strong { color: #fff; }
      .article-body ul, .article-body ol { padding-left: 24px; margin: 16px 0; }
      .article-body li { margin: 8px 0; }
      .article-body pre {
        background: #111; border: 1px solid #333; border-radius: 8px;
        padding: 16px; overflow-x: auto; margin: 16px 0;
      }
      .article-body code { font-family: 'SF Mono', Menlo, monospace; font-size: 14px; }
      .article-body p code {
        background: #111; padding: 2px 6px; border-radius: 4px;
      }
      .article-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
      .article-body hr { border: none; border-top: 1px solid #333; margin: 32px 0; }
      .article-body table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      .article-body th, .article-body td { border: 1px solid #333; padding: 8px 12px; text-align: left; }
      .article-body th { background: #111; color: #fff; }
      .tags { margin-top: 32px; }
      .tags span {
        display: inline-block; background: #1a1a1a; border: 1px solid #333;
        border-radius: 4px; padding: 4px 10px; margin: 4px; font-size: 13px; color: #aaa;
      }
      .article-footer {
        margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;
        font-size: 14px; color: #777;
      }
      .article-footer a { color: #6cb4ff; }
    </style>
  </head>
  <body>
    <article>
      <header>
        <h1>${escapeHtml(title)}</h1>
        ${publishDate ? `<time datetime="${post.created_at ? new Date(post.created_at * 1000).toISOString() : ''}">${escapeHtml(publishDate)}</time>` : ''}
      </header>
      ${post.summary ? `<p><em>${escapeHtml(post.summary)}</em></p>` : ''}
      <div class="article-body">
        ${articleHtml}
      </div>
      ${tags.length ? `<div class="tags">${tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="article-footer">
        <p>Published on <a href="https://pullthatupjamie.ai">Pull That Up Jamie</a></p>
        <p><a href="${frontendUrl}/app/blog/${encodeURIComponent(slug)}">Read on Pull That Up Jamie &rarr;</a></p>
      </div>
    </article>
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

// ============================================================
// MARKDOWN → HTML (lightweight, no dependencies)
// ============================================================

function markdownToHtml(md) {
  if (!md) return '';

  const codeBlocks = [];
  let processed = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `\n\n%%CODEBLOCK_${idx}%%\n\n`;
  });

  const tableBlocks = [];
  processed = processed.replace(/((?:^\|.+\|$\n?)+)/gm, (match) => {
    const idx = tableBlocks.length;
    tableBlocks.push(parseTable(match.trim()));
    return `\n\n%%TABLE_${idx}%%\n\n`;
  });

  const blocks = processed.split(/\n\n+/);
  const htmlBlocks = blocks.map(block => {
    block = block.trim();
    if (!block) return '';

    const cbMatch = block.match(/^%%CODEBLOCK_(\d+)%%$/);
    if (cbMatch) return codeBlocks[parseInt(cbMatch[1])];

    const tbMatch = block.match(/^%%TABLE_(\d+)%%$/);
    if (tbMatch) return tableBlocks[parseInt(tbMatch[1])];

    if (/^---+$/.test(block)) return '<hr />';

    if (block.startsWith('#### ')) return `<h4>${inlineMarkdown(block.slice(5))}</h4>`;
    if (block.startsWith('### ')) return `<h3>${inlineMarkdown(block.slice(4))}</h3>`;
    if (block.startsWith('## ')) return `<h2>${inlineMarkdown(block.slice(3))}</h2>`;
    if (block.startsWith('# ')) return `<h1>${inlineMarkdown(block.slice(2))}</h1>`;

    const lines = block.split('\n');
    if (lines.every(l => /^[-*] /.test(l.trim()))) {
      const items = lines.map(l => `<li>${inlineMarkdown(l.trim().replace(/^[-*] /, ''))}</li>`);
      return `<ul>${items.join('')}</ul>`;
    }
    if (lines.every(l => /^\d+\. /.test(l.trim()))) {
      const items = lines.map(l => `<li>${inlineMarkdown(l.trim().replace(/^\d+\. /, ''))}</li>`);
      return `<ol>${items.join('')}</ol>`;
    }

    return `<p>${inlineMarkdown(block).replace(/\n/g, '<br />')}</p>`;
  });

  return htmlBlocks.filter(Boolean).join('\n');
}

function inlineMarkdown(text) {
  let r = escapeHtml(text);
  r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  r = r.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  r = r.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
  r = r.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');
  r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
  return r;
}

function parseTable(tableStr) {
  const rows = tableStr.split('\n').filter(r => r.trim());
  if (rows.length < 2) return escapeHtml(tableStr);

  const parseRow = row => row.split('|').slice(1, -1).map(c => c.trim());
  const headerCells = parseRow(rows[0]);

  const isSep = row => /^\|[\s\-:|]+\|$/.test(row.trim());
  const dataStart = isSep(rows[1]) ? 2 : 1;

  let html = '<table><thead><tr>';
  headerCells.forEach(c => { html += `<th>${inlineMarkdown(c)}</th>`; });
  html += '</tr></thead><tbody>';

  for (let i = dataStart; i < rows.length; i++) {
    if (isSep(rows[i])) continue;
    const cells = parseRow(rows[i]);
    html += '<tr>';
    cells.forEach(c => { html += `<td>${inlineMarkdown(c)}</td>`; });
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

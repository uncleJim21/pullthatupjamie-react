/**
 * Vercel Serverless Function for /sitemap.xml
 *
 * Builds a sitemap that lists static high-value pages plus every blog post
 * (using the backend-provided canonical URL). Crawlers and LLM agents pick up
 * /blog/{slug} from here without depending on whatever URL form happens to
 * leak into share links.
 */

const fetch = require('node-fetch');
const { FRONTEND_URL, API_URL } = require('../src/config/urls.js');

const FETCH_TIMEOUT_MS = 6000;
const PAGE_SIZE = 200;
const MAX_PAGES = 20;

module.exports = async function handler(req, res) {
  const frontendUrl = stripTrailingSlash(FRONTEND_URL);

  try {
    const posts = await fetchAllPosts();
    const xml = buildSitemap(frontendUrl, posts);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('[Sitemap] Error:', error);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buildSitemap(frontendUrl, []));
  }
};

async function fetchAllPosts() {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${API_URL}/api/blog?page=${page}&limit=${PAGE_SIZE}`;
    const data = await fetchJson(url);
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    all.push(...posts);

    const totalPages = Number(data?.totalPages);
    if (!Number.isFinite(totalPages) || page >= totalPages) break;
    if (posts.length < PAGE_SIZE) break;
  }
  return all;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Backend ${res.status} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildSitemap(frontendUrl, posts) {
  const staticEntries = [
    { loc: `${frontendUrl}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${frontendUrl}/blog`, changefreq: 'daily', priority: '0.9' },
  ];

  const postEntries = posts
    .filter(p => p && p.slug)
    .map(p => {
      const loc = (p.seo && p.seo.canonical_url) || `${frontendUrl}/blog/${p.slug}`;
      const lastmodSeconds = p.updated_at || p.created_at;
      const lastmod = lastmodSeconds
        ? new Date(lastmodSeconds * 1000).toISOString()
        : null;
      return { loc, lastmod, changefreq: 'monthly', priority: '0.8' };
    });

  const entries = [...staticEntries, ...postEntries];

  const urls = entries.map(entry => {
    const parts = [
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
      entry.priority ? `    <priority>${entry.priority}</priority>` : null,
    ].filter(Boolean).join('\n');
    return `  <url>\n${parts}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function stripTrailingSlash(url) {
  if (typeof url !== 'string') return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

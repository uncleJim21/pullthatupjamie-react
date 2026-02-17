import { API_URL } from '../constants/constants.ts';

// ============================================================
// TYPES
// ============================================================

export interface BlogPostSummary {
  nostr_event_id: string;
  title: string;
  slug: string;
  summary: string;
  created_at: number;
  updated_at: number;
  source: string;
  source_url: string;
  tags: string[];
  seo?: {
    og_image?: string;
    canonical_url?: string;
    meta_description?: string;
  };
}

export interface BlogPostSeo {
  meta_description: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_url: string;
  og_image: string;
  json_ld: Record<string, unknown>;
}

export interface BlogPostFull extends BlogPostSummary {
  content_md: string;
  seo: BlogPostSeo;
}

export interface BlogListResponse {
  posts: BlogPostSummary[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================
// API CALLS
// ============================================================

/**
 * Fetch paginated blog post list.
 * Matches backend: GET /api/blog?page=1&limit=20&tag=bitcoin
 */
export async function fetchBlogPosts(
  page: number = 1,
  limit: number = 20,
  tag?: string
): Promise<BlogListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (tag) params.set('tag', tag);

  const res = await fetch(`${API_URL}/api/blog?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Blog list fetch failed: ${res.status}`);
  }

  const data = await res.json();
  // Backend wraps response: { success, posts, total, page, limit }
  return {
    posts: data.posts ?? [],
    total: data.total ?? 0,
    page: data.page ?? page,
    limit: data.limit ?? limit,
  };
}

/**
 * Fetch a single blog post by slug with full SEO metadata.
 * Matches backend: GET /api/blog/:slug
 */
export async function fetchBlogPost(slug: string): Promise<BlogPostFull> {
  const res = await fetch(`${API_URL}/api/blog/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) {
    throw new NotFoundError(`Post not found: ${slug}`);
  }

  if (!res.ok) {
    throw new Error(`Blog post fetch failed: ${res.status}`);
  }

  const data = await res.json();
  // Backend wraps response: { success, post: { ... } }
  return data.post;
}

// ============================================================
// ERRORS
// ============================================================

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

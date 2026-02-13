import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Calendar, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchBlogPosts, BlogPostSummary } from '../../services/blogService.ts';

// ============================================================
// HELPERS
// ============================================================

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================================
// BLOG INDEX PAGE
// ============================================================

const BlogIndex: React.FC = () => {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const LIMIT = 20;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBlogPosts(page, LIMIT);
        if (!cancelled) {
          setPosts(data.posts ?? []);
          setTotal(data.total ?? 0);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load posts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <Helmet>
        <title>Blog - Pull That Up Jamie</title>
        <meta name="description" content="Articles on podcasting, AI, Bitcoin, and the open web from Pull That Up Jamie." />
        <meta property="og:title" content="Blog - Pull That Up Jamie" />
        <meta property="og:description" content="Articles on podcasting, AI, Bitcoin, and the open web." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div style={styles.page}>
        {/* Header */}
        <header style={styles.header}>
          <Link to="/" style={styles.backLink}>
            <ArrowLeft size={18} />
            <span>Home</span>
          </Link>
          <h1 style={styles.title}>Blog</h1>
          <p style={styles.subtitle}>
            Thoughts on podcasting, AI, Bitcoin, and the open web
          </p>
        </header>

        {/* Content */}
        <main style={styles.main}>
          {loading && (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Loading posts...</p>
            </div>
          )}

          {error && (
            <div style={styles.errorContainer}>
              <p style={styles.errorText}>{error}</p>
              <button onClick={() => setPage(page)} style={styles.retryButton}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div style={styles.emptyContainer}>
              <p style={styles.emptyText}>No posts yet. Check back soon!</p>
            </div>
          )}

          {!loading && !error && posts.length > 0 && (
            <>
              <ul style={styles.postList}>
                {posts.map((post) => (
                  <li key={post.slug} style={styles.postItem}>
                    <Link to={`/app/blog/${post.slug}`} style={styles.postLink}>
                      <article style={styles.postCard}>
                        <h2 style={styles.postTitle}>{post.title}</h2>

                        <div style={styles.postMeta}>
                          <span style={styles.metaItem}>
                            <Calendar size={14} />
                            {formatDate(post.created_at)}
                          </span>
                          {post.tags && post.tags.length > 0 && (
                            <span style={styles.metaItem}>
                              <Tag size={14} />
                              {post.tags.slice(0, 3).join(', ')}
                            </span>
                          )}
                        </div>

                        {post.summary && (
                          <p style={styles.postSummary}>{post.summary}</p>
                        )}

                        <span style={styles.readMore}>Read more &rarr;</span>
                      </article>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav style={styles.pagination}>
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    style={{
                      ...styles.pageButton,
                      ...(page <= 1 ? styles.pageButtonDisabled : {}),
                    }}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>

                  <span style={styles.pageInfo}>
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    style={{
                      ...styles.pageButton,
                      ...(page >= totalPages ? styles.pageButtonDisabled : {}),
                    }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </nav>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
};

// ============================================================
// STYLES (inline, matching dark theme)
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  },
  header: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '48px 24px 32px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#888',
    textDecoration: 'none',
    fontSize: 14,
    marginBottom: 24,
    transition: 'color 0.2s',
  },
  title: {
    fontSize: 42,
    fontWeight: 700,
    margin: '0 0 12px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 18,
    color: '#999',
    margin: 0,
    lineHeight: 1.5,
  },
  main: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '0 24px 64px',
  },

  // Loading
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '80px 0',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #333',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 14,
  },

  // Error
  errorContainer: {
    textAlign: 'center',
    padding: '80px 0',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    background: '#fff',
    color: '#000',
    border: 'none',
    padding: '10px 24px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },

  // Empty
  emptyContainer: {
    textAlign: 'center',
    padding: '80px 0',
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
  },

  // Post list
  postList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  postItem: {
    borderBottom: '1px solid #1a1a1a',
  },
  postLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },
  postCard: {
    padding: '32px 0',
    transition: 'opacity 0.2s',
  },
  postTitle: {
    fontSize: 24,
    fontWeight: 600,
    margin: '0 0 12px',
    lineHeight: 1.3,
    color: '#fff',
  },
  postMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
    fontSize: 13,
    color: '#777',
  },
  metaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  },
  postSummary: {
    fontSize: 15,
    lineHeight: 1.6,
    color: '#aaa',
    margin: '0 0 12px',
  },
  readMore: {
    fontSize: 14,
    color: '#6b8afd',
    fontWeight: 500,
  },

  // Pagination
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: '40px 0',
  },
  pageButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    color: '#fff',
    border: '1px solid #333',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  pageButtonDisabled: {
    opacity: 0.3,
    cursor: 'default',
  },
  pageInfo: {
    color: '#888',
    fontSize: 14,
  },
};

export default BlogIndex;

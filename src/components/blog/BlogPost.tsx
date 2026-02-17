import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ArrowLeft, Calendar, ExternalLink, User, Share2, Link as LinkIcon, Mail, Check } from 'lucide-react';
import {
  fetchBlogPost,
  BlogPostFull,
  NotFoundError,
} from '../../services/blogService.ts';

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

/**
 * Extract author name from the SEO json_ld if available.
 */
function getAuthorName(seo: any): string | null {
  try {
    const author = seo?.json_ld?.author;
    if (typeof author === 'string') return author;
    if (author?.name) return author.name;
  } catch {}
  return null;
}

// ============================================================
// SMART MEDIA COMPONENT
// Handles both images and videos from markdown ![](url) syntax.
// Tries <img> first; if it fails to load (e.g. MP4), falls back to <video>.
// This avoids CORS issues with HEAD requests to third-party hosts.
// ============================================================

const MediaEmbed: React.FC<{ src?: string; alt?: string }> = ({ src, alt }) => {
  // null = try img first, true = confirmed video, false = confirmed image
  const [isVideo, setIsVideo] = useState<boolean | null>(null);

  if (!src) return null;

  // Render as <video> (confirmed or fallback)
  if (isVideo === true) {
    return (
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        style={{
          maxWidth: '100%',
          borderRadius: 8,
          margin: '1.5em 0',
          display: 'block',
          background: '#111',
        }}
      >
        <a href={src}>Download video</a>
      </video>
    );
  }

  // Try <img> first — if it errors (can't decode MP4 as image), switch to <video>
  return (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      style={{
        maxWidth: '100%',
        borderRadius: 8,
        margin: '1.5em 0',
        display: 'block',
      }}
      onError={() => setIsVideo(true)}
    />
  );
};

// ============================================================
// SHARE BAR
// ============================================================

const XIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ShareBarProps {
  title: string;
  url: string;
  summary?: string;
}

const ShareBar: React.FC<ShareBarProps> = ({ title, url, summary }) => {
  const [copied, setCopied] = useState(false);

  const shareOnX = () => {
    const text = `${title}\n\n${url}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${summary ? summary + '\n\n' : ''}${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={shareStyles.bar}>
      <span style={shareStyles.label}>
        <Share2 size={14} />
        Share
      </span>
      <div style={shareStyles.buttons}>
        <button onClick={shareOnX} style={shareStyles.btn} title="Share on X">
          <XIcon size={15} />
          <span>Post</span>
        </button>
        <button onClick={shareViaEmail} style={shareStyles.btn} title="Share via email">
          <Mail size={15} />
          <span>Email</span>
        </button>
        <button onClick={copyLink} style={shareStyles.btn} title="Copy link">
          {copied ? <Check size={15} /> : <LinkIcon size={15} />}
          <span>{copied ? 'Copied!' : 'Copy link'}</span>
        </button>
      </div>
    </div>
  );
};

const shareStyles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '16px 0',
    borderTop: '1px solid #1a1a1a',
    marginTop: 8,
  },
  label: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#666',
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  buttons: {
    display: 'flex',
    gap: 8,
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#111',
    color: '#ccc',
    border: '1px solid #2a2a2a',
    padding: '7px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  },
};

// ============================================================
// BLOG POST PAGE
// ============================================================

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const data = await fetchBlogPost(slug!);
        if (!cancelled) setPost(data);
      } catch (err: any) {
        if (!cancelled) {
          if (err instanceof NotFoundError) {
            setNotFound(true);
          } else {
            setError(err.message ?? 'Failed to load post');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // ---- Loading state ----
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading post...</p>
          </div>
        </div>
      </div>
    );
  }

  // ---- 404 state ----
  if (notFound) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.notFoundContainer}>
            <h1 style={{ fontSize: 48, marginBottom: 16 }}>404</h1>
            <p style={{ color: '#888', fontSize: 18, marginBottom: 24 }}>
              This post could not be found.
            </p>
            <Link to="/blog" style={styles.backButton}>
              &larr; Back to blog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !post) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.errorContainer}>
            <p style={styles.errorText}>{error ?? 'Something went wrong'}</p>
            <Link to="/blog" style={styles.backButton}>
              &larr; Back to blog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Loaded state ----
  const seo = post.seo || {} as any;
  const authorName = getAuthorName(seo);

  // Custom components for ReactMarkdown — swap <img> for smart MediaEmbed
  const markdownComponents = {
    img: ({ node, src, alt, ...props }: any) => (
      <MediaEmbed src={src} alt={alt} />
    ),
  };

  return (
    <>
      {/* SEO head tags (client-side, for in-SPA navigation) */}
      <Helmet>
        <title>{`${post.title} - Pull That Up Jamie`}</title>
        <meta name="description" content={seo.meta_description || post.summary || ''} />
        <link rel="canonical" href={seo.canonical_url || ''} />

        {/* OpenGraph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={seo.og_title || post.title} />
        <meta property="og:description" content={seo.og_description || post.summary || ''} />
        <meta property="og:url" content={seo.og_url || seo.canonical_url || ''} />
        {seo.og_image && <meta property="og:image" content={seo.og_image} />}
        <meta property="og:site_name" content="Pull That Up Jamie" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.og_title || post.title} />
        <meta name="twitter:description" content={seo.og_description || post.summary || ''} />
        {seo.og_image && <meta name="twitter:image" content={seo.og_image} />}

        {/* JSON-LD */}
        {seo.json_ld && (
          <script type="application/ld+json">
            {JSON.stringify(seo.json_ld)}
          </script>
        )}
      </Helmet>

      <div style={styles.page}>
        <div style={styles.container}>
          {/* Nav */}
          <nav style={styles.nav}>
            <Link to="/blog" style={styles.backLink}>
              <ArrowLeft size={18} />
              <span>Blog</span>
            </Link>
          </nav>

          {/* Article header */}
          <header style={styles.articleHeader}>
            <h1 style={styles.articleTitle}>{post.title}</h1>

            <div style={styles.articleMeta}>
              {authorName && (
                <span style={styles.metaItem}>
                  <User size={14} />
                  {authorName}
                </span>
              )}
              <span style={styles.metaItem}>
                <Calendar size={14} />
                {formatDate(post.created_at)}
              </span>
              {post.updated_at && post.updated_at !== post.created_at && (
                <span style={styles.metaItem}>
                  Updated {formatDate(post.updated_at)}
                </span>
              )}
              {post.source_url && (
                <a
                  href={post.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.sourceLink}
                >
                  <ExternalLink size={14} />
                  View on {post.source || 'source'}
                </a>
              )}
            </div>

            {post.tags && post.tags.length > 0 && (
              <div style={styles.tagList}>
                {post.tags.map((tag) => (
                  <span key={tag} style={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <ShareBar
              title={post.title}
              url={seo.canonical_url || window.location.href}
              summary={post.summary}
            />
          </header>

          {/* Article body */}
          <article style={styles.articleBody} className="blog-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={markdownComponents}
            >
              {post.content_md}
            </ReactMarkdown>
          </article>

          {/* Share */}
          <ShareBar
            title={post.title}
            url={seo.canonical_url || window.location.href}
            summary={post.summary}
          />

          {/* Footer */}
          <footer style={styles.articleFooter}>
            <Link to="/blog" style={styles.backButton}>
              &larr; Back to blog
            </Link>
          </footer>
        </div>
      </div>

      {/* Scoped prose styles for markdown content */}
      <style>{`
        .blog-prose {
          font-size: 17px;
          line-height: 1.75;
          color: #d4d4d4;
        }
        .blog-prose h1,
        .blog-prose h2,
        .blog-prose h3,
        .blog-prose h4 {
          color: #fff;
          margin-top: 2em;
          margin-bottom: 0.75em;
          line-height: 1.3;
        }
        .blog-prose h2 { font-size: 1.6em; }
        .blog-prose h3 { font-size: 1.3em; }
        .blog-prose p {
          margin-bottom: 1.25em;
        }
        .blog-prose a {
          color: #6b8afd;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .blog-prose a:hover {
          color: #93a9fe;
        }
        .blog-prose blockquote {
          border-left: 3px solid #333;
          padding-left: 20px;
          margin-left: 0;
          color: #999;
          font-style: italic;
        }
        .blog-prose code {
          background: #1a1a1a;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.9em;
          color: #e0e0e0;
        }
        .blog-prose pre {
          background: #111;
          border: 1px solid #222;
          border-radius: 8px;
          padding: 16px 20px;
          overflow-x: auto;
          margin: 1.5em 0;
        }
        .blog-prose pre code {
          background: none;
          padding: 0;
        }
        .blog-prose img {
          max-width: 100%;
          border-radius: 8px;
          margin: 1.5em 0;
        }
        .blog-prose ul,
        .blog-prose ol {
          padding-left: 1.5em;
          margin-bottom: 1.25em;
        }
        .blog-prose li {
          margin-bottom: 0.5em;
        }
        .blog-prose hr {
          border: none;
          border-top: 1px solid #222;
          margin: 2em 0;
        }
        .blog-prose table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5em 0;
        }
        .blog-prose th,
        .blog-prose td {
          border: 1px solid #333;
          padding: 8px 12px;
          text-align: left;
        }
        .blog-prose th {
          background: #111;
          color: #fff;
          font-weight: 600;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  },
  container: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '0 24px',
  },

  // Nav
  nav: {
    padding: '32px 0 0',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#888',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'color 0.2s',
  },

  // Article header
  articleHeader: {
    padding: '40px 0 32px',
    borderBottom: '1px solid #1a1a1a',
    marginBottom: 40,
  },
  articleTitle: {
    fontSize: 38,
    fontWeight: 700,
    margin: '0 0 16px',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  articleMeta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    fontSize: 14,
    color: '#777',
  },
  metaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  },
  sourceLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    color: '#6b8afd',
    textDecoration: 'none',
    fontSize: 14,
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  tag: {
    display: 'inline-block',
    background: '#1a1a1a',
    color: '#aaa',
    padding: '4px 12px',
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 500,
  },

  // Article body
  articleBody: {
    paddingBottom: 40,
  },

  // Footer
  articleFooter: {
    borderTop: '1px solid #1a1a1a',
    padding: '32px 0 64px',
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#888',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'color 0.2s',
  },

  // States
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '120px 0',
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
  notFoundContainer: {
    textAlign: 'center',
    padding: '120px 0',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '120px 0',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginBottom: 24,
  },
};

export default BlogPost;

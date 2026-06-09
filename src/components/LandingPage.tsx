import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Search, Github, Twitter, Mail } from 'lucide-react';
import PageBanner from './PageBanner.tsx';
import { NavigationMode } from '../constants/constants.ts';
import { T } from './landingTokens.ts';

// Corpus facts — proof, not adjectives (PRODUCT.md: "show the corpus").
const CORPUS = [
  { value: '343', label: 'feeds' },
  { value: '121K', label: 'episodes' },
  { value: '24M', label: 'paragraphs' },
];

// ============================================================
// GLOBAL ANIMATION + RESPONSIVE STYLES
// One injected stylesheet for entrance reveals and breakpoints.
// All non-essential motion is disabled under prefers-reduced-motion.
// ============================================================
const GlobalStyles: React.FC = () => (
  <style>
    {`
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(24px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .reveal {
        animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0;
      }
      .reveal-d1 { animation-delay: 0.05s; }
      .reveal-d2 { animation-delay: 0.18s; }
      .reveal-d3 { animation-delay: 0.31s; }
      .reveal-d4 { animation-delay: 0.44s; }
      .reveal-d5 { animation-delay: 0.57s; }

      @media (prefers-reduced-motion: reduce) {
        .reveal { animation: none !important; opacity: 1 !important; transform: none !important; }
        * { scroll-behavior: auto !important; }
      }

      /* Hero */
      .lp-hero { padding: clamp(48px, 7vw, 96px) clamp(24px, 5vw, 64px); }
      .lp-hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
        gap: clamp(40px, 5vw, 80px);
        max-width: 1280px;
        margin: 0 auto;
        width: 100%;
        align-items: center;
      }
      .lp-headline { font-size: clamp(44px, 7vw, 80px); }
      @media (max-width: 920px) {
        .lp-hero-grid { grid-template-columns: 1fr; gap: 40px; }
        .lp-artifact { order: 2; max-width: 480px; }
        .lp-copy { order: 1; }
      }

      /* Search field focus ring */
      .lp-search-input::placeholder { color: ${T.textLo}; }
      .lp-search:focus-within {
        border-color: ${T.accent};
        box-shadow: 0 0 0 3px ${T.accentTint};
      }

      /* Paths band */
      .lp-paths { max-width: 1100px; margin: 0 auto; }
      .lp-path-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: clamp(16px, 3vw, 40px);
        align-items: center;
        padding: clamp(24px, 3vw, 36px) clamp(8px, 2vw, 20px);
        border-top: 1px solid ${T.hairlineSoft};
        cursor: pointer;
        transition: background 0.25s ease, padding-left 0.3s cubic-bezier(0.16,1,0.3,1);
      }
      .lp-path-row:last-child { border-bottom: 1px solid ${T.hairlineSoft}; }
      .lp-path-row:hover { background: oklch(0.97 0.004 80 / 0.025); }
      @media (min-width: 700px) {
        .lp-path-row:hover { padding-left: clamp(20px, 3vw, 36px); }
      }
      @media (max-width: 640px) {
        .lp-path-row { grid-template-columns: auto 1fr; }
        .lp-path-desc { display: none; }
      }

      /* Why-Jamie split */
      .lp-why-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: clamp(40px, 5vw, 72px);
        max-width: 1180px;
        margin: 0 auto;
        align-items: center;
      }
      @media (max-width: 980px) {
        .lp-why-grid { grid-template-columns: 1fr; gap: 40px; }
        .lp-why-image { order: 2; max-width: 420px; margin: 0 auto; }
      }
    `}
  </style>
);

// Scroll-reveal hook: returns [ref, isVisible].
function useReveal<T extends HTMLElement>(threshold = 0.18): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ============================================================
// CORPUS READOUT — live-data feel, real numbers in mono
// ============================================================
const CorpusReadout: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={className}
    style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '20px',
      fontFamily: T.mono,
      flexWrap: 'wrap',
    }}
  >
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: T.textLo,
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: T.accent,
          boxShadow: `0 0 8px ${T.accent}`,
        }}
      />
      Indexed
    </span>
    {CORPUS.map((c) => (
      <span key={c.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '17px', fontWeight: 600, color: T.textHi }}>{c.value}</span>
        <span style={{ fontSize: '12px', color: T.textLo, letterSpacing: '0.02em' }}>{c.label}</span>
      </span>
    ))}
  </div>
);

// ============================================================
// HERO — search-forward, galaxy embed kept prominent
// ============================================================
const HeroSegment: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/app?q=${encodeURIComponent(q)}` : '/app');
  };

  return (
    <section className="lp-hero" style={{ position: 'relative', minHeight: '78vh', display: 'flex', alignItems: 'center' }}>
      {/* Single restrained glow — replaces the cosmic field */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-10%',
          left: '8%',
          width: '60%',
          height: '70%',
          background: `radial-gradient(ellipse at center, ${T.accentTint} 0%, transparent 70%)`,
          filter: 'blur(40px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="lp-hero-grid" style={{ position: 'relative', zIndex: 1 }}>
        {/* COPY + SEARCH */}
        <div className="lp-copy">
          <CorpusReadout className="reveal reveal-d1" />

          <h1
            className="lp-headline reveal reveal-d2"
            style={{
              fontFamily: T.sans,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: '-0.035em',
              color: T.textHi,
              margin: '24px 0 20px',
            }}
          >
            More signal.<br />Less slop.
          </h1>

          <p
            className="reveal reveal-d3"
            style={{
              fontFamily: T.sans,
              fontSize: 'clamp(16px, 1.6vw, 19px)',
              fontWeight: 400,
              lineHeight: 1.6,
              color: T.textMid,
              maxWidth: '34ch',
              marginBottom: '32px',
            }}
          >
            Search thousands of podcasts by meaning, not keywords. Find the exact
            moment something was said, hear it, and explore how ideas connect.
          </p>

          {/* Real search — routes into /app?q= */}
          <form className="reveal reveal-d4" onSubmit={submitSearch} style={{ marginBottom: '20px' }}>
            <div
              className="lp-search"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: T.surfaceInput,
                border: `1px solid ${T.hairline}`,
                borderRadius: '12px',
                padding: '6px 6px 6px 16px',
                maxWidth: '600px',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <Search size={18} style={{ color: T.textLo, flexShrink: 0 }} />
              <input
                className="lp-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Ask anything: "Saylor on AI?"'
                aria-label="Search podcasts by meaning"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: T.textHi,
                  fontFamily: T.sans,
                  fontSize: '16px',
                  padding: '10px 0',
                }}
              />
              <button
                type="submit"
                aria-label="Search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: T.textHi,
                  color: T.surface0,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '11px 18px',
                  fontFamily: T.sans,
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.18s cubic-bezier(0.16,1,0.3,1), background 0.18s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Search
                <ArrowRight size={16} />
              </button>
            </div>
          </form>

          {/* The machine door */}
          <a
            className="reveal reveal-d5"
            href="/for-agents"
            onClick={(e) => { e.preventDefault(); navigate('/for-agents'); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: T.mono,
              fontSize: '13px',
              letterSpacing: '0.02em',
              color: T.accent,
              textDecoration: 'none',
              transition: 'color 0.2s ease, gap 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.accentBright; e.currentTarget.style.gap = '12px'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.accent; e.currentTarget.style.gap = '8px'; }}
          >
            {'>'} Are you an agent?
            <ArrowUpRight size={14} />
          </a>
        </div>

        {/* ARTIFACT — the live galaxy embed (kept prominent) */}
        <div className="lp-artifact reveal reveal-d3" style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              aspectRatio: '1 / 1',
              borderRadius: '14px',
              overflow: 'hidden',
              border: `1px solid ${T.hairline}`,
              background: 'oklch(0.12 0.005 80)',
              boxShadow: '0 8px 40px oklch(0 0 0 / 0.5)',
              position: 'relative',
            }}
          >
            <iframe
              src={`${window.location.origin}/app?sharedSession=08fc784abd3a&embed=true`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Jamie — a live galaxy of connected podcast moments"
              allow="autoplay"
            />
          </div>
          <p
            style={{
              fontFamily: T.mono,
              fontSize: '12px',
              color: T.textLo,
              marginTop: '14px',
              textAlign: 'center',
              letterSpacing: '0.04em',
            }}
          >
            ↑ live · click any star to explore
          </p>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// PATHS — the human/agent fork, as a hairline-separated band
// (deliberately not a card grid)
// ============================================================
interface PathItem {
  index: string;
  title: string;
  desc: string;
  cta: string;
  link: string;
  machine?: boolean;
}

const PATHS: PathItem[] = [
  {
    index: '01',
    title: 'Explore conversations',
    desc: 'Search by meaning, then navigate a 3D galaxy of connected ideas across feeds, speakers, and themes.',
    cta: 'Open the app',
    link: '/app',
  },
  {
    index: '02',
    title: 'Creator tools',
    desc: 'Turn a back catalog into clips, captions, and audience intelligence. Find your best moments automatically.',
    cta: 'For podcasters',
    link: '/for-podcasters',
  },
  {
    index: '03',
    title: 'Are you an agent?',
    desc: 'A public API, llms.txt, OpenAPI spec, and a plain-English orchestration layer. Built to be queried by machines.',
    cta: 'Machine map',
    link: '/for-agents',
    machine: true,
  },
];

const PathRow: React.FC<{ item: PathItem }> = ({ item }) => {
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const font = item.machine ? T.mono : T.sans;

  return (
    <div
      className="lp-path-row"
      role="link"
      tabIndex={0}
      onClick={() => navigate(item.link)}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(item.link); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        style={{
          fontFamily: T.mono,
          fontSize: '13px',
          color: item.machine ? T.accent : T.textLo,
          letterSpacing: '0.04em',
        }}
      >
        {item.index}
      </span>

      <div>
        <h3
          style={{
            fontFamily: font,
            fontSize: 'clamp(20px, 2.6vw, 28px)',
            fontWeight: item.machine ? 500 : 600,
            color: hover ? (item.machine ? T.accentBright : T.textHi) : T.textHi,
            letterSpacing: item.machine ? '-0.01em' : '-0.02em',
            marginBottom: '6px',
            transition: 'color 0.2s ease',
          }}
        >
          {item.title}
        </h3>
        <p
          className="lp-path-desc"
          style={{
            fontFamily: T.sans,
            fontSize: '15px',
            lineHeight: 1.55,
            color: T.textMid,
            maxWidth: '62ch',
          }}
        >
          {item.desc}
        </p>
      </div>

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: item.machine ? T.mono : T.sans,
          fontSize: '14px',
          fontWeight: 600,
          color: item.machine ? T.accent : (hover ? T.textHi : T.textMid),
          whiteSpace: 'nowrap',
          transition: 'color 0.2s ease',
        }}
      >
        {item.cta}
        <ArrowRight
          size={16}
          style={{
            transform: hover ? 'translateX(3px)' : 'translateX(0)',
            transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </span>
    </div>
  );
};

const PathsSection: React.FC = () => {
  const [ref, visible] = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      style={{
        padding: 'clamp(64px, 9vw, 120px) clamp(24px, 5vw, 64px)',
        position: 'relative',
      }}
    >
      <div className="lp-paths">
        <p
          style={{
            fontFamily: T.mono,
            fontSize: '12px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: T.textLo,
            marginBottom: '28px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          Where to start
        </p>
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s',
          }}
        >
          {PATHS.map((p) => <PathRow key={p.index} item={p} />)}
        </div>
      </div>
    </section>
  );
};

// ============================================================
// WHY JAMIE EXISTS — story, re-skinned, accessible contrast
// ============================================================
const WhyJamieExistsSection: React.FC = () => {
  const [ref, visible] = useReveal<HTMLElement>(0.15);

  const reveal = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
  });

  const body: React.CSSProperties = {
    fontFamily: T.sans,
    fontSize: '17px',
    lineHeight: 1.75,
    color: T.textMid,
    marginBottom: '20px',
    maxWidth: '64ch',
  };

  return (
    <section
      ref={ref}
      style={{
        padding: 'clamp(72px, 10vw, 130px) clamp(24px, 5vw, 64px)',
        borderTop: `1px solid ${T.hairlineSoft}`,
        position: 'relative',
      }}
    >
      <div className="lp-why-grid">
        <div>
          <h2
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: 'clamp(30px, 4.4vw, 46px)',
              color: T.textHi,
              marginBottom: '28px',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              ...reveal(0),
            }}
          >
            Why Jamie exists
          </h2>

          <p style={{ ...body, fontSize: '20px', color: T.textHi, fontWeight: 500, ...reveal(0.1) }}>
            We don't have an information problem.<br />
            We have a sense-making problem.
          </p>

          <p style={{ ...body, ...reveal(0.2) }}>
            AI has flooded the world with answers, many of them wrong, shallow, or
            disconnected from reality. Prompting has replaced understanding. Context
            gets flattened. Meaning gets lost.
          </p>

          <p style={{ ...body, ...reveal(0.3) }}>
            Meanwhile, the most valuable ideas still live in real sources: authentic
            conversations, podcasts, internal knowledge, research, and long-form
            thinking. <span style={{ color: T.textHi, fontWeight: 500 }}>The problem is the tools.</span>
          </p>

          <p style={{ ...body, ...reveal(0.4) }}>
            Jamie turns real information into something you can navigate, not just
            query. It takes genuine data, from podcasts to documentation to archives,
            and makes it intelligible, explorable, and connected.
          </p>

          <p style={{ ...body, color: T.textHi, marginBottom: 0, ...reveal(0.5) }}>
            So humans can actually think again. Debate ideas. Grow. Learn. And become
            everything they were meant to be.
          </p>
        </div>

        <div className="lp-why-image" style={reveal(0.25)}>
          <img
            src="/why-jamie-hero.png"
            alt="A researcher tracing connections across a constellation of ideas"
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '14px',
              border: `1px solid ${T.hairlineSoft}`,
              filter: 'grayscale(35%)',
            }}
          />
        </div>
      </div>
    </section>
  );
};

// ============================================================
// FOOTER — adds a Developers / API column (agent-native truth)
// ============================================================
const footerLink: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '14px',
  color: T.textMid,
  textDecoration: 'none',
  transition: 'color 0.2s ease',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
};

const colHead: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: '12px',
  fontWeight: 500,
  color: T.textLo,
  marginBottom: '16px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};

const FooterLink: React.FC<{ href: string; external?: boolean; children: React.ReactNode }> = ({ href, external, children }) => (
  <a
    href={href}
    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    style={footerLink}
    onMouseEnter={(e) => { e.currentTarget.style.color = T.textHi; }}
    onMouseLeave={(e) => { e.currentTarget.style.color = T.textMid; }}
  >
    {children}
  </a>
);

const Footer: React.FC = () => {
  const [emailRevealed, setEmailRevealed] = useState(false);

  return (
    <footer
      style={{
        marginTop: '40px',
        padding: 'clamp(48px, 6vw, 72px) clamp(24px, 5vw, 64px) 48px',
        borderTop: `1px solid ${T.hairline}`,
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px', justifyContent: 'space-between' }}>
          {/* Brand */}
          <div style={{ minWidth: '220px', maxWidth: '300px' }}>
            <h4 style={{ fontFamily: T.sans, fontSize: '18px', fontWeight: 700, color: T.textHi, marginBottom: '14px', letterSpacing: '-0.01em' }}>
              Pull That Up Jamie
            </h4>
            <p style={{ fontFamily: T.sans, fontSize: '14px', color: T.textLo, lineHeight: 1.6 }}>
              Filtering out the slop and surfacing the signal. For the humans who
              still want to think, and the agents they send.
            </p>
          </div>

          {/* Developers / API */}
          <div style={{ minWidth: '170px' }}>
            <h5 style={colHead}>Developers</h5>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li><FooterLink href="/for-agents">For agents</FooterLink></li>
              <li><FooterLink href="/llms.txt" external>llms.txt</FooterLink></li>
              <li><FooterLink href="https://www.pullthatupjamie.ai/api/openapi.json" external>OpenAPI spec <ArrowUpRight size={13} /></FooterLink></li>
              <li><FooterLink href="https://clawhub.ai/unclejim21/pullthatupjamie" external>ClawHub skill <ArrowUpRight size={13} /></FooterLink></li>
            </ul>
          </div>

          {/* Connect */}
          <div style={{ minWidth: '170px' }}>
            <h5 style={colHead}>Connect</h5>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li><FooterLink href="https://github.com/uncleJim21/pullthatupjamie-react" external><Github size={16} />GitHub</FooterLink></li>
              <li><FooterLink href="https://x.com/PullThatUpJ_AI" external><Twitter size={16} />X / Twitter</FooterLink></li>
              <li>
                {emailRevealed ? (
                  <a href="mailto:jim@cascdr.xyz" style={{ ...footerLink, color: T.accent }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.accentBright; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.accent; }}>
                    <Mail size={16} />jim@cascdr.xyz
                  </a>
                ) : (
                  <button onClick={() => setEmailRevealed(true)} style={{ ...footerLink, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.textHi; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.textMid; }}>
                    <Mail size={16} />Email (click to reveal)
                  </button>
                )}
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div style={{ minWidth: '150px' }}>
            <h5 style={colHead}>Legal</h5>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li><FooterLink href="/privacy">Privacy Policy</FooterLink></li>
              <li><FooterLink href="/terms">Terms of Service</FooterLink></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            paddingTop: '24px',
            borderTop: `1px solid ${T.hairlineSoft}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <p style={{ fontFamily: T.mono, fontSize: '12px', color: T.textLo }}>
            © {new Date().getFullYear()} Pull That Up Jamie. Open source under GPL-3.0.
          </p>
          <p style={{ fontFamily: T.mono, fontSize: '12px', color: T.textLo }}>
            Built for sense-making.
          </p>
        </div>
      </div>
    </footer>
  );
};

// ============================================================
// PAGE
// ============================================================
const LandingPage: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: T.surface0,
        minHeight: '100vh',
        color: T.textHi,
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      <GlobalStyles />

      {/* Page Banner */}
      <div style={{ position: 'relative', zIndex: 20 }}>
        <PageBanner logoText="Pull That Up Jamie!" navigationMode={NavigationMode.CLEAN} />
      </div>

      {/* Content */}
      <main style={{ position: 'relative', zIndex: 1 }}>
        <HeroSegment />
        <PathsSection />
        <WhyJamieExistsSection />
        <Footer />
      </main>
    </div>
  );
};

export default LandingPage;

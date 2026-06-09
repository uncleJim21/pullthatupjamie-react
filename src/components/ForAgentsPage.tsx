import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, ArrowUpRight, ArrowLeft, Terminal } from 'lucide-react';
import PageBanner from './PageBanner.tsx';
import { NavigationMode } from '../constants/constants.ts';
import { T } from './landingTokens.ts';

// ============================================================
// /for-agents — the machine door
// Two jobs, one page:
//   1. A human pastes one gateway prompt into any chat.
//   2. A scraper reads real, linked resources and learns exactly
//      how to use Jamie. The page IS the machine map.
// ============================================================

const ORIGIN = 'https://www.pullthatupjamie.ai';

const GATEWAY_PROMPT = `Read ${ORIGIN}/llms.txt and the OpenAPI spec it references (${ORIGIN}/api/openapi.json). Jamie is a semantic podcast search API over 343 feeds, 121K episodes, and 24M indexed paragraphs, with a plain-English agent endpoint at POST /api/pull. Use it to help me find, research, and clip what was actually said across podcasts. Start by searching for: `;

const CURL = `curl -N ${ORIGIN}/api/pull \\
  -H "Content-Type: application/json" \\
  -H "X-Free-Tier: true" \\
  -d '{"query": "What are people saying about AI agents?", "stream": true}'`;

interface Resource {
  name: string;
  href: string;
  desc: string;
  auth?: string;
}

const RESOURCES: Resource[] = [
  {
    name: 'llms.txt',
    href: `${ORIGIN}/llms.txt`,
    desc: 'The map. Endpoints, canonical workflows, and auth in one LLM-readable file. Start here.',
  },
  {
    name: 'openapi.json',
    href: `${ORIGIN}/api/openapi.json`,
    desc: 'Full machine-readable spec (OpenAPI 3.0): search, discovery, research sessions, clips, transcription.',
  },
  {
    name: '/api/corpus/spec',
    href: `${ORIGIN}/api/corpus/spec`,
    desc: 'Human and LLM-readable markdown reference for the corpus-navigation endpoints.',
  },
  {
    name: '/api/corpus/stats',
    href: `${ORIGIN}/api/corpus/stats`,
    desc: 'Live corpus-wide counts (feeds, episodes, paragraphs, people, topics). No auth.',
    auth: 'no auth',
  },
  {
    name: 'ClawHub skill',
    href: 'https://clawhub.ai/unclejim21/pullthatupjamie',
    desc: 'Install Jamie as an agent skill: auth flow, search patterns, research-session workflows.',
  },
];

// ------------------------------------------------------------
// Copy-to-clipboard hook + button
// ------------------------------------------------------------
function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => { /* clipboard unavailable; no-op */ });
  };
  return [copied, copy];
}

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copy' }) => {
  const [copied, copy] = useCopy();
  return (
    <button
      onClick={() => copy(text)}
      aria-label={copied ? 'Copied' : label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: copied ? T.accentTint : T.textHi,
        color: copied ? T.accent : T.surface0,
        border: copied ? `1px solid ${T.accent}` : 'none',
        borderRadius: '8px',
        padding: '10px 16px',
        fontFamily: T.sans,
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.18s ease, color 0.18s ease, transform 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}
      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? 'Copied' : label}
    </button>
  );
};

// Small mono step marker, e.g. "01"
const StepLabel: React.FC<{ n: string; children: React.ReactNode }> = ({ n, children }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '20px' }}>
    <span style={{ fontFamily: T.mono, fontSize: '13px', color: T.accent, letterSpacing: '0.04em' }}>{n}</span>
    <h2 style={{ fontFamily: T.sans, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 600, color: T.textHi, letterSpacing: '-0.02em', margin: 0 }}>
      {children}
    </h2>
  </div>
);

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------
const ForAgentsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ backgroundColor: T.surface0, minHeight: '100vh', color: T.textHi, position: 'relative', overflowX: 'hidden' }}>
      <style>
        {`
          .fa-wrap { max-width: 880px; margin: 0 auto; padding: 0 clamp(24px, 5vw, 48px); }
          .fa-section { padding: clamp(40px, 6vw, 72px) 0; border-top: 1px solid ${T.hairlineSoft}; }
          .fa-resource {
            display: grid;
            grid-template-columns: minmax(0, 240px) 1fr auto;
            gap: clamp(12px, 2.5vw, 32px);
            align-items: center;
            padding: 22px 0;
            border-top: 1px solid ${T.hairlineSoft};
            text-decoration: none;
          }
          .fa-resource:last-child { border-bottom: 1px solid ${T.hairlineSoft}; }
          .fa-resource:hover .fa-resource-name { color: ${T.accentBright}; }
          .fa-resource:hover .fa-resource-arrow { transform: translate(2px, -2px); color: ${T.accent}; }
          @media (max-width: 680px) {
            .fa-resource { grid-template-columns: 1fr auto; }
            .fa-resource-desc { display: none; }
          }
          @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
        `}
      </style>

      <div style={{ position: 'relative', zIndex: 20 }}>
        <PageBanner logoText="Pull That Up Jamie!" navigationMode={NavigationMode.CLEAN} />
      </div>

      <main style={{ position: 'relative', zIndex: 1, paddingBottom: '80px' }}>
        {/* Restrained glow */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '70%', height: '420px',
            background: `radial-gradient(ellipse at center top, ${T.accentTint} 0%, transparent 70%)`,
            filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
          }}
        />

        {/* Intro */}
        <section className="fa-wrap" style={{ position: 'relative', zIndex: 1, paddingTop: 'clamp(48px, 7vw, 88px)', paddingBottom: 'clamp(16px, 3vw, 32px)' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '32px',
              fontFamily: T.mono, fontSize: '13px', color: T.textLo, transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.textHi; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.textLo; }}
          >
            <ArrowLeft size={14} /> back to pullthatupjamie
          </button>

          <p style={{ fontFamily: T.mono, fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.accent, marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={14} /> For agents &amp; developers
          </p>

          <h1 style={{ fontFamily: T.sans, fontWeight: 800, fontSize: 'clamp(38px, 6.5vw, 68px)', lineHeight: 1.04, letterSpacing: '-0.035em', color: T.textHi, margin: '0 0 22px' }}>
            Jamie speaks machine.
          </h1>

          <p style={{ fontFamily: T.sans, fontSize: 'clamp(16px, 1.8vw, 19px)', lineHeight: 1.65, color: T.textMid, maxWidth: '60ch', margin: 0 }}>
            A public API over <strong style={{ color: T.textHi, fontWeight: 600 }}>343 feeds</strong>, <strong style={{ color: T.textHi, fontWeight: 600 }}>121K episodes</strong>, and <strong style={{ color: T.textHi, fontWeight: 600 }}>24M semantically indexed paragraphs</strong>, with a plain-English orchestration layer at <code style={{ fontFamily: T.mono, fontSize: '0.92em', color: T.accent }}>POST /api/pull</code>. Point an agent at it in one paste, or wire the spec into your own tooling.
          </p>
        </section>

        {/* 01 — Gateway prompt */}
        <section className="fa-wrap fa-section" style={{ position: 'relative', zIndex: 1 }}>
          <StepLabel n="01">Paste this into any chat</StepLabel>
          <p style={{ fontFamily: T.sans, fontSize: '15px', color: T.textMid, lineHeight: 1.6, marginTop: 0, marginBottom: '20px', maxWidth: '62ch' }}>
            Drop this into Claude, ChatGPT, or any agent. It points the model at Jamie's map and spec, then hands it the keys. Add your topic to the end.
          </p>
          <div style={{ background: T.surfaceInput, border: `1px solid ${T.hairline}`, borderRadius: '14px', overflow: 'hidden' }}>
            <pre style={{
              fontFamily: T.mono, fontSize: '14px', lineHeight: 1.7, color: T.textMid,
              padding: 'clamp(18px, 3vw, 26px)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {GATEWAY_PROMPT}<span style={{ color: T.accent }}>[your topic]</span>
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: `1px solid ${T.hairlineSoft}` }}>
              <CopyButton text={GATEWAY_PROMPT} label="Copy prompt" />
            </div>
          </div>
        </section>

        {/* 02 — Resources */}
        <section className="fa-wrap fa-section" style={{ position: 'relative', zIndex: 1 }}>
          <StepLabel n="02">Or read the spec directly</StepLabel>
          <p style={{ fontFamily: T.sans, fontSize: '15px', color: T.textMid, lineHeight: 1.6, marginTop: 0, marginBottom: '12px', maxWidth: '62ch' }}>
            Every resource below is a real, crawlable URL. A scraper can follow them and learn the full API surface without a human in the loop.
          </p>
          <div role="list">
            {RESOURCES.map((r) => (
              <a key={r.name} className="fa-resource" role="listitem" href={r.href} target="_blank" rel="noopener noreferrer">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span className="fa-resource-name" style={{ fontFamily: T.mono, fontSize: '15px', fontWeight: 500, color: T.textHi, transition: 'color 0.2s ease', wordBreak: 'break-word' }}>
                    {r.name}
                  </span>
                  {r.auth && (
                    <span style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: T.accent, border: `1px solid ${T.accentTint}`, borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                      {r.auth}
                    </span>
                  )}
                </span>
                <span className="fa-resource-desc" style={{ fontFamily: T.sans, fontSize: '14px', color: T.textLo, lineHeight: 1.5 }}>
                  {r.desc}
                </span>
                <ArrowUpRight className="fa-resource-arrow" size={18} style={{ color: T.textLo, transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), color 0.2s ease', flexShrink: 0 }} />
              </a>
            ))}
          </div>
        </section>

        {/* 03 — Call it */}
        <section className="fa-wrap fa-section" style={{ position: 'relative', zIndex: 1 }}>
          <StepLabel n="03">Or just call it</StepLabel>
          <p style={{ fontFamily: T.sans, fontSize: '15px', color: T.textMid, lineHeight: 1.6, marginTop: 0, marginBottom: '20px', maxWidth: '62ch' }}>
            The orchestration endpoint takes a plain-English task and streams a multi-tool agent response (SSE). The free tier is anonymous, rate-limited by IP.
          </p>
          <div style={{ background: T.surfaceInput, border: `1px solid ${T.hairline}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: `1px solid ${T.hairlineSoft}` }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: T.accent }} />
              <span style={{ fontFamily: T.mono, fontSize: '12px', color: T.textLo, letterSpacing: '0.04em' }}>POST /api/pull · free tier</span>
            </div>
            <pre style={{
              fontFamily: T.mono, fontSize: '13.5px', lineHeight: 1.7, color: T.textMid,
              padding: 'clamp(18px, 3vw, 26px)', margin: 0, overflowX: 'auto',
            }}>
              {CURL}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: `1px solid ${T.hairlineSoft}` }}>
              <CopyButton text={CURL} label="Copy curl" />
            </div>
          </div>

          <p style={{ fontFamily: T.sans, fontSize: '14px', color: T.textLo, lineHeight: 1.65, marginTop: '24px', maxWidth: '64ch' }}>
            Need more volume? Hit any paid endpoint unauthenticated to get a 402 with a Lightning invoice, then send{' '}
            <code style={{ fontFamily: T.mono, fontSize: '0.92em', color: T.textMid }}>Authorization: L402 &lt;macaroon&gt;:&lt;preimage&gt;</code>. One credential works across every paid endpoint. ~500 sats covers 150+ searches.
          </p>
        </section>

        {/* Closing */}
        <section className="fa-wrap" style={{ position: 'relative', zIndex: 1, paddingTop: 'clamp(32px, 5vw, 56px)' }}>
          <p style={{ fontFamily: T.mono, fontSize: '13px', color: T.textLo, lineHeight: 1.7 }}>
            Human after all?{' '}
            <button
              onClick={() => navigate('/app')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: T.mono, fontSize: '13px', color: T.accent, textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              Open the app
            </button>
            {' '}and explore the galaxy yourself.
          </p>
        </section>
      </main>
    </div>
  );
};

export default ForAgentsPage;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { getReadIn } from '../../../services/tape/index.ts';
import type { ReadInResult, ReadInThesisSection, TapeDepth } from '../../../services/tape/index.ts';
import TapeCitationRow from '../TapeCitationRow.tsx';
import TapeTickerStrip from '../TapeTickerStrip.tsx';
import { TapeField, RunButton, TapeStatus, TapeResultFooter } from '../TapeActionScaffold.tsx';
import { formatShortDate } from '../../../utils/time.ts';
import { TICKER_READIN_APP_HEADER, TICKERS_READIN_APP_PEERS } from '../../../data/mockTapeAppTickers.ts';
import type { TapeTicker } from '../../../data/mockTapeTickers.ts';
import { useLiveTickers } from '../../../services/tape/useLiveTickers.ts';

type Status = 'idle' | 'loading' | 'error';

// ── Depth toggle (3-segment pill, mirrors the JamiePullAgent ModelToggle) ────
const DEPTHS: { id: TapeDepth; label: string }[] = [
  { id: 'quick', label: 'Quick' },
  { id: 'brief', label: 'Brief' },
  { id: 'deep',  label: 'Deep' },
];

const DepthToggle: React.FC<{ depth: TapeDepth; onChange: (d: TapeDepth) => void }> = ({ depth, onChange }) => (
  <div className="inline-flex items-center gap-0.5 rounded-lg border p-0.5" style={{ borderColor: 'var(--tape-hairline-strong)', background: 'var(--tape-bg-inset)' }}>
    {DEPTHS.map(d => {
      const active = d.id === depth;
      return (
        <button
          key={d.id}
          type="button"
          onClick={() => onChange(d.id)}
          className="tape-num rounded-md px-3 py-1 text-[12px] font-semibold transition-colors"
          style={{
            color: active ? 'var(--tape-bg)' : 'var(--tape-fg-dim)',
            background: active ? 'var(--tape-accent)' : 'transparent',
          }}
          aria-pressed={active}
        >
          {d.label}
        </button>
      );
    })}
  </div>
);

// ── Sparkline (same shape as TapeTickerStrip's, sized larger) ───────────────
const Sparkline: React.FC<{ data: number[]; up: boolean; w: number; h: number }> = ({ data, up, w, h }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const d = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={up ? 'var(--tape-accent)' : 'var(--tape-danger)'} strokeWidth="1.4" />
    </svg>
  );
};

// ── Thesis pillar section (UVP / Strategy / Leadership) ────────────────────
// Hybrid pattern: short analyst synthesis + optional supporting clips.
// `children` slot is for pillar-specific structured chrome (Leadership facts).
const ThesisSection: React.FC<{ label: string; data?: ReadInThesisSection; children?: React.ReactNode }> = ({ label, data, children }) => {
  if (!data) return null;
  return (
    <section className="tape-fade border-b" style={{ borderColor: 'var(--tape-hairline)' }}>
      <div className="px-4 pt-4 pb-2">
        <div className="tape-label mb-1.5">{label}</div>
        <p className="text-[14px] leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{data.summary}</p>
      </div>
      {children}
      {data.citations && data.citations.length > 0 && (
        <div className="tape-divide">
          {data.citations.map(c => <TapeCitationRow key={c.pineconeId} citation={c} />)}
        </div>
      )}
    </section>
  );
};

// ── The big company header card (ticker + name + sector + price + sparkline) ──
const HeaderCard: React.FC<{ ticker: TapeTicker; name: string; sectorTag: string }> = ({ ticker, name, sectorTag }) => {
  const up = ticker.change >= 0;
  const color = up ? 'var(--tape-accent)' : 'var(--tape-danger)';
  return (
    <a
      href={`https://finance.yahoo.com/quote/${ticker.yahoo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="tape-ticker flex items-center justify-between gap-6 px-5 py-4"
      title={`${ticker.symbol}, ${name}, open on Yahoo Finance`}
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="tape-num text-[20px] font-semibold tracking-wide" style={{ color: 'var(--tape-fg)' }}>{ticker.symbol}</span>
          <span className="tape-serif text-[18px]" style={{ color: 'var(--tape-fg)' }}>{name}</span>
          <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--tape-fg-faint)' }} />
        </div>
        <div className="tape-label mt-1">{sectorTag}</div>
      </div>
      <div className="flex items-center gap-5 flex-shrink-0">
        <Sparkline data={ticker.spark} up={up} w={120} h={36} />
        <div className="text-right">
          <div className="tape-num text-[28px] leading-none" style={{ color: 'var(--tape-fg)' }}>{ticker.price}</div>
          <div className="tape-num mt-1 flex items-center justify-end gap-1 text-[12px]" style={{ color }}>
            {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            <span>{up ? '+' : ''}{ticker.change.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </a>
  );
};

// ── The view ────────────────────────────────────────────────────────────────
const ReadInView: React.FC<{ initialTicker?: string; initialDepth?: TapeDepth }> = ({ initialTicker, initialDepth }) => {
  const [ticker, setTicker] = useState((initialTicker || '').toUpperCase());
  const [depth, setDepth] = useState<TapeDepth>(initialDepth || 'quick');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReadInResult | null>(null);
  const autoRan = useRef(false);

  const run = useCallback(async (t: string, refresh = false) => {
    if (!t.trim()) return;
    setStatus('loading');
    setError('');
    try {
      setResult(await getReadIn({ ticker: t.trim().toUpperCase(), refresh }));
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Failed to read in on this name.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (initialTicker && !autoRan.current) {
      autoRan.current = true;
      void run(initialTicker);
    }
  }, [initialTicker, run]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(ticker);
  };

  // For the demo, the header price card uses the baked APP entry as a
  // fallback and swaps in the live Yahoo quote via useLiveTickers when the
  // proxy resolves. For non-APP tickers we just don't show a header card
  // (mock has no data anyway).
  const liveApp = useLiveTickers(result?.ticker === 'APP' ? ['APP'] : []);
  const liveAppTicker = liveApp.tickers.find(t => t.yahoo === 'APP') || null;
  const headerTicker: TapeTicker | null = result && result.ticker === 'APP'
    ? (liveAppTicker
        ? { ...liveAppTicker, name: liveAppTicker.name || TICKER_READIN_APP_HEADER.name }
        : TICKER_READIN_APP_HEADER)
    : null;
  const empty = result && !result.name;
  const showBrief = depth === 'brief' || depth === 'deep';
  const showDeep = depth === 'deep';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <TapeField label="Ticker" className="flex-1 min-w-[14rem]">
          <input
            className="tape-input px-3 py-2 uppercase"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. APP"
            autoFocus
            spellCheck={false}
          />
        </TapeField>
        <RunButton loading={status === 'loading'} disabled={!ticker.trim()} label="Read in" />
      </form>

      <div className="mt-6 tape-panel">
        {status === 'loading' && <TapeStatus kind="loading" message={`Reading in on ${ticker}…`} />}
        {status === 'error' && <TapeStatus kind="error" message={error} />}
        {status === 'idle' && !result && <TapeStatus kind="empty" message="Enter a ticker to pull a fast brief: pulse, smart money, peers, risks." />}
        {status === 'idle' && empty && <TapeStatus kind="empty" message={`No baked read-in for ${result?.ticker}. The Potemkin currently ships APP only.`} />}

        {status === 'idle' && result && !empty && (
          <div className="tape-fade">
            {/* depth toggle */}
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--tape-hairline)' }}>
              <div className="tape-label">Depth</div>
              <DepthToggle depth={depth} onChange={setDepth} />
            </div>

            {/* header card */}
            {headerTicker && (
              <div className="border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
                <HeaderCard ticker={headerTicker} name={result.name} sectorTag={result.sectorTag} />
              </div>
            )}

            {/* PULSE (always) */}
            <section className="border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
              <div className="tape-label mb-2">Pulse</div>
              <ul className="space-y-1.5 text-[14px] leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="tape-num mt-0.5 text-[11px]" style={{ color: 'var(--tape-accent)' }}>BULL</span>
                  <span style={{ color: 'var(--tape-fg)' }}>{result.pulse.bullLine}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="tape-num mt-0.5 text-[11px]" style={{ color: 'var(--tape-danger)' }}>BEAR</span>
                  <span style={{ color: 'var(--tape-fg)' }}>{result.pulse.bearLine}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="tape-num mt-0.5 text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>TAPE</span>
                  <span style={{ color: 'var(--tape-fg-dim)' }}>{result.pulse.priceAction}</span>
                </li>
              </ul>
            </section>

            {/* MARQUEE QUOTE (always) */}
            <section className="border-b" style={{ borderColor: 'var(--tape-hairline)' }}>
              <div className="px-4 pt-4 pb-1">
                <div className="tape-label">Marquee</div>
              </div>
              <TapeCitationRow citation={result.pulse.marqueeCitation} />
            </section>

            {/* BRIEF: what they actually do */}
            {showBrief && (
              <section className="tape-fade border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="tape-label mb-2">What they actually do</div>
                {result.whatTheyDo.split('\n\n').map((p, i) => (
                  <p key={i} className="text-[14px] leading-relaxed" style={{ color: 'var(--tape-fg-dim)', marginTop: i === 0 ? 0 : '0.75rem' }}>
                    {p}
                  </p>
                ))}
              </section>
            )}

            {/* BRIEF: investment-thesis pillars (UVP / Strategy / Leadership / Financials) */}
            {showBrief && <ThesisSection label="UVP & moat" data={result.uvp} />}
            {showBrief && <ThesisSection label="Strategy" data={result.strategy} />}
            {showBrief && result.leadership && (
              <ThesisSection label="Leadership" data={result.leadership}>
                {result.leadership.facts.length > 0 && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 pb-3 pt-1">
                    {result.leadership.facts.map(f => (
                      <div key={f.label} className="flex items-baseline gap-1.5">
                        <span className="tape-label">{f.label}</span>
                        <span className="tape-num text-[13px]" style={{ color: 'var(--tape-fg)' }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ThesisSection>
            )}
            {showBrief && result.financials && (
              <section className="tape-fade border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="tape-label mb-2.5">Financial trajectory</div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
                  {result.financials.headline.map(f => (
                    <div key={f.label} className="flex items-baseline justify-between gap-3 border-b pb-1.5" style={{ borderColor: 'var(--tape-hairline)' }}>
                      <span className="text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>{f.label}</span>
                      <span className="tape-num text-[13px]" style={{ color: 'var(--tape-fg)' }}>{f.value}</span>
                    </div>
                  ))}
                </div>
                {result.financials.note && (
                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{result.financials.note}</p>
                )}
              </section>
            )}

            {/* BRIEF: smart money */}
            {showBrief && (
              <section className="tape-fade border-b" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="px-4 pt-4 pb-2">
                  <div className="tape-label">The smart money on this</div>
                </div>
                {result.smartMoney.bulls.length > 0 && (
                  <>
                    <div className="px-4 pb-1">
                      <span className="tape-tag px-1.5 py-0.5">Bulls</span>
                    </div>
                    <div className="tape-divide">
                      {result.smartMoney.bulls.map(c => <TapeCitationRow key={c.pineconeId} citation={c} />)}
                    </div>
                  </>
                )}
                {result.smartMoney.bears.length > 0 && (
                  <>
                    <div className="px-4 pb-1 pt-3">
                      <span className="tape-num inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tape-danger)', borderColor: 'var(--tape-danger)', background: 'oklch(0.64 0.15 28 / 0.10)' }}>
                        Bears
                      </span>
                    </div>
                    <div className="tape-divide">
                      {result.smartMoney.bears.map(c => <TapeCitationRow key={c.pineconeId} citation={c} />)}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* BRIEF: recent catalysts */}
            {showBrief && result.catalysts.length > 0 && (
              <section className="tape-fade border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="tape-label mb-2">Recent catalysts</div>
                <ul className="space-y-1.5">
                  {result.catalysts.map((c, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13px] leading-relaxed">
                      <span className="tape-num flex-shrink-0 pt-px text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>{c.date.length >= 10 ? formatShortDate(c.date) : c.date}</span>
                      <span style={{ color: 'var(--tape-fg-dim)' }}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* DEEP: peers */}
            {showDeep && result.peers.length > 0 && (
              <div className="tape-fade">
                <TapeTickerStrip tickers={TICKERS_READIN_APP_PEERS} label="Peers" />
              </div>
            )}

            {/* DEEP: risks */}
            {showDeep && result.risks.length > 0 && (
              <section className="tape-fade px-4 py-4">
                <div className="tape-label mb-2">Risks</div>
                <ul className="space-y-1.5">
                  {result.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>
                      <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full" style={{ background: 'var(--tape-accent-dim)' }} />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <TapeResultFooter meta={result._meta} onRefresh={result._meta ? () => run(result.ticker, true) : undefined} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadInView;

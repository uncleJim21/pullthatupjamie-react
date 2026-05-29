import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getArc } from '../../../services/tape/index.ts';
import type { ArcResult, ArcCall } from '../../../services/tape/index.ts';
import TapeCitationRow from '../TapeCitationRow.tsx';
import TapeTickerStrip from '../TapeTickerStrip.tsx';
import { TapeField, RunButton, TapeStatus } from '../TapeActionScaffold.tsx';
import { formatShortDate } from '../../../utils/time.ts';
import { TICKERS_ARC_GROMEN } from '../../../data/mockTapeTickers.ts';

type Status = 'idle' | 'loading' | 'error';

const yearOf = (iso: string) => (iso || '').slice(0, 4) || '—';

/**
 * Conviction trajectory: x = each dated call (evenly spaced, labelled by year),
 * y = conviction 1..5 read from the language. The line is the "ramp"; every dot
 * is a real quote in the spine below.
 */
const ConvictionChart: React.FC<{ calls: ArcCall[] }> = ({ calls }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const HEIGHT = 150;
  const PAD = { top: 16, right: 24, bottom: 26, left: 24 };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(es => { const w = es[0]?.contentRect.width; if (w) setWidth(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = useMemo(() => {
    const n = calls.length;
    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    return calls.map((c, i) => ({
      x: PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW),
      y: PAD.top + (1 - (Math.min(5, Math.max(1, c.conviction)) - 1) / 4) * plotH,
      c,
    }));
  }, [calls, width]);

  if (calls.length < 2) return null;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const baseY = HEIGHT - PAD.bottom;
  const last = pts[pts.length - 1];
  const active = hover != null ? pts[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  const tipBelow = !!active && active.y < 58;
  const tipLeft = active ? Math.min(Math.max(active.x, 84), width - 84) : 0;

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg
        width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        style={{ display: 'block', cursor: active ? 'pointer' : 'default' }}
      >
        <defs>
          <linearGradient id="arcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tape-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--tape-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${last.x.toFixed(1)},${baseY.toFixed(1)} L${pts[0].x.toFixed(1)},${baseY.toFixed(1)} Z`} fill="url(#arcFill)" />
        <path d={line} fill="none" stroke="var(--tape-accent)" strokeWidth="1.5" />
        {active && (
          <line x1={active.x} y1={PAD.top - 4} x2={active.x} y2={baseY} stroke="var(--tape-accent-dim)" strokeWidth="1" strokeDasharray="2 3" />
        )}
        {pts.map((p, i) => {
          const isHover = i === hover;
          const solid = isHover || i === pts.length - 1;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={isHover ? 5.5 : i === pts.length - 1 ? 4 : 3} fill={solid ? 'var(--tape-accent)' : 'var(--tape-bg)'} stroke="var(--tape-accent)" strokeWidth="1.5" />
              <text x={p.x} y={HEIGHT - 9} textAnchor="middle" fontSize="10" fontFamily="'IBM Plex Mono', monospace" fill={isHover ? 'var(--tape-fg)' : 'var(--tape-fg-faint)'}>{yearOf(p.c.date)}</text>
            </g>
          );
        })}
        <text x={PAD.left} y={PAD.top - 4} fontSize="10" fontFamily="'IBM Plex Mono', monospace" fill="var(--tape-fg-faint)">conviction 1 → 5</text>
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10"
          style={{ left: tipLeft, top: tipBelow ? active.y + 12 : active.y - 12, transform: tipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' }}
        >
          <div className="rounded-lg px-2.5 py-1.5 shadow-xl shadow-black/40" style={{ background: 'var(--tape-bg-raised)', border: '1px solid var(--tape-accent-line)', maxWidth: '15rem' }}>
            <div className="tape-num text-[10px]" style={{ color: 'var(--tape-fg-faint)' }}>
              {active.c.date ? formatShortDate(active.c.date) : '—'} · conviction {active.c.conviction}/5
            </div>
            <div className="tape-serif mt-0.5 text-[13px] leading-snug" style={{ color: 'var(--tape-fg)' }}>{active.c.label}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const Pips: React.FC<{ n: number }> = ({ n }) => (
  <span className="tape-num inline-flex items-center gap-0.5" title={`conviction ${n}/5`}>
    {[1, 2, 3, 4, 5].map(i => (
      <span key={i} className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: i <= n ? 'var(--tape-accent)' : 'var(--tape-hairline-strong)' }} />
    ))}
  </span>
);

const ArcView: React.FC<{ initialPerson?: string }> = ({ initialPerson }) => {
  const [person, setPerson] = useState(initialPerson || '');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ArcResult | null>(null);
  const autoRan = useRef(false);

  const run = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setStatus('loading');
    setError('');
    try {
      setResult(await getArc({ person: name.trim() }));
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Failed to trace the arc.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (initialPerson && !autoRan.current) { autoRan.current = true; void run(initialPerson); }
  }, [initialPerson, run]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void run(person); };
  const empty = result && result.calls.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <TapeField label="Person" className="flex-1 min-w-[16rem]">
          <input className="tape-input px-3 py-2" value={person} onChange={e => setPerson(e.target.value)} placeholder="e.g. Luke Gromen" autoFocus />
        </TapeField>
        <RunButton loading={status === 'loading'} disabled={!person.trim()} label="Trace the arc" />
      </form>

      <div className="mt-6 tape-panel">
        {status === 'loading' && <TapeStatus kind="loading" message={`Tracing how ${person} has moved…`} />}
        {status === 'error' && <TapeStatus kind="error" message={error} />}
        {status === 'idle' && !result && <TapeStatus kind="empty" message="Pick someone to see how their thesis has evolved over time." />}
        {status === 'idle' && empty && <TapeStatus kind="empty" message={`No traced arc for ${result?.person} yet.`} />}

        {status === 'idle' && result && !empty && (
          <div className="tape-fade">
            {/* header */}
            <div className="border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="tape-serif text-2xl" style={{ color: 'var(--tape-fg)' }}>{result.person}</h2>
                <span className="tape-tag px-1.5 py-0.5">{result.verdict}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{result.thesis}</p>
            </div>

            {/* on the tape */}
            <TapeTickerStrip tickers={TICKERS_ARC_GROMEN} />

            {/* conviction trajectory */}
            <div className="border-b px-3 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
              <ConvictionChart calls={result.calls} />
              <div className="mt-1 px-1 text-center text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                conviction read from how forcefully he states it, not a market call. every point is a real quote below.
              </div>
            </div>

            {/* spine */}
            {result.calls.map((call, i) => (
              <section key={call.citation.pineconeId + i} className="border-b last:border-b-0" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="flex items-baseline gap-3 px-4 pt-4 pb-1">
                  <span className="tape-num text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>{call.date ? formatShortDate(call.date) : '—'}</span>
                  <Pips n={call.conviction} />
                  <span className="tape-serif text-base" style={{ color: 'var(--tape-fg)' }}>{call.label}</span>
                </div>
                <TapeCitationRow citation={call.citation} />
                {call.outcome && (
                  <div className="px-4 pb-3 pl-[3.75rem] text-[12px]" style={{ color: 'var(--tape-accent-dim)' }}>
                    → {call.outcome}
                  </div>
                )}
              </section>
            ))}

            {/* forward call */}
            {result.forwardCall && (
              <div className="px-4 py-4" style={{ background: 'var(--tape-accent-wash)' }}>
                <div className="tape-label mb-1.5">Now</div>
                <p className="tape-serif text-lg leading-snug" style={{ color: 'var(--tape-fg)' }}>{result.forwardCall}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArcView;

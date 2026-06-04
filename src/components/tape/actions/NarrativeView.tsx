import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { getNarrative } from '../../../services/tape/index.ts';
import type { NarrativeResult, NarrativeBucket, NarrativeInflection } from '../../../services/tape/index.ts';
import TapeCitationRow from '../TapeCitationRow.tsx';
import TapeTickerStrip from '../TapeTickerStrip.tsx';
import { TapeField, RunButton, TapeStatus, TapeResultFooter, TapeActionBar, ConfidencePill, PreviewPanel, PreviewBanner } from '../TapeActionScaffold.tsx';
import { useTapeModel } from '../../../services/tape/useTapeModel.ts';

type Status = 'idle' | 'loading' | 'error';

// Gate Narrative behind a "preview / coming soon" surface until live
// reliability catches up to canon quality. Click an example below to load
// the canon result through the normal pipeline; free-text input is hidden
// in this mode.
const PREVIEW_ONLY = true;

/** Compact bucket-window label. Handles month / quarter / year / arbitrary
 *  spans now that backend may emit variable-width buckets per the
 *  adaptive-cadence memo. */
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMonth = (d: Date) => `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
const windowLabel = (start: string, end: string): string => {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} – ${end}`;
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  // Single month: "Oct 2025"
  if (sameMonth) return fmtMonth(s);
  if (sameYear) {
    // Whole year: "2025"
    if (s.getMonth() === 0 && e.getMonth() === 11) return String(s.getFullYear());
    // Clean single quarter: "2025 Q4"
    const sQ = Math.floor(s.getMonth() / 3) + 1;
    const eQ = Math.floor(e.getMonth() / 3) + 1;
    if (s.getMonth() % 3 === 0 && e.getMonth() % 3 === 2 && sQ === eQ) return `${s.getFullYear()} Q${sQ}`;
    // Arbitrary intra-year span: "Jan – Sep 2025"
    return `${MONTH_ABBR[s.getMonth()]} – ${MONTH_ABBR[e.getMonth()]} ${s.getFullYear()}`;
  }
  // Cross-year span: "Mar 2024 – Sep 2025"
  return `${fmtMonth(s)} – ${fmtMonth(e)}`;
};

/** Bucket midpoint timestamp — used to position points on the trajectory chart. */
const midpoint = (b: NarrativeBucket): number => {
  const s = Date.parse(b.start), e = Date.parse(b.end);
  return isNaN(s) || isNaN(e) ? 0 : (s + e) / 2;
};

/**
 * Signed sentiment trajectory chart.
 *
 *   y-axis  : sentiment, -5 .. +5 (with a zero line — sign-flip across it = reversal)
 *   x-axis  : bucket midpoints in chronological order
 *   markers : inflection dates rendered as vertical dashed lines
 *
 * Line colors by polarity of the segment endpoints — green when both ends
 * are positive, red when both are negative, neutral otherwise. A reversal
 * (a segment crossing zero) is drawn with a polarity gradient and a small
 * "REVERSAL" tag.
 */
const SentimentChart: React.FC<{ buckets: NarrativeBucket[]; inflections: NarrativeInflection[] }> = ({ buckets, inflections }) => {
  const W = 640, H = 140, PAD_X = 32, PAD_Y = 16;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo(
    () =>
      buckets
        .filter(b => typeof b.sentiment === 'number')
        .map(b => ({
          t: midpoint(b),
          s: b.sentiment as number,
          label: windowLabel(b.start, b.end),
          bucket: b,
        })),
    [buckets]
  );
  if (points.length < 2) return null;

  const ts = points.map(p => p.t);
  const tMin = Math.min(...ts), tMax = Math.max(...ts);
  const tSpan = tMax - tMin || 1;

  // y-axis fixed at -5 .. +5 so charts are visually comparable across runs
  const yToPx = (s: number) => PAD_Y + ((5 - s) / 10) * (H - 2 * PAD_Y);
  const tToPx = (t: number) => PAD_X + ((t - tMin) / tSpan) * (W - 2 * PAD_X);

  const zeroY = yToPx(0);

  // Build polyline segments so we can color per-segment by polarity.
  const segments = points.slice(1).map((p, i) => {
    const prev = points[i];
    const x1 = tToPx(prev.t), y1 = yToPx(prev.s);
    const x2 = tToPx(p.t), y2 = yToPx(p.s);
    const bothPos = prev.s >= 0 && p.s >= 0;
    const bothNeg = prev.s <= 0 && p.s <= 0;
    const reversed = (prev.s > 0 && p.s < 0) || (prev.s < 0 && p.s > 0);
    const color = bothPos ? 'var(--tape-accent)' : bothNeg ? 'var(--tape-danger)' : 'var(--tape-fg-faint)';
    return { x1, y1, x2, y2, color, reversed, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 };
  });

  // Inflection markers — parsed best-effort. Accepts 'YYYY-Qn' or ISO date.
  const parseInflection = (d: string): number | null => {
    const qm = d.match(/^(\d{4})-Q([1-4])/i);
    if (qm) {
      const y = parseInt(qm[1], 10), q = parseInt(qm[2], 10);
      return Date.UTC(y, (q - 1) * 3 + 1, 15);
    }
    const t = Date.parse(d);
    return isNaN(t) ? null : t;
  };
  const inflectionXs = inflections
    .map(inf => ({ x: parseInflection(inf.date), label: inf.date }))
    .filter((v): v is { x: number; label: string } => v.x !== null && v.x >= tMin && v.x <= tMax)
    .map(v => ({ ...v, px: tToPx(v.x) }));

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="relative px-4 py-4" style={{ background: 'transparent' }}>
      <div className="tape-label mb-2 flex items-baseline justify-between">
        <span>Sentiment trajectory</span>
        <span className="text-[10px] normal-case tracking-normal" style={{ color: 'var(--tape-fg-faint)' }}>
          signed conviction, -5 (against) → +5 (for) · hover a point for detail
        </span>
      </div>
      <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        {/* y-axis gridlines */}
        {[-5, 0, 5].map(y => (
          <line
            key={y}
            x1={PAD_X} x2={W - PAD_X}
            y1={yToPx(y)} y2={yToPx(y)}
            stroke={y === 0 ? 'var(--tape-hairline-strong)' : 'var(--tape-hairline)'}
            strokeDasharray={y === 0 ? '0' : '2 3'}
            strokeWidth={y === 0 ? 1 : 0.5}
          />
        ))}
        {/* y-axis labels */}
        {[5, 0, -5].map(y => (
          <text
            key={y}
            x={6} y={yToPx(y) + 3}
            fontSize="9" fontFamily="ui-monospace, monospace"
            fill="var(--tape-fg-faint)"
          >
            {y > 0 ? `+${y}` : y}
          </text>
        ))}
        {/* inflection markers (under the line so the line draws on top) */}
        {inflectionXs.map((v, i) => (
          <g key={i}>
            <line
              x1={v.px} x2={v.px}
              y1={PAD_Y} y2={H - PAD_Y}
              stroke="var(--tape-accent-dim)" strokeDasharray="3 3" strokeWidth={0.75}
            />
            <text
              x={v.px + 3} y={PAD_Y + 8}
              fontSize="8" fontFamily="ui-monospace, monospace"
              fill="var(--tape-accent-dim)"
            >
              {v.label}
            </text>
          </g>
        ))}
        {/* segments — color-coded by polarity, reversals tagged */}
        {segments.map((seg, i) => (
          <g key={i}>
            <line
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke={seg.color} strokeWidth={1.5}
            />
            {seg.reversed && (
              <>
                <circle cx={seg.midX} cy={zeroY} r={3} fill="var(--tape-danger)" />
                <text
                  x={seg.midX + 6} y={zeroY - 4}
                  fontSize="8" fontFamily="ui-monospace, monospace"
                  fill="var(--tape-danger)"
                  letterSpacing="0.5"
                >
                  REVERSAL
                </text>
              </>
            )}
          </g>
        ))}
        {/* bucket points — bigger transparent hit area sits underneath for
            forgiving hover. Active point grows + glows. */}
        {points.map((p, i) => {
          const isActive = hoverIdx === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(prev => (prev === i ? null : prev))}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={tToPx(p.t)} cy={yToPx(p.s)} r={14} fill="transparent" />
              <circle
                cx={tToPx(p.t)} cy={yToPx(p.s)} r={isActive ? 5 : 3}
                fill={p.s >= 0 ? 'var(--tape-accent)' : 'var(--tape-danger)'}
                style={{ transition: 'r 120ms ease' }}
              />
              <text
                x={tToPx(p.t)} y={yToPx(p.s) - 7}
                fontSize="9" fontFamily="ui-monospace, monospace"
                fill={isActive ? 'var(--tape-fg)' : 'var(--tape-fg-dim)'}
                textAnchor="middle"
              >
                {p.s > 0 ? `+${p.s}` : p.s}
              </text>
            </g>
          );
        })}
        {/* x-axis bucket labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={tToPx(p.t)} y={H - 3}
            fontSize="8" fontFamily="ui-monospace, monospace"
            fill={hoverIdx === i ? 'var(--tape-fg)' : 'var(--tape-fg-faint)'}
            textAnchor="middle"
          >
            {p.label}
          </text>
        ))}
      </svg>
      {/* Hover tooltip — positioned by SVG viewBox %, scales with chart width.
          Anchored above the active point; pointer-events disabled so the
          hover state doesn't flicker when the cursor brushes the tooltip. */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 w-64 rounded border p-2.5 text-[11px] leading-relaxed shadow-lg"
          style={{
            background: 'var(--tape-bg)',
            borderColor: 'var(--tape-hairline-strong)',
            color: 'var(--tape-fg-dim)',
            left: `${(tToPx(hovered.t) / W) * 100}%`,
            top: `${(yToPx(hovered.s) / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 14px))',
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="tape-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--tape-fg-faint)' }}>
              {hovered.label}
            </span>
            <span
              className="tape-num text-[12px]"
              style={{ color: hovered.s >= 0 ? 'var(--tape-accent)' : 'var(--tape-danger)' }}
            >
              {hovered.s > 0 ? `+${hovered.s}` : hovered.s}
            </span>
          </div>
          <p className="mt-1.5" style={{ color: 'var(--tape-fg-dim)' }}>
            {hovered.bucket.stance}
          </p>
        </div>
      )}
      </div>
    </div>
  );
};

/** Color-coded Easy chip for the group field. */
const GroupChip: React.FC<{ label: string; tone: 'bull' | 'bear' | 'neutral'; onClick: () => void }> = ({ label, tone, onClick }) => {
  const style: React.CSSProperties =
    tone === 'bull'
      ? { borderColor: 'var(--tape-accent)', color: 'var(--tape-accent)' }
      : tone === 'bear'
      ? { borderColor: 'var(--tape-danger)', color: 'var(--tape-danger)' }
      : { borderColor: 'var(--tape-hairline-strong)', color: 'var(--tape-fg-dim)' };
  return (
    <button type="button" onClick={onClick} className="tape-pill px-2.5 py-0.5 text-[11px]" style={style}>
      {label}
    </button>
  );
};

const NarrativeView: React.FC<{ initialTopic?: string; initialGroup?: string; onBack: () => void }> = ({ initialTopic, initialGroup, onBack }) => {
  const [topic, setTopic] = useState(initialTopic || '');
  const [group, setGroup] = useState(initialGroup || '');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const autoRan = useRef(false);
  const [model] = useTapeModel();

  const run = useCallback(async (t: string, g: string, refresh = false) => {
    if (!t.trim()) return;
    setStatus('loading');
    setError('');
    try {
      setResult(await getNarrative({ topic: t.trim(), group: g.trim() || undefined, refresh, model }));
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Failed to trace the narrative.');
      setStatus('error');
    }
  }, [model]);

  useEffect(() => {
    if (initialTopic && !autoRan.current) { autoRan.current = true; void run(initialTopic, initialGroup || ''); }
  }, [initialTopic, initialGroup, run]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void run(topic, group); };
  const empty = result && result.buckets.length === 0;
  // Preview gate: hide the free-text form when previewing. Canon-example
  // clicks still run() normally → canon hits → full result renders.
  const showPreview = PREVIEW_ONLY && !result && status === 'idle';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <TapeActionBar
        onBack={onBack}
        onRefresh={result?._meta ? () => run(result.topic, result.group || '', true) : undefined}
        refreshLoading={status === 'loading'}
      />
      {PREVIEW_ONLY && (
        <PreviewBanner
          note="Curated canon only — live retrieval still hardening."
          examples={[
            {
              label: 'Luke Gromen — the sovereign debt endgame',
              onClick: () => {
                setTopic('the sovereign debt endgame');
                setGroup('Luke Gromen');
                void run('the sovereign debt endgame', 'Luke Gromen');
              },
            },
          ]}
        />
      )}
      {showPreview ? (
        <PreviewPanel
          title="Narrative"
          description={`Track how the prevailing view on a topic drifts over time — chronological buckets, sentiment trajectory chart, and inflection points called out. Live retrieval still hardening; try the curated canon below.`}
          examples={[
            {
              label: 'Luke Gromen — the sovereign debt endgame',
              onClick: () => {
                setTopic('the sovereign debt endgame');
                setGroup('Luke Gromen');
                void run('the sovereign debt endgame', 'Luke Gromen');
              },
            },
          ]}
        />
      ) : (
      <form onSubmit={onSubmit}>
        {/* Row 1: Topic + Group + Run — all share a single baseline. */}
        <div className="flex flex-wrap items-end gap-3">
          <TapeField label="Topic" className="flex-1 min-w-[16rem]">
            <input className="tape-input px-3 py-2" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. the sovereign debt endgame" autoFocus />
          </TapeField>
          <TapeField label="Group (optional)" className="flex-1 min-w-[12rem]">
            <input className="tape-input px-3 py-2" value={group} onChange={e => setGroup(e.target.value)} placeholder="all voices" />
          </TapeField>
          <RunButton loading={status === 'loading'} disabled={!topic.trim()} label="Trace the narrative" />
        </div>
        {/* Row 2: chips on their own line so the inputs above stay perfectly aligned. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-1">
          <span className="tape-label">Filter:</span>
          <GroupChip label="Bulls" tone="bull" onClick={() => setGroup('Bulls')} />
          <GroupChip label="Bears" tone="bear" onClick={() => setGroup('Bears')} />
          <GroupChip label="All voices" tone="neutral" onClick={() => setGroup('')} />
        </div>
      </form>
      )}

      {!showPreview && (
      <div className="mt-6 tape-panel">
        {status === 'loading' && <TapeStatus kind="loading" message={`Tracing how the narrative on ${topic} has moved…`} />}
        {status === 'error' && <TapeStatus kind="error" message={error} />}
        {status === 'idle' && !result && <TapeStatus kind="empty" message="Pick a topic to see how the prevailing view on it has drifted over time." />}
        {status === 'idle' && empty && (
          <TapeStatus
            kind="empty"
            message={result?._meta?.confidenceReason || `No narrative drift assembled for ${result?.topic} yet.`}
          />
        )}

        {status === 'idle' && result && !empty && (
          <div className="tape-fade">
            {/* header — topic + group + confidence pill + current thesis */}
            <div className="border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="tape-serif text-2xl" style={{ color: 'var(--tape-fg)' }}>{result.topic}</h2>
                <div className="flex items-center gap-2">
                  {result.group && (
                    <span className="tape-tag px-1.5 py-0.5">filter: {result.group}</span>
                  )}
                  <ConfidencePill meta={result._meta} />
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{result.thesis}</p>
            </div>

            {/* sentiment trajectory — placed above the ticker strip so the
                analytical layer reads first, before the live-price context. */}
            <div className="border-b" style={{ borderColor: 'var(--tape-hairline)' }}>
              <SentimentChart buckets={result.buckets} inflections={result.inflections} />
            </div>

            {/* on the tape */}
            {result.tickers && result.tickers.length > 0 && <TapeTickerStrip symbols={result.tickers} />}

            {/* spine — chronological buckets */}
            {result.buckets.map((b, i) => (
              <section key={`${b.start}:${i}`} className="border-b last:border-b-0" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="flex items-baseline gap-3 px-4 pt-4 pb-1.5">
                  <span className="tape-num text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>{windowLabel(b.start, b.end)}</span>
                  {typeof b.sentiment === 'number' && (
                    <span
                      className="tape-num text-[11px]"
                      style={{ color: b.sentiment >= 0 ? 'var(--tape-accent)' : 'var(--tape-danger)' }}
                    >
                      {b.sentiment > 0 ? `+${b.sentiment}` : b.sentiment}
                    </span>
                  )}
                </div>
                <p className="px-4 pb-2 text-sm leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{b.stance}</p>
                <div className="tape-divide">
                  {b.citations.map(c => (
                    <TapeCitationRow key={c.pineconeId} citation={c} />
                  ))}
                </div>
              </section>
            ))}

            {/* inflection callouts — when the narrative shifted */}
            {result.inflections.length > 0 && (
              <section className="border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="tape-label mb-2">Inflection</div>
                <ul className="space-y-2">
                  {result.inflections.map((inf, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13px] leading-relaxed">
                      <span className="tape-num mt-0.5 flex-shrink-0 text-[11px]" style={{ color: 'var(--tape-accent)' }}>{inf.date}</span>
                      <span style={{ color: 'var(--tape-fg-dim)' }}>{inf.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* forward call */}
            {result.forwardCall && (
              <div className="px-4 py-4" style={{ background: 'var(--tape-accent-wash)' }}>
                <div className="tape-label mb-1.5 flex items-center gap-2">
                  <span>Where this is heading</span>
                  <ArrowRight className="h-3 w-3" style={{ color: 'var(--tape-accent-dim)' }} />
                </div>
                <p className="tape-serif text-lg leading-snug" style={{ color: 'var(--tape-fg)' }}>{result.forwardCall}</p>
              </div>
            )}

            <TapeResultFooter meta={result._meta} />
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default NarrativeView;

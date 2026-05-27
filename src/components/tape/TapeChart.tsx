import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatShortDate } from '../../utils/time.ts';
import type { TimelineBucket } from '../../services/tape/tapeTypes.ts';

/**
 * Hand-built SVG area chart for the Timeline action. No charting dependency —
 * full control over the look (institutional, sparse, single green stroke) and
 * no generic-library "AI made that" tell. Hover surfaces a week; click drills in.
 */
const PAD = { top: 18, right: 10, bottom: 26, left: 10 };
const HEIGHT = 200;

const TapeChart: React.FC<{
  buckets: TimelineBucket[];
  selectedWeek?: string | null;
  onSelectWeek: (weekStart: string) => void;
}> = ({ buckets, selectedWeek, onSelectWeek }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { max, points, areaPath, linePath, plotW } = useMemo(() => {
    const n = buckets.length;
    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const maxCount = Math.max(1, ...buckets.map(b => b.count));
    const pts = buckets.map((b, i) => ({
      x: PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW),
      y: PAD.top + (1 - b.count / maxCount) * plotH,
      b,
      i,
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const baseY = PAD.top + plotH;
    const area = pts.length
      ? `M${pts[0].x.toFixed(1)},${baseY.toFixed(1)} ` +
        pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
        ` L${pts[pts.length - 1].x.toFixed(1)},${baseY.toFixed(1)} Z`
      : '';
    return { max: maxCount, points: pts, areaPath: area, linePath: line, plotW };
  }, [buckets, width]);

  if (buckets.length < 2) {
    return (
      <div ref={wrapRef} className="flex h-[200px] items-center justify-center tape-mono text-xs" style={{ color: 'var(--tape-fg-faint)' }}>
        Not enough data points to plot.
      </div>
    );
  }

  const baseY = PAD.top + (HEIGHT - PAD.top - PAD.bottom);
  const selectedPoint = points.find(p => p.b.weekStart === selectedWeek);
  const hoverPoint = hoverIdx != null ? points[hoverIdx] : null;
  const active = hoverPoint || selectedPoint || null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - PAD.left;
    const ratio = Math.min(1, Math.max(0, x / plotW));
    setHoverIdx(Math.round(ratio * (points.length - 1)));
  };

  return (
    <div ref={wrapRef} className="w-full select-none">
      <svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
        onClick={() => active && onSelectWeek(active.b.weekStart)}
        style={{ cursor: active ? 'pointer' : 'default', display: 'block' }}
      >
        <defs>
          <linearGradient id="tapeAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tape-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--tape-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line x1={PAD.left} y1={baseY} x2={width - PAD.right} y2={baseY} stroke="var(--tape-hairline)" strokeWidth="1" />

        <path d={areaPath} fill="url(#tapeAreaFill)" />
        <path d={linePath} fill="none" stroke="var(--tape-accent)" strokeWidth="1.5" />

        {/* selected marker (persistent) */}
        {selectedPoint && (
          <line x1={selectedPoint.x} y1={PAD.top} x2={selectedPoint.x} y2={baseY} stroke="var(--tape-accent-line)" strokeWidth="1" />
        )}

        {/* hover guide + readout */}
        {hoverPoint && (
          <>
            <line x1={hoverPoint.x} y1={PAD.top} x2={hoverPoint.x} y2={baseY} stroke="var(--tape-accent-dim)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3" fill="var(--tape-accent)" />
            <text
              x={Math.min(Math.max(hoverPoint.x, 60), width - 60)}
              y={PAD.top - 4}
              textAnchor="middle"
              fontSize="11"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--tape-fg)"
            >
              {formatShortDate(hoverPoint.b.weekStart)} · {hoverPoint.b.count}
            </text>
          </>
        )}

        {/* axis labels */}
        <text x={PAD.left} y={HEIGHT - 8} fontSize="10" fontFamily="'IBM Plex Mono', monospace" fill="var(--tape-fg-faint)">
          {formatShortDate(buckets[0].weekStart)}
        </text>
        <text x={width - PAD.right} y={HEIGHT - 8} textAnchor="end" fontSize="10" fontFamily="'IBM Plex Mono', monospace" fill="var(--tape-fg-faint)">
          {formatShortDate(buckets[buckets.length - 1].weekStart)}
        </text>
        <text x={PAD.left} y={PAD.top - 6} fontSize="10" fontFamily="'IBM Plex Mono', monospace" fill="var(--tape-fg-faint)">
          peak {max}/wk
        </text>
      </svg>
    </div>
  );
};

export default TapeChart;

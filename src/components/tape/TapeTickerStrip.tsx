import React from 'react';
import { ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import type { TapeTicker } from '../../data/mockTapeTickers.ts';

/** Tiny inline sparkline; colored by direction. */
const Sparkline: React.FC<{ data: number[]; up: boolean }> = ({ data, up }) => {
  const W = 56, H = 18;
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const d = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 2) - 1;
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={up ? 'var(--tape-accent)' : 'var(--tape-danger)'} strokeWidth="1.25" />
    </svg>
  );
};

const TickerCard: React.FC<{ t: TapeTicker }> = ({ t }) => {
  const up = t.change >= 0;
  const color = up ? 'var(--tape-accent)' : 'var(--tape-danger)';
  return (
    <a
      href={`https://finance.yahoo.com/quote/${t.yahoo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="tape-ticker flex flex-shrink-0 flex-col justify-between px-3 py-2.5"
      style={{ width: '152px', height: '124px' }}
      title={`${t.symbol}, ${t.name}, open on Yahoo Finance`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="tape-num text-[13px] font-semibold tracking-wide" style={{ color: 'var(--tape-fg)' }}>{t.symbol}</div>
          <div className="truncate text-[10px] leading-tight" style={{ color: 'var(--tape-fg-faint)' }}>{t.name}</div>
        </div>
        <ExternalLink className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--tape-fg-faint)' }} />
      </div>
      <div className="tape-num text-[22px] leading-none" style={{ color: 'var(--tape-fg)' }}>{t.price}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="tape-num flex items-center gap-1 text-[11px]" style={{ color }}>
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          <span>{up ? '+' : ''}{t.change.toFixed(1)}%</span>
        </div>
        <Sparkline data={t.spark} up={up} />
      </div>
    </a>
  );
};

const TapeTickerStrip: React.FC<{ tickers: TapeTicker[]; label?: string }> = ({ tickers, label = 'On the tape' }) => {
  if (!tickers.length) return null;
  return (
    <div className="border-b py-3" style={{ borderColor: 'var(--tape-hairline)' }}>
      <div className="tape-label mb-2 px-4">{label}</div>
      <div className="tape-scrollbar overflow-x-auto">
        <div className="flex gap-2 px-4 pb-1" style={{ minWidth: 'min-content' }}>
          {tickers.map(t => <TickerCard key={t.symbol} t={t} />)}
        </div>
      </div>
    </div>
  );
};

export default TapeTickerStrip;

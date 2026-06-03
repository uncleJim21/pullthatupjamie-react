import React, { useState } from 'react';
import { Search, ArrowRight, Newspaper, GitCompare, TrendingUp, Info } from 'lucide-react';
import { TAPE_NAME } from '../../config/tapeConfig.ts';
import type { TapeActionId, TapeDepth, TapeModel } from '../../services/tape/tapeTypes.ts';
import { useTapeModel } from '../../services/tape/useTapeModel.ts';

export interface TapeLaunch {
  action: TapeActionId;
  person?: string;
  personB?: string;
  topic?: string;
  /** Read In input. */
  ticker?: string;
  /** Read In starting depth. */
  depth?: TapeDepth;
}

type HeroMode = 'ticker' | 'person';

interface SecondaryAction {
  id: Exclude<TapeActionId, 'dossier' | 'readin'>;
  title: string;
  desc: string;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  example: { label: string; launch: TapeLaunch };
}

const SECONDARY: SecondaryAction[] = [
  {
    id: 'brief',
    title: "Get this week's read",
    desc: 'What the desks actually said this week on one topic, synthesized, with the quotes behind it.',
    icon: Newspaper,
    example: { label: 'oil & the Strait of Hormuz', launch: { action: 'brief', topic: 'oil & the Strait of Hormuz' } },
  },
  {
    id: 'split',
    title: 'Put two camps head to head',
    desc: 'Where the bulls and bears actually agree and diverge on one debate, side by side, with receipts.',
    icon: GitCompare,
    example: { label: 'the AI bubble: bulls vs bears', launch: { action: 'split', person: 'The bears', personB: 'The bulls', topic: 'the AI bubble' } },
  },
  {
    id: 'arc',
    title: 'Watch a view evolve',
    desc: 'How one person’s thesis, and their conviction in it, moved over years, with every call sourced.',
    icon: TrendingUp,
    example: { label: 'Gromen: the debt-spiral thesis', launch: { action: 'arc', person: 'Luke Gromen' } },
  },
];

const TICKER_EXAMPLES = ['APP', 'NVDA', 'CRWV'];
const PERSON_EXAMPLES = ['Mohamed El-Erian', 'Luke Gromen', 'Mike Green'];

/** Synthesis-tier toggle (global, persisted via useTapeModel). Quiet by
 *  design — Deep is the recommended default and most users won't touch it.
 *  The (i) button reveals a short explainer popover. */
const SynthesisModeToggle: React.FC<{ model: TapeModel; onChange: (m: TapeModel) => void }> = ({ model, onChange }) => {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="relative flex items-center justify-center gap-2">
      <span className="tape-label">Synthesis</span>
      <div className="inline-flex items-center rounded-full border p-0.5 text-[11px]" style={{ borderColor: 'var(--tape-hairline-strong)' }}>
        {([['quality', 'Deep'], ['fast', 'Fast']] as const).map(([id, label]) => {
          const active = model === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="tape-mono rounded-full px-3 py-1 uppercase tracking-wide transition-colors"
              style={{
                background: active ? 'var(--tape-accent)' : 'transparent',
                color: active ? 'var(--tape-bg)' : 'var(--tape-fg-dim)',
              }}
              title={id === 'quality' ? 'Recommended. Most capable models.' : 'Lighter models, faster turnaround.'}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setShowInfo(v => !v)}
        aria-label="Explain synthesis modes"
        className="rounded-full p-1 transition-opacity hover:opacity-100"
        style={{ color: 'var(--tape-fg-faint)', opacity: showInfo ? 1 : 0.7 }}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {showInfo && (
        <div
          className="absolute left-1/2 top-full z-30 mt-2 w-80 -translate-x-1/2 rounded border p-3.5 text-[12px] leading-relaxed shadow-lg"
          style={{ background: 'var(--tape-bg)', borderColor: 'var(--tape-hairline-strong)', color: 'var(--tape-fg-dim)' }}
        >
          <p>
            <span className="tape-mono uppercase tracking-wide" style={{ color: 'var(--tape-accent)' }}>Deep</span>
            <span className="ml-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--tape-fg-faint)' }}>recommended</span>
          </p>
          <p className="mt-1">Most capable models. Exhaustive synthesis. ~60–90 seconds per novel query. Cached results return instantly.</p>
          <p className="mt-3">
            <span className="tape-mono uppercase tracking-wide" style={{ color: 'var(--tape-fg)' }}>Fast</span>
          </p>
          <p className="mt-1">Lighter models. Direct answers. ~30–45 seconds. Choose this when speed matters more than depth.</p>
          <button
            type="button"
            onClick={() => setShowInfo(false)}
            className="mt-3 text-[10px] uppercase tracking-wide opacity-60 hover:opacity-100"
            style={{ color: 'var(--tape-fg-faint)' }}
          >
            close
          </button>
        </div>
      )}
    </div>
  );
};

/** Two-segment pill that flips the hero between Read-in (ticker) and Dossier (person). */
const HeroModeToggle: React.FC<{ mode: HeroMode; onChange: (m: HeroMode) => void }> = ({ mode, onChange }) => (
  <div className="inline-flex items-center gap-0 rounded-full border p-0.5 text-[11px]" style={{ borderColor: 'var(--tape-hairline-strong)' }}>
    {([['ticker', 'Ticker'], ['person', 'Person']] as const).map(([id, label]) => {
      const active = mode === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className="tape-mono rounded-full px-3 py-1 uppercase tracking-wide transition-colors"
          style={{
            background: active ? 'var(--tape-accent)' : 'transparent',
            color: active ? 'var(--tape-bg)' : 'var(--tape-fg-dim)',
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);

const TapeCommandSurface: React.FC<{ onLaunch: (launch: TapeLaunch) => void }> = ({ onLaunch }) => {
  const [mode, setMode] = useState<HeroMode>('ticker');
  const [query, setQuery] = useState('');
  const [synthModel, setSynthModel] = useTapeModel();

  const submit = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (mode === 'ticker') {
      onLaunch({ action: 'readin', ticker: v.toUpperCase() });
    } else {
      onLaunch({ action: 'dossier', person: v });
    }
  };

  // Reset the typed value when switching modes — a ticker isn't a name and vice versa.
  const switchMode = (next: HeroMode) => {
    setMode(next);
    setQuery('');
  };

  const isTicker = mode === 'ticker';
  const placeholder = isTicker ? 'Read in on any ticker…' : 'Build a dossier on anyone…';
  const ctaLabel = isTicker ? 'Read in' : 'Dossier';
  const examples = isTicker ? TICKER_EXAMPLES : PERSON_EXAMPLES;

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-20 pt-16 sm:pt-24">
      {/* wordmark + value prop */}
      <div className="tape-fade text-center">
        <h1 className="tape-serif text-5xl tracking-tight sm:text-6xl" style={{ color: 'var(--tape-fg)' }}>
          {TAPE_NAME}
        </h1>
        <p className="mt-3 text-lg font-medium sm:text-xl" style={{ color: 'var(--tape-fg)' }}>
          Read The Tape. Skip the prattle. Extract the alpha.
        </p>
        <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>
          Bloomberg, Real Vision, Macro Voices and the rest of the macro feed, searchable. Condensed alpha without burning hours.
        </p>
      </div>

      {/* hero: ticker (read-in) or person (dossier), toggle-driven */}
      <form
        onSubmit={e => { e.preventDefault(); submit(query); }}
        className="tape-fade mt-10"
        style={{ animationDelay: '70ms' }}
      >
        <div className="mb-3 flex justify-center">
          <HeroModeToggle mode={mode} onChange={switchMode} />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2" style={{ color: 'var(--tape-fg-faint)' }} />
          <input
            value={query}
            onChange={e => setQuery(isTicker ? e.target.value.toUpperCase() : e.target.value)}
            placeholder={placeholder}
            autoFocus
            spellCheck={false}
            className={`tape-search w-full py-3.5 pl-12 pr-28 ${isTicker ? 'uppercase' : ''}`}
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="tape-btn tape-btn--go absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 px-3.5 py-2"
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-1">
          <span className="text-xs" style={{ color: 'var(--tape-fg-faint)' }}>Try</span>
          {examples.map(label => (
            <button key={label} type="button" onClick={() => submit(label)} className="tape-pill px-2.5 py-1">
              {label}
            </button>
          ))}
        </div>
      </form>

      {/* Global synthesis mode — set once, applies to every action. Placed
          above the "Or go deeper" list so users see it before drilling in.
          `relative z-40` ensures the (i) popover layers over the panel below. */}
      <div className="tape-fade relative z-40 mt-8" style={{ animationDelay: '120ms' }}>
        <SynthesisModeToggle model={synthModel} onChange={setSynthModel} />
      </div>

      {/* the other three jobs */}
      <div className="tape-fade mt-8" style={{ animationDelay: '140ms' }}>
        <div className="tape-label mb-2.5 pl-1">Or go deeper</div>
        <div className="tape-panel tape-divide overflow-hidden">
          {SECONDARY.map(a => {
            const Icon = a.icon;
            return (
              <div key={a.id} className="tape-action px-4 py-4">
                <div className="flex min-w-0 items-start gap-3.5">
                  <Icon className="mt-0.5 h-[18px] w-[18px] flex-shrink-0" style={{ color: 'var(--tape-accent)' }} />
                  <div className="min-w-0">
                    <button type="button" onClick={() => onLaunch({ action: a.id })} className="block text-left">
                      <span className="tape-serif block text-[17px] leading-snug" style={{ color: 'var(--tape-fg)' }}>{a.title}</span>
                      <span className="mt-1 block text-[13px] leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{a.desc}</span>
                    </button>
                    <button type="button" onClick={() => onLaunch(a.example.launch)} className="tape-pill mt-2.5 inline-block px-2.5 py-1">
                      {a.example.label}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => onLaunch({ action: a.id })} aria-label={a.title} className="flex-shrink-0">
                  <ArrowRight className="tape-action-arrow h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default TapeCommandSurface;

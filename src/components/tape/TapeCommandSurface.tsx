import React, { useState } from 'react';
import { Search, ArrowRight, Newspaper, GitCompare, TrendingUp, FileSearch } from 'lucide-react';
import { TAPE_NAME } from '../../config/tapeConfig.ts';
import type { TapeActionId, TapeDepth } from '../../services/tape/tapeTypes.ts';

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

interface SecondaryAction {
  id: Exclude<TapeActionId, 'dossier'>;
  title: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
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
  {
    id: 'readin',
    title: 'Read in on a name',
    desc: 'A fast company brief that scales from a 30-second pulse to a deep read: what they do, the smart-money case, peers, risks.',
    icon: FileSearch,
    example: { label: 'APP — AppLovin', launch: { action: 'readin', ticker: 'APP' } },
  },
];

const PERSON_EXAMPLES = ['Mohamed El-Erian', 'Luke Gromen', 'Mike Green'];

const TapeCommandSurface: React.FC<{ onLaunch: (launch: TapeLaunch) => void }> = ({ onLaunch }) => {
  const [query, setQuery] = useState('');

  const lookUp = (name: string) => {
    const person = name.trim();
    if (person) onLaunch({ action: 'dossier', person });
  };

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

      {/* hero: look up a person -> Dossier */}
      <form
        onSubmit={e => { e.preventDefault(); lookUp(query); }}
        className="tape-fade mt-10"
        style={{ animationDelay: '70ms' }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2" style={{ color: 'var(--tape-fg-faint)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Look up anyone…"
            autoFocus
            spellCheck={false}
            className="tape-search w-full py-3.5 pl-12 pr-28"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="tape-btn tape-btn--go absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 px-3.5 py-2"
          >
            Dossier
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-1">
          <span className="text-xs" style={{ color: 'var(--tape-fg-faint)' }}>Try</span>
          {PERSON_EXAMPLES.map(name => (
            <button key={name} type="button" onClick={() => lookUp(name)} className="tape-pill px-2.5 py-1">
              {name}
            </button>
          ))}
        </div>
      </form>

      {/* the other three jobs */}
      <div className="tape-fade mt-10" style={{ animationDelay: '140ms' }}>
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

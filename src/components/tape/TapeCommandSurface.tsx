import React, { useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { TAPE_NAME, TAPE_TAGLINE } from '../../config/tapeConfig.ts';
import { TAPE_SAMPLES } from '../../data/mockTapeData.ts';
import type { TapeActionId } from '../../services/tape/tapeTypes.ts';

export interface TapeLaunch {
  action: TapeActionId;
  person?: string;
  personB?: string;
  topic?: string;
}

interface ActionMeta {
  id: TapeActionId;
  verb: string;
  title: string;
  desc: string;
  usage: string;
}

const ACTIONS: ActionMeta[] = [
  { id: 'dossier', verb: 'dossier', title: 'Dossier', desc: 'Every stated position from one voice, grouped by topic, with timestamps.', usage: 'dossier <person>' },
  { id: 'timeline', verb: 'timeline', title: 'Timeline', desc: 'Weekly mention counts for a topic. Click a week to read the underlying hits.', usage: 'timeline <topic>' },
  { id: 'brief', verb: 'brief', title: 'Brief', desc: 'What the desks said this week on a topic, grouped by publisher.', usage: 'brief <topic>' },
  { id: 'split', verb: 'split', title: 'Split', desc: 'Two voices on one topic, positions placed side by side.', usage: 'split <A> / <B> on <topic>' },
];

const VERB_ALIASES: Record<string, TapeActionId> = {
  dossier: 'dossier', who: 'dossier',
  timeline: 'timeline', trend: 'timeline', chart: 'timeline',
  brief: 'brief', summary: 'brief',
  split: 'split', compare: 'split', vs: 'split',
};

/** Parse a typed command like "split Druckenmiller / Mike Green on rate cuts". */
export function parseCommand(raw: string): TapeLaunch | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const [first, ...rest] = trimmed.split(/\s+/);
  const action = VERB_ALIASES[first.toLowerCase()];
  if (!action) return null;
  const remainder = rest.join(' ').trim();

  if (action === 'split') {
    // "<A> [/ | vs | and] <B> on <topic>"
    const onIdx = remainder.toLowerCase().lastIndexOf(' on ');
    const topic = onIdx >= 0 ? remainder.slice(onIdx + 4).trim() : '';
    const people = (onIdx >= 0 ? remainder.slice(0, onIdx) : remainder).split(/\s*(?:\/|\bvs\b|\band\b)\s*/i);
    return { action, person: (people[0] || '').trim(), personB: (people[1] || '').trim(), topic };
  }
  if (action === 'dossier') return { action, person: remainder };
  return { action, topic: remainder }; // timeline | brief
}

const TapeCommandSurface: React.FC<{ onLaunch: (launch: TapeLaunch) => void }> = ({ onLaunch }) => {
  const [command, setCommand] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCommand(command);
    if (parsed) onLaunch(parsed);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      {/* wordmark */}
      <div className="tape-fade">
        <h1 className="tape-serif text-4xl tracking-tight sm:text-5xl" style={{ color: 'var(--tape-fg)' }}>
          {TAPE_NAME}
        </h1>
        <p className="tape-mono mt-2 text-xs" style={{ color: 'var(--tape-fg-dim)' }}>
          {TAPE_TAGLINE}
        </p>
      </div>

      {/* command line */}
      <form onSubmit={submit} className="tape-fade mt-8 flex items-center gap-2 tape-panel px-3 py-2.5" style={{ animationDelay: '60ms' }}>
        <span className="tape-mono select-none text-base" style={{ color: 'var(--tape-accent)' }}>›</span>
        <input
          value={command}
          onChange={e => setCommand(e.target.value)}
          placeholder="dossier Stanley Druckenmiller"
          autoFocus
          className="tape-mono min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
          style={{ color: 'var(--tape-fg)' }}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="tape-btn flex items-center gap-1.5 px-2.5 py-1.5" aria-label="Run command">
          <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* action list — rows, deliberately not a card grid */}
      <div className="tape-fade mt-8" style={{ animationDelay: '120ms' }}>
        <div className="tape-label mb-1 px-1">Actions</div>
        <div className="tape-panel">
          {ACTIONS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onLaunch({ action: a.id })}
              className="tape-action-row px-4 py-3.5"
              style={i === 0 ? { borderTop: 'none' } : undefined}
            >
              <div className="flex items-baseline gap-3">
                <span className="tape-action-verb tape-mono w-20 flex-shrink-0 text-xs">{a.verb}</span>
                <div className="min-w-0">
                  <div className="tape-serif text-base" style={{ color: 'var(--tape-fg)' }}>{a.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{a.desc}</div>
                  <div className="tape-mono mt-1 text-[10px]" style={{ color: 'var(--tape-fg-faint)' }}>{a.usage}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* sample queries */}
      <div className="tape-fade mt-8" style={{ animationDelay: '180ms' }}>
        <div className="tape-label mb-2 px-1">Try</div>
        <div className="flex flex-wrap gap-2">
          {TAPE_SAMPLES.map(s => {
            const parsed = parseCommand(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => parsed && onLaunch(parsed)}
                className="tape-btn tape-mono px-2.5 py-1.5 text-[11px]"
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TapeCommandSurface;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getSplit } from '../../../services/tape/index.ts';
import type { SplitResult, SplitSide } from '../../../services/tape/index.ts';
import TapeCitationRow from '../TapeCitationRow.tsx';
import TapeTickerStrip from '../TapeTickerStrip.tsx';
import { TapeField, RunButton, TapeStatus } from '../TapeActionScaffold.tsx';
import { TICKERS_SPLIT_AI } from '../../../data/mockTapeTickers.ts';

type Status = 'idle' | 'loading' | 'error';

const SideColumn: React.FC<{ side: SplitSide }> = ({ side }) => (
  <div className="min-w-0 flex-1">
    <div className="border-b px-4 py-3" style={{ borderColor: 'var(--tape-hairline)' }}>
      <h3 className="tape-serif text-lg" style={{ color: 'var(--tape-fg)' }}>{side.person}</h3>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{side.positionSummary}</p>
    </div>
    <div className="tape-divide">
      {side.citations.length === 0 ? (
        <div className="tape-mono px-4 py-6 text-xs" style={{ color: 'var(--tape-fg-faint)' }}>No cited positions.</div>
      ) : (
        side.citations.map(c => <TapeCitationRow key={c.pineconeId} citation={c} />)
      )}
    </div>
  </div>
);

const SplitView: React.FC<{ initialA?: string; initialB?: string; initialTopic?: string }> = ({ initialA, initialB, initialTopic }) => {
  const [personA, setPersonA] = useState(initialA || '');
  const [personB, setPersonB] = useState(initialB || '');
  const [topic, setTopic] = useState(initialTopic || '');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<SplitResult | null>(null);
  const autoRan = useRef(false);

  const run = useCallback(async (a: string, b: string, t: string) => {
    if (!a.trim() || !b.trim() || !t.trim()) return;
    setStatus('loading');
    setError('');
    try {
      setResult(await getSplit({ personA: a.trim(), personB: b.trim(), topic: t.trim() }));
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Failed to compare positions.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (initialA && initialB && initialTopic && !autoRan.current) {
      autoRan.current = true;
      void run(initialA, initialB, initialTopic);
    }
  }, [initialA, initialB, initialTopic, run]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(personA, personB, topic);
  };

  const ready = personA.trim() && personB.trim() && topic.trim();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <TapeField label="Person A" className="flex-1 min-w-[12rem]">
          <input className="tape-input px-3 py-2" value={personA} onChange={e => setPersonA(e.target.value)} placeholder="e.g. Druckenmiller" autoFocus />
        </TapeField>
        <TapeField label="Person B" className="flex-1 min-w-[12rem]">
          <input className="tape-input px-3 py-2" value={personB} onChange={e => setPersonB(e.target.value)} placeholder="e.g. Mike Green" />
        </TapeField>
        <TapeField label="Topic" className="flex-1 min-w-[12rem]">
          <input className="tape-input px-3 py-2" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. rate cuts" />
        </TapeField>
        <RunButton loading={status === 'loading'} disabled={!ready} label="Compare" />
      </form>

      <div className="mt-6 tape-panel">
        {status === 'loading' && <TapeStatus kind="loading" message="Comparing stated positions…" />}
        {status === 'error' && <TapeStatus kind="error" message={error} />}
        {status === 'idle' && !result && <TapeStatus kind="empty" message="Name two people and a topic to compare their stated positions side by side." />}

        {status === 'idle' && result && (
          <div className="tape-fade">
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--tape-hairline)' }}>
              <span className="tape-tag px-1.5 py-0.5">{result.topic}</span>
            </div>
            {/* on the tape */}
            <TapeTickerStrip tickers={TICKERS_SPLIT_AI} />
            <div className="flex flex-col md:flex-row">
              <SideColumn side={result.sideA} />
              <div className="border-t md:border-t-0 md:border-l" style={{ borderColor: 'var(--tape-hairline)' }} />
              <SideColumn side={result.sideB} />
            </div>
            {result.contrastSummary && (
              <div className="border-t px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="tape-label mb-1.5">Where they diverge</div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{result.contrastSummary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitView;

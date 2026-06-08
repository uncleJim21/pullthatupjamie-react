import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getSplit } from '../../../services/tape/index.ts';
import type { SplitResult, SplitSide } from '../../../services/tape/index.ts';
import TapeCitationRow from '../TapeCitationRow.tsx';
import TapeTickerStrip from '../TapeTickerStrip.tsx';
import { TapeField, RunButton, TapeStatus, TapeResultFooter, TapeActionBar, ConfidencePill } from '../TapeActionScaffold.tsx';
import { useTapeModel } from '../../../services/tape/useTapeModel.ts';

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

const SplitView: React.FC<{ initialA?: string; initialB?: string; initialTopic?: string; onBack: () => void }> = ({ initialA, initialB, initialTopic, onBack }) => {
  const [personA, setPersonA] = useState(initialA || '');
  const [personB, setPersonB] = useState(initialB || '');
  const [topic, setTopic] = useState(initialTopic || '');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<SplitResult | null>(null);
  const autoRan = useRef(false);

  const [model] = useTapeModel();
  const run = useCallback(async (a: string, b: string, t: string, refresh = false) => {
    if (!a.trim() || !b.trim() || !t.trim()) return;
    setStatus('loading');
    setError('');
    try {
      setResult(await getSplit({ personA: a.trim(), personB: b.trim(), topic: t.trim(), refresh, model }));
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Failed to compare positions.');
      setStatus('error');
    }
  }, [model]);

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

  // Color-coded Easy chips: just bulls/bears. Click fills the input AND
  // auto-fills the opposite camp on the OTHER side — but only when that
  // other field is empty or already a known camp value (so an explicit name
  // like "Druckenmiller" isn't clobbered). Hawks/Doves removed to reduce
  // clutter; isCampMode still accepts them for power users typing manually.
  const isKnownCamp = (v: string) => {
    const t = v.trim().toLowerCase();
    return t === 'bulls' || t === 'bears';
  };
  const opposite = (label: 'Bulls' | 'Bears'): 'Bulls' | 'Bears' => (label === 'Bulls' ? 'Bears' : 'Bulls');
  const renderCampChip = (target: 'A' | 'B', label: 'Bulls' | 'Bears') => {
    const isBull = label === 'Bulls';
    const handleClick = () => {
      if (target === 'A') {
        setPersonA(label);
        if (!personB.trim() || isKnownCamp(personB)) setPersonB(opposite(label));
      } else {
        setPersonB(label);
        if (!personA.trim() || isKnownCamp(personA)) setPersonA(opposite(label));
      }
    };
    return (
      <button
        type="button"
        onClick={handleClick}
        className="tape-pill px-2 py-0.5 text-[10px]"
        style={{
          borderColor: isBull ? 'var(--tape-accent)' : 'var(--tape-danger)',
          color: isBull ? 'var(--tape-accent)' : 'var(--tape-danger)',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <TapeActionBar
        onBack={onBack}
        onRefresh={result?._meta ? () => run(result.sideA.person, result.sideB.person, result.topic, true) : undefined}
        refreshLoading={status === 'loading'}
      />
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <TapeField label="Person A" className="flex-1 min-w-[12rem]">
          <input className="tape-input px-3 py-2" value={personA} onChange={e => setPersonA(e.target.value)} placeholder="e.g. Druckenmiller" autoFocus />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {renderCampChip('A', 'Bulls')}
            {renderCampChip('A', 'Bears')}
          </div>
        </TapeField>
        <TapeField label="Person B" className="flex-1 min-w-[12rem]">
          <input className="tape-input px-3 py-2" value={personB} onChange={e => setPersonB(e.target.value)} placeholder="e.g. Mike Green" />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {renderCampChip('B', 'Bulls')}
            {renderCampChip('B', 'Bears')}
          </div>
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
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--tape-hairline)' }}>
              <span className="tape-tag px-1.5 py-0.5">{result.topic}</span>
              <ConfidencePill meta={result._meta} />
            </div>
            {/* on the tape */}
            {result.tickers && result.tickers.length > 0 && <TapeTickerStrip symbols={result.tickers} />}
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
            <TapeResultFooter meta={result._meta} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitView;

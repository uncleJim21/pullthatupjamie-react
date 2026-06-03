import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getBrief } from '../../../services/tape/index.ts';
import type { BriefResult } from '../../../services/tape/index.ts';
import TapeCitationRow from '../TapeCitationRow.tsx';
import TapeTickerStrip from '../TapeTickerStrip.tsx';
import { TapeField, RunButton, TapeStatus, TapeResultFooter, TapeActionBar } from '../TapeActionScaffold.tsx';
import { formatShortDate } from '../../../utils/time.ts';
import { useTapeModel } from '../../../services/tape/useTapeModel.ts';

type Status = 'idle' | 'loading' | 'error';
const iso = (d: Date) => d.toISOString().slice(0, 10);

const BriefView: React.FC<{ initialTopic?: string; onBack: () => void }> = ({ initialTopic, onBack }) => {
  const [topic, setTopic] = useState(initialTopic || '');
  const [asOfDate, setAsOfDate] = useState(iso(new Date()));
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<BriefResult | null>(null);
  const autoRan = useRef(false);

  const [model] = useTapeModel();
  const run = useCallback(async (t: string, asOf: string, refresh = false) => {
    if (!t.trim()) return;
    setStatus('loading');
    setError('');
    try {
      setResult(await getBrief({ topic: t.trim(), asOfDate: asOf, refresh, model }));
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Failed to compile brief.');
      setStatus('error');
    }
  }, [model]);

  useEffect(() => {
    if (initialTopic && !autoRan.current) {
      autoRan.current = true;
      void run(initialTopic, iso(new Date()));
    }
  }, [initialTopic, run]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(topic, asOfDate);
  };

  const empty = result && result.sections.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <TapeActionBar
        onBack={onBack}
        onRefresh={result?._meta ? () => run(result.topic, result.asOfDate, true) : undefined}
        refreshLoading={status === 'loading'}
      />
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <TapeField label="Topic" className="flex-1 min-w-[14rem]">
          <input className="tape-input px-3 py-2" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. yield-curve inversion" autoFocus />
        </TapeField>
        <TapeField label="As of">
          <input type="date" className="tape-input px-3 py-2" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
        </TapeField>
        <RunButton loading={status === 'loading'} disabled={!topic.trim()} label="Compile brief" />
      </form>

      <div className="mt-6 tape-panel">
        {status === 'loading' && <TapeStatus kind="loading" message={`Synthesizing the week on ${topic}…`} />}
        {status === 'error' && <TapeStatus kind="error" message={error} />}
        {status === 'idle' && !result && <TapeStatus kind="empty" message="Enter a topic to synthesize what was said across the corpus this week." />}
        {status === 'idle' && empty && <TapeStatus kind="empty" message={`No ${result?.topic} commentary surfaced for the week ending ${result ? formatShortDate(result.asOfDate) : ''}.`} />}

        {status === 'idle' && result && !empty && (
          <div className="tape-fade">
            <div className="border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
              <div className="flex items-baseline gap-2.5">
                <span className="tape-tag px-1.5 py-0.5">{result.topic}</span>
                <span className="tape-num text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>week ending {formatShortDate(result.asOfDate)}</span>
              </div>
              <p className="tape-serif mt-2 text-xl leading-snug" style={{ color: 'var(--tape-fg)' }}>{result.headline}</p>
            </div>

            {/* on the tape — backend-curated for the topic */}
            {result.tickers && result.tickers.length > 0 && <TapeTickerStrip symbols={result.tickers} />}

            {result.sections.map(s => (
              <section key={s.publisher} className="border-b last:border-b-0" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="px-4 pt-4 pb-1">
                  <div className="tape-mono text-sm" style={{ color: 'var(--tape-fg)' }}>{s.publisher}</div>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{s.summary}</p>
                </div>
                <div className="tape-divide">
                  {s.citations.map(c => (
                    <TapeCitationRow key={c.pineconeId} citation={c} />
                  ))}
                </div>
              </section>
            ))}
            <TapeResultFooter meta={result._meta} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BriefView;

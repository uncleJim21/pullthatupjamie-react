import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getDossier } from '../../../services/tape/index.ts';
import type { DossierResult } from '../../../services/tape/index.ts';
import TapeCitationRow from '../TapeCitationRow.tsx';
import TapeTickerStrip from '../TapeTickerStrip.tsx';
import { TapeField, RunButton, TapeStatus, TapeResultFooter, TapeActionBar, ConfidencePill, PreviewPanel, PreviewBanner } from '../TapeActionScaffold.tsx';
import { useTapeModel } from '../../../services/tape/useTapeModel.ts';

type Status = 'idle' | 'loading' | 'error';

// Gate Dossier behind a preview surface until live person-resolution is
// reliable across novel names. Canon-example clicks still hit the normal
// pipeline and render the full result.
const PREVIEW_ONLY = true;

const DossierView: React.FC<{ initialPerson?: string; onBack: () => void }> = ({ initialPerson, onBack }) => {
  const [person, setPerson] = useState(initialPerson || '');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<DossierResult | null>(null);
  const autoRan = useRef(false);

  const [model] = useTapeModel();
  const run = useCallback(async (name: string, refresh = false) => {
    if (!name.trim()) return;
    setStatus('loading');
    setError('');
    try {
      setResult(await getDossier({ person: name.trim(), refresh, model }));
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Failed to build dossier.');
      setStatus('error');
    }
  }, [model]);

  useEffect(() => {
    if (initialPerson && !autoRan.current) {
      autoRan.current = true;
      void run(initialPerson);
    }
  }, [initialPerson, run]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(person);
  };

  const empty = result && result.topics.length === 0;
  // Preview gate: hide free-text input. Canon example clicks still
  // invoke run() normally → canon hits → full Dossier renders.
  const showPreview = PREVIEW_ONLY && !result && status === 'idle';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <TapeActionBar
        onBack={onBack}
        onRefresh={result?._meta ? () => run(result.person, true) : undefined}
        refreshLoading={status === 'loading'}
      />
      {PREVIEW_ONLY && (
        <PreviewBanner
          note="Curated canon only — live person-resolution still hardening."
          examples={[
            { label: 'Mohamed El-Erian', onClick: () => { setPerson('Mohamed El-Erian'); void run('Mohamed El-Erian'); } },
            { label: 'Luke Gromen', onClick: () => { setPerson('Luke Gromen'); void run('Luke Gromen'); } },
            { label: 'Mike Green', onClick: () => { setPerson('Mike Green'); void run('Mike Green'); } },
          ]}
        />
      )}
      {showPreview ? (
        <PreviewPanel
          title="Dossier"
          description={`Compile a person's stated positions across podcast appearances — grouped by topic, every quote sourced and playable. Currently in preview; try one of the curated canon examples.`}
          examples={[
            { label: 'Mohamed El-Erian', onClick: () => { setPerson('Mohamed El-Erian'); void run('Mohamed El-Erian'); } },
            { label: 'Luke Gromen', onClick: () => { setPerson('Luke Gromen'); void run('Luke Gromen'); } },
            { label: 'Mike Green', onClick: () => { setPerson('Mike Green'); void run('Mike Green'); } },
          ]}
        />
      ) : (
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <TapeField label="Person" className="flex-1 min-w-[16rem]">
          <input
            className="tape-input px-3 py-2"
            value={person}
            onChange={e => setPerson(e.target.value)}
            placeholder="e.g. Stanley Druckenmiller"
            autoFocus
          />
        </TapeField>
        <RunButton loading={status === 'loading'} disabled={!person.trim()} label="Build dossier" />
      </form>
      )}

      {!showPreview && (
      <div className="mt-6 tape-panel">
        {status === 'loading' && <TapeStatus kind="loading" message={`Assembling dossier on ${person}…`} />}
        {status === 'error' && <TapeStatus kind="error" message={error} />}
        {status === 'idle' && !result && (
          <TapeStatus kind="empty" message="Enter a finance personality to compile their stated positions." />
        )}
        {status === 'idle' && empty && (
          <TapeStatus
            kind="empty"
            message={result?._meta?.confidenceReason || `No corpus positions resolved for ${result?.person}.`}
          />
        )}

        {status === 'idle' && result && !empty && (
          <div className="tape-fade">
            {/* header */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
              <h2 className="tape-serif text-2xl" style={{ color: 'var(--tape-fg)' }}>{result.person}</h2>
              <div className="flex items-center gap-2">
                <span className="tape-num text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                  {result.topics.reduce((a, t) => a + t.citations.length, 0)} cites · {result.topics.length} topics · {result.appearances.length} shows
                </span>
                <ConfidencePill meta={result._meta} />
              </div>
            </div>

            {/* on the tape — backend-curated per Dossier subject */}
            {result.tickers && result.tickers.length > 0 && <TapeTickerStrip symbols={result.tickers} />}

            {/* appearance map */}
            {result.appearances.length > 0 && (
              <div className="border-b px-4 py-3" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="tape-label mb-2">Appearance map</div>
                <div className="flex flex-wrap gap-2">
                  {result.appearances.map(a => (
                    <span key={a.show + a.episodeTitle} className="tape-num inline-flex items-center gap-1.5 border px-2 py-1 text-[11px]" style={{ borderColor: 'var(--tape-hairline-strong)', color: 'var(--tape-fg-dim)' }}>
                      {a.show}
                      <span style={{ color: 'var(--tape-accent-dim)' }}>×{a.citationCount}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* topic groups */}
            {result.topics.map(t => (
              <section key={t.topic} className="border-b last:border-b-0" style={{ borderColor: 'var(--tape-hairline)' }}>
                <div className="px-4 pt-4 pb-2">
                  <span className="tape-tag px-1.5 py-0.5">{t.topic}</span>
                </div>
                <p className="px-4 pb-2 text-sm leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{t.positionSummary}</p>
                <div className="tape-divide">
                  {t.citations.map(c => (
                    <TapeCitationRow key={c.pineconeId} citation={c} />
                  ))}
                </div>
              </section>
            ))}
            <TapeResultFooter meta={result._meta} />
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default DossierView;

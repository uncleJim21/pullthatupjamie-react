import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getTimeline, getTimelineDrilldown } from '../../../services/tape/index.ts';
import type { TimelineResult, TimelineDrilldownResult } from '../../../services/tape/index.ts';
import TapeChart from '../TapeChart.tsx';
import TapeCitationRow from '../TapeCitationRow.tsx';
import { TapeField, RunButton, TapeStatus, TapeActionBar } from '../TapeActionScaffold.tsx';
import { formatShortDate } from '../../../utils/time.ts';

type Status = 'idle' | 'loading' | 'error';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const defaultEnd = () => iso(new Date());
const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7 * 26); // ~6 months
  return iso(d);
};
const addDays = (isoStr: string, n: number) => {
  const d = new Date(isoStr);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const TimelineView: React.FC<{ initialTopic?: string; onBack: () => void }> = ({ initialTopic, onBack }) => {
  const [topic, setTopic] = useState(initialTopic || '');
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<TimelineResult | null>(null);

  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [drill, setDrill] = useState<TimelineDrilldownResult | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const autoRan = useRef(false);

  const run = useCallback(async (t: string, s: string, e: string) => {
    if (!t.trim()) return;
    setStatus('loading');
    setError('');
    setSelectedWeek(null);
    setDrill(null);
    try {
      setResult(await getTimeline({ topic: t.trim(), startDate: s, endDate: e }));
      setStatus('idle');
    } catch (err: any) {
      setError(err?.message || 'Failed to load timeline.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (initialTopic && !autoRan.current) {
      autoRan.current = true;
      void run(initialTopic, defaultStart(), defaultEnd());
    }
  }, [initialTopic, run]);

  const selectWeek = useCallback(
    async (weekStart: string) => {
      if (!result) return;
      setSelectedWeek(weekStart);
      setDrillLoading(true);
      setDrill(null);
      try {
        setDrill(await getTimelineDrilldown({ topic: result.topic, weekStart, weekEnd: addDays(weekStart, 6) }));
      } catch {
        setDrill({ weekStart, summary: 'Failed to load underlying hits for this week.', citations: [] });
      } finally {
        setDrillLoading(false);
      }
    },
    [result]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(topic, startDate, endDate);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <TapeActionBar onBack={onBack} />
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <TapeField label="Topic" className="flex-1 min-w-[14rem]">
          <input className="tape-input px-3 py-2" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Fed policy" autoFocus />
        </TapeField>
        <TapeField label="From">
          <input type="date" className="tape-input px-3 py-2" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </TapeField>
        <TapeField label="To">
          <input type="date" className="tape-input px-3 py-2" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </TapeField>
        <RunButton loading={status === 'loading'} disabled={!topic.trim()} label="Plot timeline" />
      </form>

      <div className="mt-6 tape-panel">
        {status === 'loading' && <TapeStatus kind="loading" message={`Counting mentions of ${topic}…`} />}
        {status === 'error' && <TapeStatus kind="error" message={error} />}
        {status === 'idle' && !result && <TapeStatus kind="empty" message="Enter a topic and date range to plot weekly mention counts." />}

        {status === 'idle' && result && (
          <div className="tape-fade">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-4" style={{ borderColor: 'var(--tape-hairline)' }}>
              <div className="flex items-baseline gap-2.5">
                <span className="tape-tag px-1.5 py-0.5">{result.topic}</span>
                <span className="tape-num text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                  {formatShortDate(result.startDate)} → {formatShortDate(result.endDate)}
                </span>
              </div>
              <span className="tape-num text-[11px]" style={{ color: 'var(--tape-fg-dim)' }}>
                <span style={{ color: 'var(--tape-accent)' }}>{result.totalMentions}</span> total mentions
              </span>
            </div>

            <div className="px-3 py-4">
              <TapeChart buckets={result.buckets} selectedWeek={selectedWeek} onSelectWeek={selectWeek} />
              <div className="mt-1 text-center text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                {selectedWeek ? 'click a different week to re-scope' : 'click any week to surface the underlying hits'}
              </div>
            </div>

            {/* drill-down */}
            {(drillLoading || drill) && (
              <div className="border-t" style={{ borderColor: 'var(--tape-hairline)' }}>
                {drillLoading && <TapeStatus kind="loading" message={`Pulling hits for week of ${selectedWeek ? formatShortDate(selectedWeek) : ''}…`} />}
                {!drillLoading && drill && (
                  <div className="tape-fade">
                    <div className="px-4 pt-4 pb-1">
                      <div className="tape-label mb-1.5">Week of {formatShortDate(drill.weekStart)}</div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--tape-fg-dim)' }}>{drill.summary}</p>
                    </div>
                    <div className="tape-divide">
                      {drill.citations.map(c => (
                        <TapeCitationRow key={c.pineconeId} citation={c} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineView;

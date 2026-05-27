import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { AudioControllerProvider } from '../../context/AudioControllerContext.tsx';
import { TAPE_NAME } from '../../config/tapeConfig.ts';
import TapeCommandSurface, { type TapeLaunch } from './TapeCommandSurface.tsx';
import DossierView from './actions/DossierView.tsx';
import TimelineView from './actions/TimelineView.tsx';
import BriefView from './actions/BriefView.tsx';
import SplitView from './actions/SplitView.tsx';
import '../../styles/tape.css';

const ACTION_TITLES: Record<TapeLaunch['action'], string> = {
  dossier: 'Dossier',
  timeline: 'Timeline',
  brief: 'Brief',
  split: 'Split',
};

const ActiveView: React.FC<{ launch: TapeLaunch }> = ({ launch }) => {
  switch (launch.action) {
    case 'dossier':
      return <DossierView initialPerson={launch.person} />;
    case 'timeline':
      return <TimelineView initialTopic={launch.topic} />;
    case 'brief':
      return <BriefView initialTopic={launch.topic} />;
    case 'split':
      return <SplitView initialA={launch.person} initialB={launch.personB} initialTopic={launch.topic} />;
    default:
      return null;
  }
};

const TapePage: React.FC = () => {
  const [launch, setLaunch] = useState<TapeLaunch | null>(null);

  const goHome = useCallback(() => setLaunch(null), []);

  useEffect(() => {
    if (!launch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goHome();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [launch, goHome]);

  return (
    <AudioControllerProvider>
      <Helmet>
        <title>{TAPE_NAME} — macro commentary intelligence</title>
        <meta name="description" content="Bloomberg-grade search across the podcast macro and finance commentary universe. Track what every macro thinker said, when, with timestamped citations." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="tape-root tape-scrollbar min-h-screen">
        {/* top bar */}
        <header
          className="sticky top-0 z-20 flex h-12 items-center justify-between border-b px-4"
          style={{ borderColor: 'var(--tape-hairline)', background: 'var(--tape-bg)' }}
        >
          <div className="flex items-center gap-3">
            {launch ? (
              <button type="button" onClick={goHome} className="tape-btn flex items-center gap-1.5 px-2 py-1 text-[11px]" title="Back to launcher (Esc)">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : null}
            <button type="button" onClick={goHome} className="tape-serif text-base tracking-tight" style={{ color: 'var(--tape-fg)' }}>
              {TAPE_NAME}
            </button>
            {launch && (
              <span className="tape-mono text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
                / {ACTION_TITLES[launch.action]}
              </span>
            )}
          </div>
          <a href="/app" className="tape-mono text-[11px] transition-colors" style={{ color: 'var(--tape-fg-faint)' }}>
            pullthatupjamie ↗
          </a>
        </header>

        {launch ? <ActiveView launch={launch} /> : <TapeCommandSurface onLaunch={setLaunch} />}
      </div>
    </AudioControllerProvider>
  );
};

export default TapePage;

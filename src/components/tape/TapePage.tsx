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
import ArcView from './actions/ArcView.tsx';
import ReadInView from './actions/ReadInView.tsx';
import TapeAuthGate from './TapeAuthGate.tsx';
import { signOut } from '../../services/tape/tapeAuth.ts';
import type { TapeDepth } from '../../services/tape/tapeTypes.ts';
import '../../styles/tape.css';

const ACTION_TITLES: Record<TapeLaunch['action'], string> = {
  dossier: 'Dossier',
  timeline: 'Timeline',
  brief: 'Brief',
  split: 'Split',
  arc: 'Arc',
  readin: 'Read in',
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
    case 'arc':
      return <ArcView initialPerson={launch.person} />;
    case 'readin':
      return <ReadInView initialTicker={launch.ticker} initialDepth={launch.depth} />;
    default:
      return null;
  }
};

// Deep-link support: /tape?a=dossier&p=El-Erian, /tape?a=brief&t=oil,
// /tape?a=split&p=The%20bulls&b=The%20bears&t=the%20AI%20bubble,
// /tape?a=readin&t=APP&depth=brief.
const launchFromUrl = (): TapeLaunch | null => {
  try {
    const sp = new URLSearchParams(window.location.search);
    const a = sp.get('a');
    if (a === 'dossier' || a === 'brief' || a === 'split' || a === 'timeline' || a === 'arc' || a === 'readin') {
      const depth = sp.get('depth');
      return {
        action: a,
        person: sp.get('p') || undefined,
        personB: sp.get('b') || undefined,
        topic: sp.get('t') || undefined,
        ticker: sp.get('t') || undefined,
        depth: (depth === 'quick' || depth === 'brief' || depth === 'deep') ? (depth as TapeDepth) : undefined,
      };
    }
  } catch { /* SSR / malformed */ }
  return null;
};

const TapePage: React.FC = () => {
  const [launch, setLaunch] = useState<TapeLaunch | null>(launchFromUrl);

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
    <TapeAuthGate>
    <AudioControllerProvider>
      <Helmet>
        <title>{TAPE_NAME}: macro commentary intelligence</title>
        <meta name="description" content="Read the tape, skip the noise. Search what the sharpest macro voices actually said across Bloomberg Surveillance, Odd Lots and the top finance podcasts. Real quotes, timestamped and sourced." />
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
              <span className="text-[12px]" style={{ color: 'var(--tape-fg-faint)' }}>
                / {ACTION_TITLES[launch.action]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={signOut}
              className="text-[12px] transition-colors hover:opacity-80"
              style={{ color: 'var(--tape-fg-faint)' }}
              title="Sign out of the Tape demo"
            >
              sign out
            </button>
            <a href="/app" className="text-[12px] transition-colors" style={{ color: 'var(--tape-fg-faint)' }}>
              pullthatupjamie ↗
            </a>
          </div>
        </header>

        {launch ? <ActiveView launch={launch} /> : <TapeCommandSurface onLaunch={setLaunch} />}
      </div>
    </AudioControllerProvider>
    </TapeAuthGate>
  );
};

export default TapePage;

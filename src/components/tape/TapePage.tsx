import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { AudioControllerProvider } from '../../context/AudioControllerContext.tsx';
import { TAPE_NAME } from '../../config/tapeConfig.ts';
import TapeCommandSurface, { type TapeLaunch } from './TapeCommandSurface.tsx';
import DossierView from './actions/DossierView.tsx';
import TimelineView from './actions/TimelineView.tsx';
import BriefView from './actions/BriefView.tsx';
import SplitView from './actions/SplitView.tsx';
import NarrativeView from './actions/NarrativeView.tsx';
import ReadInView from './actions/ReadInView.tsx';
import TapeAuthGate from './TapeAuthGate.tsx';
import { signOut } from '../../services/tape/tapeAuth.ts';
import type { TapeDepth } from '../../services/tape/tapeTypes.ts';
import '../../styles/tape.css';

const ACTION_TITLES: Record<TapeLaunch['action'], string> = {
  dossier: 'Dossier (preview)',
  timeline: 'Timeline',
  brief: 'Brief',
  split: 'Split',
  narrative: 'Narrative (preview)',
  readin: 'Read in',
};

const ActiveView: React.FC<{ launch: TapeLaunch; onBack: () => void }> = ({ launch, onBack }) => {
  switch (launch.action) {
    case 'dossier':
      return <DossierView initialPerson={launch.person} onBack={onBack} />;
    case 'timeline':
      return <TimelineView initialTopic={launch.topic} onBack={onBack} />;
    case 'brief':
      return <BriefView initialTopic={launch.topic} onBack={onBack} />;
    case 'split':
      return <SplitView initialA={launch.person} initialB={launch.personB} initialTopic={launch.topic} onBack={onBack} />;
    case 'narrative':
      return <NarrativeView initialTopic={launch.topic} initialGroup={launch.person} onBack={onBack} />;
    case 'readin':
      return <ReadInView initialTicker={launch.ticker} initialDepth={launch.depth} onBack={onBack} />;
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
    if (a === 'dossier' || a === 'brief' || a === 'split' || a === 'timeline' || a === 'narrative' || a === 'readin') {
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

/** Tell the AudioControllerProvider to stop whatever's playing.
 *  Used on navigate-away (Back / New search / Esc), sign-out, and the SPA
 *  beforeunload path. Minimizes the "I left the page but a clip is still
 *  playing" memory + UX leak. */
const stopAllTapeAudio = () => {
  window.dispatchEvent(new Event('stopAllAudio'));
};

const TapePage: React.FC = () => {
  const [launch, setLaunch] = useState<TapeLaunch | null>(launchFromUrl);

  const goHome = useCallback(() => {
    stopAllTapeAudio();
    setLaunch(null);
  }, []);

  const handleSignOut = useCallback(() => {
    stopAllTapeAudio();
    signOut();
  }, []);

  useEffect(() => {
    if (!launch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goHome();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [launch, goHome]);

  // Belt-and-suspenders: any time the active launch changes (including unmount
  // / route change away from /tape), kill any audio that was playing under the
  // previous launch. Future global player will replace this.
  useEffect(() => {
    return () => { stopAllTapeAudio(); };
  }, [launch]);

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
              onClick={handleSignOut}
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

        {launch ? <ActiveView launch={launch} onBack={goHome} /> : <TapeCommandSurface onLaunch={setLaunch} />}
      </div>
    </AudioControllerProvider>
    </TapeAuthGate>
  );
};

export default TapePage;

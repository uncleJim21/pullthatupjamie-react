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
import TapeAccessGate from './TapeAccessGate.tsx';
import TapePersonaDrawer from './TapePersonaDrawer.tsx';
import EmbedMiniPlayer from '../EmbedMiniPlayer.tsx';
import FloatingMiniPlayerIsland from '../FloatingMiniPlayerIsland.tsx';
import { TAPE_UNAUTHORIZED_EVENT } from '../../services/tape/tapeClient.ts';
import { TAPE_FEED_INVALIDATE_EVENT } from '../../services/tape/tapeFeed.ts';
import { useTapePersona } from '../../services/tape/tapePersona.ts';
import { TapeNowPlayingProvider, useTapeNowPlaying } from '../../services/tape/tapeNowPlaying.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';
import { clearUserData } from '../../utils/signOut.ts';
import { notifyAuthStateChanged } from '../../hooks/useSubscriptionStatus.ts';
import type { TapeDepth } from '../../services/tape/tapeTypes.ts';
import '../../styles/tape.css';

/** Tracks whether the persona drawer has been auto-opened for this user
 *  already, so we don't re-prompt on every reload. Cleared by clearUserData
 *  on sign-out (it's a USER_SPECIFIC_KEY pattern but we manage it locally
 *  since main-app sign-out util doesn't know about Tape keys). */
const PERSONA_PROMPT_KEY = 'tape.persona.promptShown';

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

/** Inner component — needs to live inside both the AudioController and
 *  TapeNowPlaying providers so it can wire the global player. The outer
 *  TapePage wraps it in the providers. */
const TapePageContent: React.FC = () => {
  const [launch, setLaunch] = useState<TapeLaunch | null>(launchFromUrl);
  const [personaOpen, setPersonaOpen] = useState(false);
  const { state: personaState } = useTapePersona();
  const { active: nowPlaying, clear: clearNowPlaying } = useTapeNowPlaying();

  const goHome = useCallback(() => {
    stopAllTapeAudio();
    clearNowPlaying();
    setLaunch(null);
  }, [clearNowPlaying]);

  const handleSignOut = useCallback(() => {
    stopAllTapeAudio();
    clearNowPlaying();
    try { localStorage.removeItem(PERSONA_PROMPT_KEY); } catch { /* noop */ }
    clearUserData();
    notifyAuthStateChanged();
    window.dispatchEvent(new Event(TAPE_UNAUTHORIZED_EVENT));
  }, [clearNowPlaying]);

  // Auto-open the persona drawer the FIRST time a signed-in user lands on
  // /tape with an empty persona. Subsequent loads don't re-prompt — the
  // user can still open it from the top bar. Cleared on sign-out so a new
  // user sees the prompt.
  useEffect(() => {
    if (personaState.kind !== 'ready') return;
    if (personaState.value.trim().length > 0) return;
    try {
      if (localStorage.getItem(PERSONA_PROMPT_KEY)) return;
      localStorage.setItem(PERSONA_PROMPT_KEY, '1');
    } catch { /* private-browsing — skip the once-only guard, accept re-prompts */ }
    setPersonaOpen(true);
  }, [personaState]);

  const handlePersonaSaved = useCallback(() => {
    window.dispatchEvent(new Event(TAPE_FEED_INVALIDATE_EVENT));
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
    <>
      <Helmet>
        <title>{TAPE_NAME}: macro commentary intelligence</title>
        <meta name="description" content="Read the tape, skip the noise. Search what the sharpest macro voices actually said across Bloomberg Surveillance, Odd Lots and the top finance podcasts. Real quotes, timestamped and sourced." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div
        className="tape-root tape-scrollbar min-h-screen"
        // When the global player is mounted, the floating island sits over
        // the bottom edge. Pad so the final row of content can scroll clear
        // of it. Tuned to roughly the player's intrinsic height + the
        // wrapper's pb-3 + a touch of breathing room.
        style={{ paddingBottom: nowPlaying ? 'calc(var(--tape-mini-player-height, 140px) + 16px)' : undefined }}
      >
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
              onClick={() => setPersonaOpen(true)}
              className="text-[12px] transition-colors hover:opacity-80"
              style={{ color: 'var(--tape-fg-faint)' }}
              title="Brief the tape"
            >
              briefing
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-[12px] transition-colors hover:opacity-80"
              style={{ color: 'var(--tape-fg-faint)' }}
              title="Sign out"
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

      <TapePersonaDrawer
        isOpen={personaOpen}
        onClose={() => setPersonaOpen(false)}
        onSaved={handlePersonaSaved}
      />

      {/* Global mini-player. Reuses JPA's "floating island" wrapper via
          the shared FloatingMiniPlayerIsland (variant='tape'), so the
          gutters stay transparent (content scrolls behind), the surface
          is one centered rounded card, and the look matches JPA exactly
          except for the border tone. Mounted only while a citation is
          active so the page stays clean on first load. */}
      <FloatingMiniPlayerIsland variant="tape" visible={!!nowPlaying} position="fixed" zIndex={30}>
        {nowPlaying && (
          <div className="tape-player-skin [&>div]:!relative [&>div]:!inset-auto">
            <EmbedMiniPlayer
              mode="app"
              isHovered={true}
              audioUnlocked={true}
              trackId={nowPlaying.pineconeId}
              audioUrl={nowPlaying.audioUrl}
              episodeTitle={nowPlaying.episodeTitle}
              episodeImage={nowPlaying.episodeImage}
              creator={nowPlaying.creator}
              publishedDate={nowPlaying.publishedDate}
              timeContext={{ start_time: nowPlaying.startTime, end_time: nowPlaying.endTime }}
              quote={nowPlaying.text}
              hierarchyLevel="paragraph"
              onCopyLink={() => {
                navigator.clipboard.writeText(createClipShareUrl(nowPlaying.pineconeId)).catch(() => {});
              }}
            />
          </div>
        )}
      </FloatingMiniPlayerIsland>
    </>
  );
};

/** Outer wrapper — composes the gate + the two providers around the body.
 *  Keeping the inner `TapePageContent` inside both providers lets it use
 *  `useTapeNowPlaying()` to drive the global mini-player without any
 *  prop-drilling. */
const TapePage: React.FC = () => (
  <TapeAccessGate>
    <AudioControllerProvider>
      <TapeNowPlayingProvider>
        <TapePageContent />
      </TapeNowPlayingProvider>
    </AudioControllerProvider>
  </TapeAccessGate>
);

export default TapePage;

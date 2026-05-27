import React, { useState } from 'react';
import { Play, Pause, Link2, Check } from 'lucide-react';
import { useAudioController } from '../../context/AudioControllerContext.tsx';
import { createClipShareUrl } from '../../utils/urlUtils.ts';
import { formatTime, formatShortDate } from '../../utils/time.ts';
import type { TapeCitation } from '../../services/tape/tapeTypes.ts';

/**
 * Dense, verbatim citation row. The quote is monospace to signal exact
 * transcription; everything else is a tight metadata line. Plays through the
 * shared AudioControllerContext and exposes a copy-link affordance.
 */
const TapeCitationRow: React.FC<{ citation: TapeCitation }> = ({ citation }) => {
  const { playTrack, togglePlay, currentTrack, isPlaying } = useAudioController();
  const [copied, setCopied] = useState(false);

  const isActive = currentTrack?.id === citation.pineconeId;
  const isThisPlaying = isActive && isPlaying;

  const onPlay = () => {
    if (isActive) {
      void togglePlay();
      return;
    }
    void playTrack({
      id: citation.pineconeId,
      audioUrl: citation.audioUrl,
      startTime: citation.startTime,
      endTime: citation.endTime,
    });
  };

  const onCopy = () => {
    navigator.clipboard.writeText(createClipShareUrl(citation.pineconeId)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {}
    );
  };

  return (
    <div className={`tape-cite flex gap-3 px-4 py-3 ${isActive ? 'tape-cite--active' : ''}`}>
      <button
        type="button"
        onClick={onPlay}
        className="tape-cite__play mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center"
        aria-label={isThisPlaying ? 'Pause clip' : 'Play clip'}
        title={isThisPlaying ? 'Pause' : 'Play from timestamp'}
      >
        {isThisPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="tape-quote">{citation.text || '(no transcript text)'}</p>
        <div className="tape-num mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: 'var(--tape-fg-faint)' }}>
          {citation.speaker && (
            <span style={{ color: 'var(--tape-fg-dim)' }}>{citation.speaker}</span>
          )}
          {citation.speaker && <span>·</span>}
          <span style={{ color: 'var(--tape-fg-dim)' }}>{citation.creator || 'Unknown show'}</span>
          <span>·</span>
          <span className="truncate max-w-[18rem]">{citation.episodeTitle}</span>
          {citation.publishedDate && <span>·</span>}
          {citation.publishedDate && <span>{formatShortDate(citation.publishedDate)}</span>}
          <span>·</span>
          <span style={{ color: 'var(--tape-accent-dim)' }}>[{formatTime(citation.startTime)}]</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCopy}
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center transition-colors"
        style={{ color: copied ? 'var(--tape-accent)' : 'var(--tape-fg-faint)' }}
        aria-label="Copy citation link"
        title="Copy citation link"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};

export default TapeCitationRow;

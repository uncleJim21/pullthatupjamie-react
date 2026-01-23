import React from 'react';

interface PoweredByJamiePillProps {
  sharedSessionId?: string | null;
  className?: string;
}

const PoweredByJamiePill: React.FC<PoweredByJamiePillProps> = ({ sharedSessionId, className }) => {
  const utmValue = `iframe-${encodeURIComponent(sharedSessionId || 'unknown')}`;
  const href = `https://pullthatupjamie.ai?utm=${utmValue}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'inline-flex items-center gap-2',
        'rounded-full border border-white/15 bg-black/80 backdrop-blur-sm',
        // Mobile: smaller padding (logo only), Desktop: full padding
        'p-1.5 sm:px-3 sm:py-1.5',
        'text-[11px] font-medium text-white',
        'hover:bg-black/90 hover:border-white/25',
        'shadow-lg',
        'select-none',
        className || '',
      ].join(' ')}
      aria-label="Powered by Jamie"
      title="Powered by Jamie"
    >
      {/* Mobile: hide text, Desktop: show text */}
      <span className="whitespace-nowrap hidden sm:inline">Powered by Jamie</span>
      <img
        src="/default-source-favicon.png"
        alt="Jamie"
        className="h-5 w-5 sm:h-4 sm:w-4 rounded-sm"
        draggable={false}
      />
    </a>
  );
};

export default PoweredByJamiePill;



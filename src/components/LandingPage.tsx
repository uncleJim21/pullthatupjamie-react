import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageBanner from './PageBanner.tsx';
import { NavigationMode } from '../constants/constants.ts';

interface EntryPoint {
  title: string;
  oneLiner: string;
  body: string[];
  cta: string;
  link: string;
  iconType: 'discover' | 'automate' | 'story';
}

// ============================================================
// ABSTRACT ICONS — Conceptual, thin stroke, monochrome
// ============================================================
const DiscoverIcon: React.FC<{ isHovered: boolean }> = ({ isHovered }) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    style={{
      opacity: isHovered ? 0.9 : 0.5,
      filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' : 'none',
      transition: 'opacity 0.25s ease, filter 0.25s ease',
    }}
  >
    {/* Constellation / branching nodes */}
    <circle cx="24" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="12" cy="28" r="3" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="36" cy="28" r="3" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="20" cy="38" r="2" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="32" cy="40" r="2" stroke="white" strokeWidth="1.5" fill="none" />
    {/* Connecting lines */}
    <line x1="24" y1="15" x2="14" y2="26" stroke="white" strokeWidth="1" opacity="0.6" />
    <line x1="24" y1="15" x2="34" y2="26" stroke="white" strokeWidth="1" opacity="0.6" />
    <line x1="14" y1="30" x2="19" y2="36" stroke="white" strokeWidth="1" opacity="0.6" />
    <line x1="34" y1="30" x2="31" y2="38" stroke="white" strokeWidth="1" opacity="0.6" />
  </svg>
);

const AutomateIcon: React.FC<{ isHovered: boolean }> = ({ isHovered }) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    style={{
      opacity: isHovered ? 0.9 : 0.5,
      filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' : 'none',
      transition: 'opacity 0.25s ease, filter 0.25s ease',
    }}
  >
    {/* Loop / interlinked system */}
    <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="32" cy="16" r="6" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="24" cy="32" r="6" stroke="white" strokeWidth="1.5" fill="none" />
    {/* Connecting arcs */}
    <path d="M22 16 L26 16" stroke="white" strokeWidth="1" opacity="0.6" />
    <path d="M18 21 L21 28" stroke="white" strokeWidth="1" opacity="0.6" />
    <path d="M30 21 L27 28" stroke="white" strokeWidth="1" opacity="0.6" />
    {/* Center dot */}
    <circle cx="24" cy="20" r="1.5" fill="white" opacity="0.4" />
  </svg>
);

const StoryIcon: React.FC<{ isHovered: boolean }> = ({ isHovered }) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    style={{
      opacity: isHovered ? 0.9 : 0.5,
      filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' : 'none',
      transition: 'opacity 0.25s ease, filter 0.25s ease',
    }}
  >
    {/* Path / framed cluster */}
    <rect x="8" y="8" width="32" height="32" rx="4" stroke="white" strokeWidth="1.5" fill="none" opacity="0.4" />
    {/* Inner path/journey */}
    <circle cx="16" cy="16" r="2" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="32" cy="24" r="2" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="20" cy="32" r="2" stroke="white" strokeWidth="1.5" fill="none" />
    {/* Winding path */}
    <path 
      d="M18 16 C24 16, 24 24, 30 24" 
      stroke="white" 
      strokeWidth="1" 
      fill="none" 
      opacity="0.6"
    />
    <path 
      d="M30 26 C26 28, 24 30, 22 32" 
      stroke="white" 
      strokeWidth="1" 
      fill="none" 
      opacity="0.6"
    />
  </svg>
);

// ============================================================
// HERO SEGMENT — Grid One
// A stage with a single artifact. Calm, confident, invitational.
// ============================================================
const HeroSegment: React.FC = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Parallax values based on scroll
  const spotlightY = scrollY * 0.3; // Moves slower than scroll
  const spotlightScale = 1 + (scrollY * 0.0003); // Subtle expansion
  const spotlightOpacity = Math.max(0.03, 0.08 - (scrollY * 0.0001)); // Fades slightly

  return (
    <section
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 40px 80px',
        position: 'relative',
        overflow: 'visible', // Allow stage plane to extend
      }}
    >
      {/* ========================================
          STAGE PLANE — Unmistakable backdrop
          Visible spotlight/vignette behind content
          Parallax: moves slower, expands, fades on scroll
          ======================================== */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          right: '-5%',
          bottom: '-10%',
          background: `
            radial-gradient(ellipse 70% 60% at 40% 50%, 
              rgba(255,255,255,${spotlightOpacity}) 0%, 
              rgba(255,255,255,${spotlightOpacity * 0.5}) 30%,
              rgba(255,255,255,${spotlightOpacity * 0.125}) 60%,
              transparent 80%
            )
          `,
          transform: `translateY(${spotlightY}px) scale(${spotlightScale})`,
          transition: 'transform 0.1s ease-out',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      
      {/* Secondary ambient glow for depth — parallax at different rate */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: '80%',
          height: '60%',
          background: `radial-gradient(ellipse 100% 80% at 50% 50%, rgba(255,255,255,${spotlightOpacity * 0.6}) 0%, transparent 70%)`,
          transform: `translateY(${scrollY * 0.15}px)`,
          transition: 'transform 0.1s ease-out',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Section divider line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '15%',
          right: '15%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent 100%)',
          zIndex: 1,
        }}
      />

      {/* ========================================
          HEADLINE + SUBHEAD — Tightly grouped
          ======================================== */}
      <div style={{ textAlign: 'center', marginBottom: '56px', position: 'relative', zIndex: 2 }}>
        <h1
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '52px',
            color: '#ffffff',
            marginBottom: '8px',
            letterSpacing: '-0.025em',
          }}
        >
          Ideas don't live in lists.
        </h1>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '26px',
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '-0.01em',
          }}
        >
          They live in relationships.
        </p>
      </div>

      {/* ========================================
          MAIN CONTENT — Iframe + Side Copy
          ======================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '56px',
          maxWidth: '1400px',
          width: '100%',
          margin: '0 auto',
          alignItems: 'flex-start',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* ========================================
            ARTIFACT — Jamie iframe as elevated window
            ======================================== */}
        <div
          style={{
            flex: 1.3,
            position: 'relative',
            transform: 'translateY(24px)', // Asymmetric offset
          }}
        >
          {/* Glow behind iframe — visible depth cue */}
          <div
            style={{
              position: 'absolute',
              inset: '-24px',
              background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 60%)',
              borderRadius: '20px',
              pointerEvents: 'none',
            }}
          />
          
          {/* Iframe container — elevated with visible shadow/glow */}
          <div
            style={{
              aspectRatio: '16 / 9',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.12)',
              backgroundColor: '#000000',
              boxShadow: `
                0 4px 24px rgba(0,0,0,0.5),
                0 0 0 1px rgba(255,255,255,0.05),
                0 0 60px rgba(255,255,255,0.04),
                inset 0 1px 0 rgba(255,255,255,0.08)
              `,
              position: 'relative',
            }}
          >
            <iframe
              src={`${window.location.origin}/app?sharedSession=0d1acd2cc1f4&embed=true`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Jamie — Explore Ideas"
              allow="autoplay"
            />
          </div>

          {/* Instructional microcopy — attached to artifact */}
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.45)',
              marginTop: '16px',
              textAlign: 'center',
              letterSpacing: '0.01em',
            }}
          >
            Click any star to explore.
          </p>
        </div>

        {/* ========================================
            SIDE COPY — Secondary presence
            ======================================== */}
        <div
          style={{
            flex: 0.7,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingTop: '32px',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.75,
              color: 'rgba(255,255,255,0.7)',
              marginBottom: '8px',
            }}
          >
            Jamie lets you explore information the way it actually connects.
          </p>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.75,
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '32px',
            }}
          >
            Conversations are just the beginning.
          </p>

          {/* Ghost/outline CTA — secondary, not competing */}
          <button
            onClick={() => navigate('/app')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
              backgroundColor: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              width: 'fit-content',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            }}
          >
            Explore this map
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// ENTRY POINTS SECTION — Section Two
// Three doors the user can step through. Not a feature grid.
// Calm, curious, inviting.
// ============================================================
const EntryPointCard: React.FC<{ entry: EntryPoint }> = ({ entry }) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  // Render the appropriate icon based on type
  const renderIcon = () => {
    switch (entry.iconType) {
      case 'discover':
        return <DiscoverIcon isHovered={isHovered} />;
      case 'automate':
        return <AutomateIcon isHovered={isHovered} />;
      case 'story':
        return <StoryIcon isHovered={isHovered} />;
    }
  };

  return (
    <div
      className="entry-point-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => navigate(entry.link)}
      style={{
        flex: 1,
        minWidth: '280px',
        maxWidth: '380px',
        padding: '40px 32px',
        cursor: 'pointer',
        position: 'relative',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.25s ease',
        boxShadow: isHovered 
          ? '0 8px 32px rgba(255,255,255,0.04)' 
          : 'none',
        borderRadius: '16px',
        background: isHovered 
          ? 'rgba(255,255,255,0.015)' 
          : 'transparent',
        // Subtle border as threshold
        border: isHovered 
          ? '1px solid rgba(255,255,255,0.15)' 
          : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Icon — abstract, conceptual */}
      <div
        style={{
          marginBottom: '20px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {renderIcon()}
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '26px',
          fontWeight: 600,
          color: '#ffffff',
          marginBottom: '12px',
          letterSpacing: '-0.02em',
        }}
      >
        {entry.title}
      </h3>

      {/* One-liner */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '16px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.65)',
          marginBottom: '20px',
          lineHeight: 1.5,
        }}
      >
        {entry.oneLiner}
      </p>

      {/* Body copy */}
      <div style={{ marginBottom: '24px' }}>
        {entry.body.map((line, idx) => (
          <p
            key={idx}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '15px',
              fontWeight: 400,
              color: 'rgba(255,255,255,0.45)',
              lineHeight: 1.7,
              marginBottom: idx < entry.body.length - 1 ? '8px' : '0',
            }}
          >
            {line}
          </p>
        ))}
      </div>

      {/* Text CTA — arrow appears only on hover */}
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: 500,
          color: isHovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'color 0.2s ease',
          letterSpacing: '0.01em',
        }}
      >
        {entry.cta}
        <ArrowRight 
          size={14} 
          style={{
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateX(0)' : 'translateX(-4px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        />
      </span>
    </div>
  );
};

const EntryPointsSection: React.FC = () => {
  const entryPoints: EntryPoint[] = [
    {
      title: 'Discover',
      oneLiner: 'Find the moments that matter — without knowing what to search for.',
      body: [
        'Jamie lets you explore podcasts by meaning, not timestamps.',
        'Jump between ideas, speakers, and themes the way conversations actually unfold.',
      ],
      cta: 'Explore conversations',
      link: '/app',
      iconType: 'discover',
    },
    {
      title: 'Automate',
      oneLiner: 'Turn long conversations into living assets.',
      body: [
        'Jamie helps creators find, clip, share, and reuse their best moments — automatically or on demand.',
        'Less busywork. More signal.',
      ],
      cta: 'See creator tools',
      link: '/for-podcasters',
      iconType: 'automate',
    },
    {
      title: 'Tell Your Story',
      oneLiner: 'Make complex ideas explorable.',
      body: [
        'From books to research to archives, Jamie turns dense material into interactive maps people can actually navigate.',
        'Built for sense-making, not skimming.',
      ],
      cta: 'Explore custom solutions',
      link: '/for-podcasters',
      iconType: 'story',
    },
  ];

  return (
    <section
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '120%',
          height: '100%',
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Section divider line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '15%',
          right: '15%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent 100%)',
          zIndex: 1,
        }}
      />

      {/* CSS for responsive grid */}
      <style>
        {`
          .entry-points-grid {
            display: flex;
            justify-content: center;
            gap: 24px;
            max-width: 1300px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
          }
          @media (max-width: 960px) {
            .entry-points-grid {
              flex-direction: column;
              align-items: center;
              gap: 32px;
            }
            .entry-point-card {
              max-width: 500px !important;
              width: 100%;
            }
          }
        `}
      </style>

      {/* Entry Points Grid */}
      <div className="entry-points-grid">
        {entryPoints.map((entry, i) => (
          <EntryPointCard key={i} entry={entry} />
        ))}
      </div>
    </section>
  );
};

const LandingPage: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: '#050505',
        minHeight: '100vh',
        color: 'white',
        position: 'relative',
      }}
    >
      {/* Full-page gradient overlay for depth */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.02) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255,255,255,0.015) 0%, transparent 50%),
            radial-gradient(ellipse 50% 30% at 0% 50%, rgba(255,255,255,0.01) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Page Banner */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <PageBanner 
          logoText="Pull That Up Jamie!"
          navigationMode={NavigationMode.CLEAN}
        />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Grid One: Hero — Stage + Artifact */}
        <HeroSegment />

        {/* Section Two: Three Entry Points */}
        <EntryPointsSection />
      </div>
    </div>
  );
};

export default LandingPage;

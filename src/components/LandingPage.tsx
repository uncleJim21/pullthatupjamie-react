import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Github, Twitter, Mail } from 'lucide-react';
import PageBanner from './PageBanner.tsx';
import { NavigationMode } from '../constants/constants.ts';

// ============================================================
// STARFIELD CONFIGURATION — Easy to tweak visibility
// ============================================================
const STARFIELD_CONFIG = {
  // Master opacity multiplier (0 = invisible, 1 = full strength)
  masterOpacity: 0.8,
  
  // Individual layer settings
  layers: {
    far: {
      opacity: 0.35,      // Faintest layer
      speed: 120,         // Seconds per cycle (slowest)
      dotSize: 1,         // px
    },
    mid: {
      opacity: 0.5,       // Medium brightness
      speed: 80,          // Seconds per cycle
      dotSize: 1.5,       // px
    },
    near: {
      opacity: 0.7,       // Brightest layer
      speed: 50,          // Seconds per cycle (fastest)
      dotSize: 2,         // px
    },
  },
};

// ============================================================
// STARFIELD BACKGROUND COMPONENT
// ============================================================
const StarfieldBackground: React.FC = () => {
  const { masterOpacity, layers } = STARFIELD_CONFIG;

  // Generate star positions for a tile (deterministic pattern)
  const generateStarPattern = (count: number, tileSize: number, dotSize: number) => {
    const stars: string[] = [];
    // Use a seeded approach for consistent positions
    const positions = [
      [0.05, 0.08], [0.15, 0.25], [0.28, 0.12], [0.42, 0.35], [0.55, 0.18],
      [0.68, 0.42], [0.82, 0.28], [0.92, 0.55], [0.35, 0.65], [0.48, 0.78],
      [0.12, 0.88], [0.72, 0.72], [0.88, 0.15], [0.22, 0.45], [0.62, 0.92],
      [0.08, 0.52], [0.95, 0.82], [0.38, 0.02], [0.75, 0.58], [0.18, 0.72],
    ];
    
    for (let i = 0; i < Math.min(count, positions.length); i++) {
      const x = positions[i][0] * tileSize;
      const y = positions[i][1] * tileSize;
      stars.push(`radial-gradient(${dotSize}px ${dotSize}px at ${x}px ${y}px, white, transparent)`);
    }
    return stars.join(', ');
  };

  return (
    <>
      <style>
        {`
          @keyframes starfield-drift-far {
            from { background-position: 0 0; }
            to { background-position: 500px 300px; }
          }
          @keyframes starfield-drift-mid {
            from { background-position: 0 0; }
            to { background-position: -400px 250px; }
          }
          @keyframes starfield-drift-near {
            from { background-position: 0 0; }
            to { background-position: 300px -200px; }
          }
        `}
      </style>
      
      {/* Far layer - smallest, faintest, slowest */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          opacity: layers.far.opacity * masterOpacity,
          backgroundImage: generateStarPattern(20, 500, layers.far.dotSize),
          backgroundSize: '500px 500px',
          backgroundRepeat: 'repeat',
          animation: `starfield-drift-far ${layers.far.speed}s linear infinite`,
        }}
      />
      
      {/* Mid layer - medium size, medium brightness, medium speed */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          opacity: layers.mid.opacity * masterOpacity,
          backgroundImage: generateStarPattern(15, 400, layers.mid.dotSize),
          backgroundSize: '400px 400px',
          backgroundRepeat: 'repeat',
          animation: `starfield-drift-mid ${layers.mid.speed}s linear infinite`,
        }}
      />
      
      {/* Near layer - largest, brightest, fastest */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          opacity: layers.near.opacity * masterOpacity,
          backgroundImage: generateStarPattern(10, 300, layers.near.dotSize),
          backgroundSize: '300px 300px',
          backgroundRepeat: 'repeat',
          animation: `starfield-drift-near ${layers.near.speed}s linear infinite`,
        }}
      />
    </>
  );
};

interface EntryPoint {
  title: string;
  oneLiner: string;
  body: string[];
  cta: string;
  link: string;
  iconType: 'discover' | 'automate' | 'story';
}

// ============================================================
// ABSTRACT ICONS — Conceptual, thin stroke, with accent glow
// Size increased 15-20% for better visual anchoring
// ============================================================
const accentColor = 'rgba(200, 180, 140, 1)'; // Warm amber accent
const accentGlow = 'rgba(200, 180, 140, 0.4)';

const DiscoverIcon: React.FC<{ isHovered: boolean }> = ({ isHovered }) => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 48 48"
    fill="none"
    style={{
      opacity: isHovered ? 1 : 0.6,
      filter: isHovered ? `drop-shadow(0 0 12px ${accentGlow})` : 'none',
      transition: 'opacity 0.2s ease, filter 0.2s ease',
    }}
  >
    {/* Constellation / branching nodes */}
    <circle cx="24" cy="12" r="3" stroke={isHovered ? accentColor : 'white'} strokeWidth="1.5" fill="none" style={{ transition: 'stroke 0.2s ease' }} />
    <circle cx="12" cy="28" r="3" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="36" cy="28" r="3" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="20" cy="38" r="2" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="32" cy="40" r="2" stroke="white" strokeWidth="1.5" fill="none" />
    {/* Connecting lines */}
    <line x1="24" y1="15" x2="14" y2="26" stroke="white" strokeWidth="1" opacity="0.5" />
    <line x1="24" y1="15" x2="34" y2="26" stroke="white" strokeWidth="1" opacity="0.5" />
    <line x1="14" y1="30" x2="19" y2="36" stroke="white" strokeWidth="1" opacity="0.5" />
    <line x1="34" y1="30" x2="31" y2="38" stroke="white" strokeWidth="1" opacity="0.5" />
  </svg>
);

const AutomateIcon: React.FC<{ isHovered: boolean }> = ({ isHovered }) => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 48 48"
    fill="none"
    style={{
      opacity: isHovered ? 1 : 0.6,
      filter: isHovered ? `drop-shadow(0 0 12px ${accentGlow})` : 'none',
      transition: 'opacity 0.25s ease, filter 0.25s ease',
    }}
  >
    {/* Loop / interlinked system */}
    <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="32" cy="16" r="6" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="24" cy="32" r="6" stroke={isHovered ? accentColor : 'white'} strokeWidth="1.5" fill="none" style={{ transition: 'stroke 0.25s ease' }} />
    {/* Connecting arcs */}
    <path d="M22 16 L26 16" stroke="white" strokeWidth="1" opacity="0.5" />
    <path d="M18 21 L21 28" stroke="white" strokeWidth="1" opacity="0.5" />
    <path d="M30 21 L27 28" stroke="white" strokeWidth="1" opacity="0.5" />
    {/* Center dot */}
    <circle cx="24" cy="20" r="1.5" fill="white" opacity="0.4" />
  </svg>
);

const StoryIcon: React.FC<{ isHovered: boolean }> = ({ isHovered }) => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 48 48"
    fill="none"
    style={{
      opacity: isHovered ? 1 : 0.6,
      filter: isHovered ? `drop-shadow(0 0 12px ${accentGlow})` : 'none',
      transition: 'opacity 0.25s ease, filter 0.25s ease',
    }}
  >
    {/* Path / framed cluster */}
    <rect x="8" y="8" width="32" height="32" rx="4" stroke={isHovered ? accentColor : 'white'} strokeWidth="1.5" fill="none" opacity="0.35" style={{ transition: 'stroke 0.25s ease' }} />
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
      opacity="0.5"
    />
    <path 
      d="M30 26 C26 28, 24 30, 22 32" 
      stroke="white" 
      strokeWidth="1" 
      fill="none" 
      opacity="0.5"
    />
  </svg>
);

// ============================================================
// HERO SEGMENT — Grid One
// Layout: Iframe left, Copy right (headline, subhead, body, CTA)
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
  const spotlightY = scrollY * 0.3;
  const spotlightScale = 1 + (scrollY * 0.0003);
  const spotlightOpacity = Math.max(0.03, 0.08 - (scrollY * 0.0001));

  return (
    <section
      className="hero-section"
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {/* Stage plane — subtle backdrop with parallax */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          right: '-5%',
          bottom: '-10%',
          background: `
            radial-gradient(ellipse 70% 60% at 35% 50%, 
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

      {/* Responsive CSS */}
      <style>
        {`
          .hero-section {
            padding: 80px 60px;
          }
          .hero-content {
            display: flex;
            flex-direction: row;
            gap: 80px;
            max-width: 1300px;
            width: 100%;
            margin: 0 auto;
            align-items: center;
            position: relative;
            z-index: 2;
          }
          .hero-artifact {
            flex: 0 0 auto;
            width: 500px;
            position: relative;
          }
          .hero-copy {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .hero-headline {
            font-size: 64px;
          }
          .hero-subhead {
            font-size: 28px;
          }
          .hero-body {
            font-size: 17px;
          }
          @media (max-width: 1000px) {
            .hero-section {
              padding: 60px 28px;
            }
            .hero-content {
              flex-direction: column;
              gap: 36px;
              align-items: center;
              text-align: center;
            }
            .hero-artifact {
              width: 100%;
              max-width: 360px;
              order: 2;
            }
            .hero-copy {
              align-items: center;
              order: 1;
            }
            .hero-headline {
              font-size: 36px !important;
            }
            .hero-subhead {
              font-size: 20px !important;
              margin-bottom: 20px !important;
            }
            .hero-body {
              font-size: 15px !important;
              margin-bottom: 28px !important;
            }
            .hero-cta {
              margin-left: auto;
              margin-right: auto;
              align-self: center !important;
            }
          }
        `}
      </style>

      {/* Main content — Iframe + Copy side by side */}
      <div className="hero-content">
        {/* ARTIFACT — Square iframe */}
        <div className="hero-artifact">
          {/* Glow behind iframe */}
          <div
            style={{
              position: 'absolute',
              inset: '-24px',
              background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 60%)',
              borderRadius: '20px',
              pointerEvents: 'none',
            }}
          />
          
          {/* Iframe container — square */}
          <div
            style={{
              aspectRatio: '1 / 1',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: '#000000',
              boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
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

          {/* Instructional microcopy */}
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '16px',
              textAlign: 'center',
              letterSpacing: '0.01em',
            }}
          >
            Click any star to explore.
          </p>
        </div>

        {/* COPY — Headline, subhead, body, CTA stacked */}
        <div className="hero-copy">
          {/* Headline — Large and bold */}
          <h1
            className="hero-headline"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              lineHeight: 1.05,
              color: '#ffffff',
              marginBottom: '24px',
              letterSpacing: '-0.03em',
            }}
          >
            Stop prompting. Start exploring.
          </h1>

          {/* Subhead */}
          <p
            className="hero-subhead"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              marginBottom: '32px',
              letterSpacing: '-0.01em',
            }}
          >
            Jamie turns raw data into a space you can navigate.
          </p>

          {/* Body copy */}
          <p
            className="hero-body"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.55)',
              marginBottom: '40px',
              maxWidth: '440px',
            }}
          >
            Make sense of the data deluge with one of a kind visualizations & insights.
            Conversations are just the beginning.
          </p>

          {/* CTA — White filled button, right-aligned */}
          <button
            className="hero-cta"
            onClick={() => navigate('/app')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              fontSize: '16px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              backgroundColor: '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              width: 'fit-content',
              letterSpacing: '-0.01em',
              alignSelf: 'flex-end',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Explore Podcast App
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};

// ============================================================
// ENTRY POINTS SECTION — Section Two
// Three doors the user can step through. Not a feature grid.
// Each card is an entry point — inviting, confident, explorable.
// ============================================================

// Accent colors for CTAs and hover states
const ctaAccent = 'rgba(200, 180, 140, 1)'; // Warm amber
const ctaAccentMuted = 'rgba(200, 180, 140, 0.7)';
const ctaAccentBright = 'rgba(220, 200, 160, 1)';

const EntryPointCard: React.FC<{ entry: EntryPoint; isPrimary?: boolean }> = ({ entry, isPrimary = false }) => {
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

  // Micro-asymmetry: Discover card has faster/stronger response
  const transitionSpeed = isPrimary ? '0.2s' : '0.3s';
  const hoverLift = isPrimary ? '-5px' : '-4px';
  const restLift = isPrimary ? '-1px' : '0';

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
        transform: isHovered ? `translateY(${hoverLift})` : `translateY(${restLift})`,
        transition: `all ${transitionSpeed} ease`,
        boxShadow: isHovered 
          ? `0 16px 48px rgba(0,0,0,0.35), inset 0 0 40px rgba(200,180,140,0.03)` 
          : isPrimary ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        borderRadius: '16px',
        background: isHovered 
          ? 'rgba(255,255,255,0.025)' 
          : 'transparent',
        // Border as doorway threshold — hint of accent on hover
        border: isHovered 
          ? '1px solid rgba(200,180,140,0.25)' 
          : `1px solid rgba(255,255,255,${isPrimary ? '0.12' : '0.10'})`,
      }}
    >
      {/* Icon — centered, larger, anchors the card */}
      <div
        style={{
          marginBottom: '24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderIcon()}
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '24px',
          fontWeight: 600,
          color: '#ffffff',
          marginBottom: '12px',
          letterSpacing: '-0.02em',
          textAlign: 'center',
        }}
      >
        {entry.title}
      </h3>

      {/* One-liner */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '15px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '16px',
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        {entry.oneLiner}
      </p>

      {/* Body copy */}
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        {entry.body.map((line, idx) => (
          <p
            key={idx}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: 400,
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.7,
              marginBottom: idx < entry.body.length - 1 ? '6px' : '0',
            }}
          >
            {line}
          </p>
        ))}
      </div>

      {/* CTA — accent color, arrow on hover only */}
      <div style={{ textAlign: 'center' }}>
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            color: isHovered ? ctaAccentBright : ctaAccentMuted,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: `color ${transitionSpeed} ease`,
            letterSpacing: '0.01em',
          }}
        >
          {entry.cta}
          <ArrowRight 
            size={14} 
            style={{
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? 'translateX(2px)' : 'translateX(-4px)',
              transition: `opacity ${transitionSpeed} ease, transform ${transitionSpeed} ease`,
              color: ctaAccentBright,
            }}
          />
        </span>
      </div>
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
    // {
    //   title: 'Tell Your Story',
    //   oneLiner: 'Make complex ideas explorable.',
    //   body: [
    //     'From books to research to archives, Jamie turns dense material into interactive maps people can actually navigate.',
    //     'Built for sense-making, not skimming.',
    //   ],
    //   cta: 'Explore custom solutions',
    //   link: '/for-podcasters',
    //   iconType: 'story',
    // },
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
          <EntryPointCard key={i} entry={entry} isPrimary={i === 0} />
        ))}
      </div>
    </section>
  );
};

// ============================================================
// WHY JAMIE EXISTS — Section Three
// Story-driven section with illustration
// ============================================================
const WhyJamieExistsSection: React.FC = () => {
  return (
    <section
      className="why-jamie-section"
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        padding: '100px 60px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Responsive CSS */}
      <style>
        {`
          .why-jamie-content {
            display: flex;
            flex-direction: row;
            gap: 60px;
            max-width: 1300px;
            width: 100%;
            margin: 0 auto;
            align-items: center;
            position: relative;
            z-index: 2;
          }
          .why-jamie-text {
            flex: 1;
          }
          .why-jamie-image {
            flex: 0 0 380px;
            position: relative;
          }
          @media (max-width: 1100px) {
            .why-jamie-content {
              flex-direction: column;
              gap: 48px;
              text-align: center;
            }
            .why-jamie-text {
              max-width: 100%;
              order: 1;
            }
            .why-jamie-image {
              flex: 0 0 auto;
              width: 100%;
              max-width: 360px;
              order: 2;
            }
          }
          @media (max-width: 600px) {
            .why-jamie-section {
              padding: 60px 28px !important;
            }
            .why-jamie-title {
              font-size: 32px !important;
            }
          }
        `}
      </style>

      {/* Content */}
      <div className="why-jamie-content">
        {/* Text column */}
        <div className="why-jamie-text">
          <h2
            className="why-jamie-title"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '42px',
              color: '#ffffff',
              marginBottom: '32px',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            Why Jamie Exists
          </h2>

          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '19px',
              lineHeight: 1.8,
              color: 'rgba(255,255,255,0.85)',
              marginBottom: '20px',
            }}
          >
            We don't have an information problem.
            <br />
            We have a sense-making problem.
          </p>

          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '17px',
              lineHeight: 1.8,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '20px',
            }}
          >
            AI has flooded the world with answers, many of them wrong, shallow, or disconnected from reality. Prompting has replaced understanding. Context gets flattened. Meaning gets lost.
          </p>

          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '17px',
              lineHeight: 1.8,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '20px',
            }}
          >
            Meanwhile, the most valuable ideas still live in real sources: authentic conversations, podcasts, internal knowledge, research, and long-form thinking.
          </p>

          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '17px',
              lineHeight: 1.8,
              color: 'rgba(255,255,255,0.75)',
              marginBottom: '20px',
              fontWeight: 500,
            }}
          >
            The problem is the tools.
          </p>

          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '17px',
              lineHeight: 1.8,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '20px',
            }}
          >
            Jamie was built to turn real information into something you can navigate, not just query. It takes genuine data, from podcasts to process documentation to archives, and makes it intelligible, explorable, and connected.
          </p>

          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '18px',
              lineHeight: 1.8,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            So humans can actually think again. Debate ideas. Grow. Learn. And become everything they were meant to be.
          </p>
        </div>

        {/* Image column */}
        <div className="why-jamie-image">
          <img
            src="/why-jamie-hero.png"
            alt="Scientist exploring a constellation of connected ideas"
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '12px',
              filter: 'grayscale(100%)',
              opacity: 0.9,
            }}
          />
        </div>
      </div>
    </section>
  );
};

// ============================================================
// FOOTER — Links, contact, legal
// ============================================================
const Footer: React.FC = () => {
  const [emailRevealed, setEmailRevealed] = useState(false);

  return (
    <footer
      style={{
        marginTop: '120px',
        padding: '60px 40px 40px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <div
        style={{
          maxWidth: '1300px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >
        {/* Main footer content */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '48px',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <div style={{ minWidth: '200px' }}>
            <h4
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '18px',
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: '16px',
              }}
            >
              Pull That Up Jamie
            </h4>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.5)',
                lineHeight: 1.6,
                maxWidth: '280px',
              }}
            >
              Turning information into something you can navigate.
            </p>
          </div>

          {/* Connect */}
          <div style={{ minWidth: '160px' }}>
            <h5
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Connect
            </h5>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '12px' }}>
                <a
                  href="https://github.com/uncleJim21/pullthatupjamie-react"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                >
                  <Github size={16} />
                  GitHub
                </a>
              </li>
              <li style={{ marginBottom: '12px' }}>
                <a
                  href="https://x.com/PullThatUpJ_AI"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                >
                  <Twitter size={16} />
                  X / Twitter
                </a>
              </li>
              <li>
                {emailRevealed ? (
                  <a
                    href="mailto:jim@cascdr.xyz"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      color: 'rgba(200,180,140,0.8)',
                      textDecoration: 'none',
                      transition: 'color 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(200,180,140,1)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(200,180,140,0.8)'}
                  >
                    <Mail size={16} />
                    jim@cascdr.xyz
                  </a>
                ) : (
                  <button
                    onClick={() => setEmailRevealed(true)}
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.55)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                  >
                    <Mail size={16} />
                    Email (click to reveal)
                  </button>
                )}
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div style={{ minWidth: '160px' }}>
            <h5
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Legal
            </h5>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '12px' }}>
                <a
                  href="/privacy"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            paddingTop: '24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            © {new Date().getFullYear()} Pull That Up Jamie. Open source under GPL-3.0.
          </p>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Built for sense-making.
          </p>
        </div>
      </div>
    </footer>
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
        overflowX: 'hidden',
      }}
    >
      {/* Starfield background - z-index: -1, behind everything */}
      <StarfieldBackground />

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
          zIndex: 2,
        }}
      />

      {/* Page Banner */}
      <div style={{ position: 'relative', zIndex: 20 }}>
        <PageBanner 
          logoText="Pull That Up Jamie!"
          navigationMode={NavigationMode.CLEAN}
        />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* Grid One: Hero — Stage + Artifact */}
        <HeroSegment />

        {/* Section Two: Three Entry Points */}
        <EntryPointsSection />

        {/* Section Three: Why Jamie Exists */}
        <WhyJamieExistsSection />

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;

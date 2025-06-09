import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import Button from './Button.tsx';
import SymbolTile from './SymbolTile.tsx';
import { SearchIcon, ShareIcon, ClipIcon } from './Icons.tsx';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  
  // Mobile styles using CSS-in-JS with media queries
  const mobileStyles = `
    @keyframes tronBreathing {
      0% {
        filter: brightness(0.7) contrast(1);
      }
      50% {
        filter: brightness(1.15) contrast(1.1);
      }
      100% {
        filter: brightness(0.7) contrast(1);
      }
    }

    @keyframes tronBreathingMobile {
      0% {
        filter: brightness(0.65) contrast(1);
      }
      50% {
        filter: brightness(1.25) contrast(1.15);
      }
      100% {
        filter: brightness(0.65) contrast(1);
      }
    }

    .tron-background-desktop {
      animation: tronBreathing 8s ease-in-out infinite;
    }

    @media (max-width: 768px) {
      .tron-background-mobile {
        background-size: cover !important;
        background-position: center center !important;
        opacity: 0.6 !important;
        background-attachment: fixed !important;
        animation: tronBreathingMobile 8s ease-in-out infinite !important;
      }
      
      .hero-title-mobile {
        font-size: 32px !important;
        line-height: 1.2 !important;
        margin-bottom: 16px !important;
      }
      .hero-text-mobile {
        font-size: 16px !important;
        padding: 0 10px !important;
      }
      .hero-section-mobile {
        padding: 32px 15px 40px !important;
      }
      .button-container-mobile {
        flex-direction: column !important;
        align-items: center !important;
        gap: 12px !important;
        margin-bottom: 28px !important;
      }
      .image-placeholder-mobile {
        height: 180px !important;
        margin: 0 auto 20px !important;
        font-size: 14px !important;
      }
      .features-section-mobile {
        padding: 0 15px 40px !important;
      }
      .features-container-mobile {
        gap: 24px !important;
      }
      .bottom-cta-section-mobile {
        padding: 40px 15px 60px !important;
      }
      .bottom-cta-title-mobile {
        font-size: 28px !important;
        margin-bottom: 16px !important;
      }
      .bottom-cta-text-mobile {
        font-size: 16px !important;
        padding: 0 10px !important;
        margin-bottom: 32px !important;
      }
      .bottom-cta-buttons-mobile {
        flex-direction: column !important;
        align-items: center !important;
        gap: 12px !important;
      }
    }
  `;
  
  return (
    <>
      <style>{mobileStyles}</style>
      <div style={{ 
        backgroundColor: 'black', 
        minHeight: '100vh', 
        color: 'white',
        position: 'relative'
      }}>
        {/* Tron background image overlay */}
        <div 
          className="tron-background-mobile tron-background-desktop"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'url("./tron-background.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.4,
            zIndex: 1,
            pointerEvents: 'none'
          }} 
        />
        
        <div style={{ position: 'relative', zIndex: 2 }}>
          <PageBanner />
          
          <main>
            {/* Hero Section */}
            <section 
              className="hero-section-mobile"
              style={{ textAlign: 'center', padding: '64px 20px 60px' }}
            >
              <h1 
                className="hero-title-mobile"
                style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '24px' }}
              >
                Your Podcast is a Gold Mine.
              </h1>
              <p 
                className="hero-text-mobile"
                style={{ fontSize: '18px', maxWidth: '800px', margin: '0 auto 40px', lineHeight: '1.6' }}
              >
                Find & Capitalize on Top Moments with lightning fast 
                <br />search & AI tools - courtesy of your own personal Young Jamie.
              </p>
              
              <div 
                className="button-container-mobile"
                style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '42px' }}
              >
                <Button to="/try-jamie" variant="primary">
                  Try on Your Pod for Free
                </Button>
                <Button to="/app" variant="secondary">
                  Explore Free Tools
                </Button>
              </div>
              
              {/* Demo Image */}
              <img 
                src="/ptuj-demo-image.png"
                alt="Pull That Up Jamie Demo"
                className="image-placeholder-mobile rounded-md border border-gray-700 object-cover flex-shrink-0"
                style={{ 
                  height: '500px', 
                  maxWidth: '800px', 
                  margin: '0 auto 40px',
                  width: '100%'
                }}
              />
            </section>
            
            {/* Features Section */}
            <section 
              className="features-section-mobile"
              style={{ padding: '0 20px 80px' }}
            >
              <div 
                className="features-container-mobile"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: '40px',
                  maxWidth: '1200px',
                  margin: '0 auto'
                }}
              >
                <SymbolTile 
                  icon={<SearchIcon />}
                  title="Search"
                  description={[
                    "Instant semantic search", 
                    "Full-text transcripts", 
                    "Find moments by topic"
                  ]}
                />
                <SymbolTile 
                  icon={<ShareIcon />}
                  title="Share"
                  description={[
                    "One-click link sharing", 
                    "Embed in social media", 
                    "Boost engagement"
                  ]}
                />
                <SymbolTile 
                  icon={<ClipIcon />}
                  title="Clip"
                  description={[
                    "Create perfect snippets", 
                    "Precise timestamp editing", 
                    "Publish anywhere"
                  ]}
                />
              </div>
            </section>

            {/* Bottom CTA Section */}
            <section 
              className="bottom-cta-section-mobile"
              style={{ 
                textAlign: 'center', 
                padding: '60px 20px 80px',
                borderTop: '1px solid #333'
              }}
            >
              <h2 
                className="bottom-cta-title-mobile"
                style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '20px' }}
              >
                Ready to get started?
              </h2>
              <p 
                className="bottom-cta-text-mobile"
                style={{ 
                  fontSize: '18px', 
                  maxWidth: '600px', 
                  margin: '0 auto 40px', 
                  lineHeight: '1.6',
                  color: '#9CA3AF'
                }}
              >
                Transform your podcast into a searchable, shareable goldmine.
                <br />Try for free right now!
              </p>
              
              <div 
                className="bottom-cta-buttons-mobile"
                style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}
              >
                <Button to="/app" variant="secondary">
                  Explore Free Tools
                </Button>
                <Button to="/try-jamie" variant="primary">
                  Try on Your Pod for Free
                </Button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
};

export default HomePage; 
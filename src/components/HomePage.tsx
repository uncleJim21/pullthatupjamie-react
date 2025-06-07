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
    @media (max-width: 768px) {
      .tron-background-mobile {
        background-size: cover !important;
        background-position: center center !important;
        opacity: 0.6 !important;
        background-attachment: fixed !important;
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
        padding: 40px 15px 40px !important;
      }
      .button-container-mobile {
        flex-direction: column !important;
        align-items: center !important;
        gap: 12px !important;
        margin-bottom: 40px !important;
      }
      .image-placeholder-mobile {
        height: 180px !important;
        margin: 0 auto 40px !important;
        font-size: 14px !important;
      }
      .features-section-mobile {
        padding: 0 15px 40px !important;
      }
      .features-container-mobile {
        gap: 24px !important;
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
          className="tron-background-mobile"
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
            opacity: 0.5,
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
              style={{ textAlign: 'center', padding: '80px 20px 60px' }}
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
                <br />search & tools - courtesy of your own personal Jamie.
              </p>
              
              <div 
                className="button-container-mobile"
                style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '60px' }}
              >
                <Button to="/try-jamie" variant="primary">
                  Try on Your Pod for Free
                </Button>
                <Button to="/app" variant="secondary">
                  Explore Free Tools
                </Button>
              </div>
              
              {/* Image Placeholder */}
              <div 
                className="image-placeholder-mobile"
                style={{ 
                  backgroundColor: '#ddd', 
                  height: '250px', 
                  maxWidth: '800px', 
                  margin: '0 auto 80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#555',
                  fontSize: '16px'
                }}
              >
                [Screenshots of app/collage of them to capture the imagination]
              </div>
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
          </main>
        </div>
      </div>
    </>
  );
};

export default HomePage; 
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import Button from './Button.tsx';
import SymbolTile from './SymbolTile.tsx';
import { SearchIcon, ShareIcon, ClipIcon } from './Icons.tsx';
import TutorialModal from './TutorialModal.tsx';
import CheckoutModal from './CheckoutModal.tsx';
import BrandsCarousel from './BrandsCarousel.tsx';

interface SubscriptionSuccessPopupProps {
  onClose: () => void;
  isJamiePro?: boolean;
}

const SubscriptionSuccessPopup = ({ onClose, isJamiePro = false }: SubscriptionSuccessPopupProps) => (
  <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex items-center justify-center z-50">
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 text-center max-w-lg mx-auto">
      <h2 className="text-white text-lg font-bold mb-4">
        {isJamiePro ? 'Welcome to Jamie Pro!' : 'Your subscription was successful!'}
      </h2>
      <p className="text-gray-400 mb-4">
        {isJamiePro ? (
          'A team member will be in contact with you within 1 business day to complete your onboarding. \nIn the meantime enjoy additional on demand episode runs.'
        ) : (
          <>
            Enjoy unlimited access to Jamie and other{' '}
            <a
              href="https://cascdr.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              CASCDR apps
            </a>
            .
          </>
        )}
      </p>
      <button
        onClick={onClose}
        className="mt-4 px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
      >
        Close
      </button>
    </div>
  </div>
);

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isUpgradeSuccessPopUpOpen, setIsUpgradeSuccessPopUpOpen] = useState(false);

  const handleTutorialClick = () => {
    setIsTutorialOpen(true);
  };

  const handleTutorialClose = () => {
    setIsTutorialOpen(false);
  };

  const handleUpgrade = () => {
    setIsCheckoutModalOpen(true);
  };

  const handleUpgradeSuccess = () => {
    setIsCheckoutModalOpen(false);
    setIsUpgradeSuccessPopUpOpen(true);
  };
  
  // Mobile styles using CSS-in-JS with media queries
  const mobileStyles = `
    @keyframes tronPan {
      0% {
        background-position: 0px top;
      }
      100% {
        background-position: -100vw top;
      }
    }

    @keyframes tronPanMobile {
      0% {
        background-position: 0px top;
      }
      100% {
        background-position: -100vw top;
      }
    }

    .tron-background-desktop {
      background-repeat: repeat-x !important;
      background-size: 100vw 120vh !important;
      animation: tronPan 15s linear infinite;
    }

    @media (max-width: 768px) {
      .tron-background-mobile {
        background-repeat: repeat-x !important;
        background-size: 100vw 130vh !important;
        background-position: 0px top !important;
        opacity: 0.6 !important;
        background-attachment: fixed !important;
        animation: tronPanMobile 12s linear infinite !important;
      }
      
      .hero-title-mobile {
        font-size: 25.6px !important;
        line-height: 1.2 !important;
        margin-bottom: 16px !important;
      }
      .hero-text-mobile {
        font-size: 12.8px !important;
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
        font-size: 11.2px !important;
      }
      .demo-image-container-mobile {
        height: 180px !important;
        margin: 0 auto 10px !important;
        padding: 0 15px !important;
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
        font-size: 22.4px !important;
        margin-bottom: 16px !important;
      }
      .bottom-cta-text-mobile {
        font-size: 12.8px !important;
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
            backgroundImage: 'url("./tron-background2.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.4,
            zIndex: 1,
            pointerEvents: 'none'
          }} 
        />
        
        <div style={{ position: 'relative', zIndex: 2 }}>
          <PageBanner onTutorialClick={handleTutorialClick} onUpgrade={handleUpgrade} />
          
          {/* Tutorial Modal */}
          <TutorialModal
            isOpen={isTutorialOpen}
            onClose={handleTutorialClose}
            defaultSection={0} // Start with Podcast Search section
          />

          {/* Checkout Modal */}
          <CheckoutModal 
            isOpen={isCheckoutModalOpen} 
            onClose={() => setIsCheckoutModalOpen(false)} 
            onSuccess={handleUpgradeSuccess}
          />
          
          <main>
            {/* Hero Section */}
            <section 
              className="hero-section-mobile"
              style={{ textAlign: 'center', padding: '24px 20px 60px' }}
            >
              <h1 
                className="hero-title-mobile"
                style={{ fontSize: '38.4px', fontWeight: 'bold', marginBottom: '14px' }}
              >
                Your Podcast is a Gold Mine.
              </h1>
              <p 
                className="hero-text-mobile"
                style={{ fontSize: '14.4px', maxWidth: '800px', margin: '0 auto 24px', lineHeight: '1.6' }}
              >
                Find & Capitalize on Top Moments with lightning fast 
                <br />search, clip, & AI tools - courtesy of your own personal Young Jamie.
              </p>
              
              <div 
                className="button-container-mobile"
                style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '28px' }}
              >
                <Button to="/try-jamie" variant="primary">
                  Try on Your Pod for Free
                </Button>
                <Button to="/app" variant="secondary">
                  Explore Free Tools
                </Button>
              </div>
              
              {/* Demo Image - Cropped */}
              <div
                className="demo-image-container-mobile"
                style={{
                  height: '300px',
                  maxWidth: '800px',
                  margin: '0 auto 2px',
                  width: '100%',
                  overflow: 'hidden',
                  borderRadius: '6px',
                  border: '1px solid rgb(55, 65, 81)',
                  display: 'block',
                }}
              >
                <img 
                  src="https://cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com/jamie-pro/550168/uploads/1764006585642-ptuj-demo-image.png"
                  alt="Pull That Up Jamie Demo"
                  style={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center top',
                    display: 'block',
                  }}
                />
              </div>
              
              {/* Brands Carousel */}
              <BrandsCarousel />
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
                style={{ fontSize: '28.8px', fontWeight: 'bold', marginBottom: '20px' }}
              >
                Ready to get started?
              </h2>
              <p 
                className="bottom-cta-text-mobile"
                style={{ 
                  fontSize: '14.4px', 
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
             {isUpgradeSuccessPopUpOpen && (
         <SubscriptionSuccessPopup onClose={() => {
           setIsUpgradeSuccessPopUpOpen(false);
           setIsCheckoutModalOpen(false);
         }} />
       )}
    </>
  );
};

export default HomePage; 
import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner.tsx';
import Button from './Button.tsx';
import SymbolTile from './SymbolTile.tsx';
import { SearchIcon, ShareIcon, ClipIcon } from './Icons.tsx';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div style={{ backgroundColor: 'black', minHeight: '100vh', color: 'white' }}>
      <PageBanner />
      
      <main>
        {/* Hero Section */}
        <section style={{ textAlign: 'center', padding: '80px 20px 60px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '24px' }}>
            Your Podcast is a Gold Mine.
          </h1>
          <p style={{ fontSize: '18px', maxWidth: '800px', margin: '0 auto 40px', lineHeight: '1.6' }}>
            Find & Capitalize on Top Moments with lightning fast 
            <br />search & tools - courtesy of your own personal Jamie.
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '60px' }}>
            <Button to="/try-jamie" variant="primary">
              Try on Your Pod for Free
            </Button>
            <Button to="/app" variant="secondary">
              Explore Free Tools
            </Button>
          </div>
          
          {/* Image Placeholder */}
          <div style={{ 
            backgroundColor: '#ddd', 
            height: '250px', 
            maxWidth: '800px', 
            margin: '0 auto 80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
            fontSize: '16px'
          }}>
            [Screenshots of app/collage of them to capture the imagination]
          </div>
        </section>
        
        {/* Features Section */}
        <section style={{ padding: '0 20px 80px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '40px',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
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
  );
};

export default HomePage; 
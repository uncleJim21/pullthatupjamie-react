import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import './index.css';
import SearchInterface from './components/SearchInterface.tsx';
import PodcastFeedPage from './components/podcast/PodcastFeedPage.tsx';
import DashboardPage from './components/podcast/DashboardPage.tsx';
import HomePage from './components/HomePage.tsx';
import TryJamieWizard from './components/TryJamieWizard.tsx';
import TwitterTest from './pages/TwitterTest.tsx';
import { DEBUG_MODE } from './constants/constants.ts';
import { inject } from "@vercel/analytics"

// Add clipboard monitor
if (typeof window !== 'undefined' && window.navigator) {
  // Monitor clipboard operations
  const originalClipboardWriteText = navigator.clipboard.writeText;
  navigator.clipboard.writeText = async function(text) {
    // DEV MODE OVERRIDE: Force localhost URLs when copying to clipboard in dev
    let finalText = text;
    if (process.env.NODE_ENV === 'development') {
      // Replace domain with localhost if needed
      if (text.includes('pullthatupjamie.ai')) {
        finalText = text.replace(/^https?:\/\/[^\/]+/, 'http://localhost:3000');
      }
      
      // Fix missing /app prefix if needed
      if (finalText.includes('/share?') && !finalText.includes('/app/share?')) {
        finalText = finalText.replace('/share?', '/app/share?');
      }
      
      if (finalText.includes('/feed/') && !finalText.includes('/app/feed/')) {
        finalText = finalText.replace('/feed/', '/app/feed/');
      }
    }
    
    return originalClipboardWriteText.call(this, finalText);
  };
}

// Component to handle old URL redirects
const OldFeedRedirect = () => {
  const { feedId } = useParams();
  return <Navigate to={`/app/feed/${feedId}`} replace />;
};

// Component to handle old clipBatch URL redirects
const OldClipBatchRedirect = () => {
  const { feedId, runId } = useParams();
  return <Navigate to={`/app/feed/${feedId}/clipBatch/${runId}`} replace />;
};

// 404 Component that redirects to home after a brief delay
const NotFound = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ 
      background: 'black', 
      color: 'white', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>404</h1>
      <p style={{ fontSize: '18px', marginBottom: '20px' }}>
        This page could not be found.
      </p>
      <p style={{ fontSize: '16px', color: '#ccc' }}>
        Redirecting to homepage in 3 seconds...
      </p>
      <div style={{ marginTop: '20px' }}>
        <a 
          href="/" 
          style={{ 
            color: 'white', 
            textDecoration: 'underline',
            fontSize: '16px'
          }}
        >
          Go to homepage now
        </a>
      </div>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/app" element={<SearchInterface />} />
      <Route path="/app/share" element={<SearchInterface isSharePage={true} />} />
      <Route path="/app/feed/:feedId" element={<PodcastFeedPage />} />
      <Route path="/app/feed/:feedId/episode/:episodeId" element={<PodcastFeedPage initialView="curatedClips" />} />
      <Route path="/app/dashboard/:feedId" element={<DashboardPage />} />
      <Route path="/app/feed/:feedId/clipBatch/:runId" element={<SearchInterface isClipBatchPage={true} />} />
      <Route path="/app/feed/:feedId/jamieProHistory" element={<PodcastFeedPage initialView="jamiePro" defaultTab="history" />} />
      <Route path="/try-jamie" element={<TryJamieWizard />} />
      {DEBUG_MODE && <Route path="/twitter-test" element={<TwitterTest />} />}
      
      {/* Redirect old URLs to new structure */}
      <Route path="/feed/:feedId" element={<OldFeedRedirect />} />
      <Route path="/feed/:feedId/clipBatch/:runId" element={<OldClipBatchRedirect />} />
      <Route path="/share" element={<Navigate to="/app/share" replace />} />
      <Route path="/dashboard/:feedId" element={<Navigate to="/app/dashboard" replace />} />
      
      {/* Catch-all route for 404s */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
inject();
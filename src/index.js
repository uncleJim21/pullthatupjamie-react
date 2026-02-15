import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import SearchInterface from './components/SearchInterface.tsx';
import PodcastFeedPage from './components/podcast/PodcastFeedPage.tsx';
import DashboardPage from './components/podcast/DashboardPage.tsx';
import LandingPage from './components/LandingPage.tsx';
import ForPodcastersPage from './components/ForPodcastersPage.tsx';
import PrivacyPage from './components/PrivacyPage.tsx';
import TermsPage from './components/TermsPage.tsx';
import TryJamieWizard from './components/TryJamieWizard.tsx';
import AutomationSettingsPage from './components/AutomationSettingsPage.tsx';
import TwitterTest from './pages/TwitterTest.tsx';
import TwitterAuthCallback from './pages/TwitterAuthCallback.tsx';
import BrowserTestInput from './components/BrowserTestInput.tsx';
import BlogIndex from './components/blog/BlogIndex.tsx';
import BlogPost from './components/blog/BlogPost.tsx';
import UpgradePage from './components/UpgradePage.tsx';
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
  const location = useLocation();
  const search = location.search; // This preserves the query string
  return <Navigate to={`/app/feed/${feedId}${search}`} replace />;
};

// Component to handle old clipBatch URL redirects
const OldClipBatchRedirect = () => {
  const { feedId, runId } = useParams();
  const location = useLocation();
  const search = location.search; // This preserves the query string
  return <Navigate to={`/app/feed/${feedId}/clipBatch/${runId}${search}`} replace />;
};

// Component to handle old share URL redirects with query parameters
const OldShareRedirect = () => {
  const location = useLocation();
  const search = location.search; // This preserves the query string
  return <Navigate to={`/app/share${search}`} replace />;
};

// Component to handle old dashboard URL redirects with query parameters
const OldDashboardRedirect = () => {
  const { feedId } = useParams();
  const location = useLocation();
  const search = location.search; // This preserves the query string
  return <Navigate to={`/app/dashboard/${feedId}${search}`} replace />;
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
  <HelmetProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/for-podcasters" element={<ForPodcastersPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/app" element={<SearchInterface />} />
      <Route path="/app/share" element={<SearchInterface isSharePage={true} />} />
      <Route path="/app/feed/:feedId" element={<PodcastFeedPage />} />
      <Route path="/app/feed/:feedId/episode/:episodeId" element={<PodcastFeedPage initialView="curatedClips" />} />
      <Route path="/app/dashboard/:feedId" element={<DashboardPage />} />
      <Route path="/app/feed/:feedId/clipBatch/:runId" element={<SearchInterface isClipBatchPage={true} />} />
      <Route path="/app/feed/:feedId/jamieProHistory" element={<PodcastFeedPage initialView="jamiePro" defaultTab="history" />} />
      <Route path="/app/feed/:feedId/myRssVideos" element={<PodcastFeedPage initialView="uploads" defaultTab="rss-feed" />} />
      <Route path="/app/automation-settings" element={<AutomationSettingsPage />} />
      <Route path="/try-jamie" element={<TryJamieWizard />} />
      <Route path="/auth/twitter/complete" element={<TwitterAuthCallback />} />
      {DEBUG_MODE && <Route path="/twitter-test" element={<TwitterTest />} />}
      {DEBUG_MODE && <Route path="/browser-test" element={<BrowserTestInput />} />}

      {/* Upgrade page */}
      <Route path="/upgrade" element={<UpgradePage />} />

      {/* Blog routes */}
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/app/blog/:slug" element={<BlogPost />} />
      
      {/* Redirect old URLs to new structure */}
      <Route path="/feed/:feedId" element={<OldFeedRedirect />} />
      <Route path="/feed/:feedId/clipBatch/:runId" element={<OldClipBatchRedirect />} />
      <Route path="/share" element={<OldShareRedirect />} />
      <Route path="/dashboard/:feedId" element={<OldDashboardRedirect />} />
      
      {/* Catch-all route for 404s */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
  </HelmetProvider>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
inject();
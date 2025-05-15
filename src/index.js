import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import SearchInterface from './components/SearchInterface.tsx';
import PodcastFeedPage from './components/podcast/PodcastFeedPage.tsx';
import DashboardPage from './components/podcast/DashboardPage.tsx';
import MainPage from './components/MainPage.tsx';
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

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/app" element={<SearchInterface />} />
      <Route path="/app/share" element={<SearchInterface isSharePage={true} />} />
      <Route path="/app/feed/:feedId" element={<PodcastFeedPage />} />
      <Route path="/app/feed/:feedId/episode/:episodeId" element={<PodcastFeedPage initialView="curatedClips" />} />
      <Route path="/app/dashboard/:feedId" element={<DashboardPage />} />
      <Route path="/app/feed/:feedId/clipBatch/:runId" element={<SearchInterface isClipBatchPage={true} />} />
      <Route path="/app/feed/:feedId/jamieProHistory" element={<PodcastFeedPage initialView="jamiePro" defaultTab="history" />} />
    </Routes>
  </BrowserRouter>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
inject();
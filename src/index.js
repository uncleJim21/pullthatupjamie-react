import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import SearchInterface from './components/SearchInterface.tsx';
import PodcastFeedPage from './components/podcast/PodcastFeedPage.tsx';
import DashboardPage from './components/podcast/DashboardPage.tsx';
import { inject } from "@vercel/analytics"

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<SearchInterface />} />
      <Route path="/share" element={<SearchInterface isSharePage={true} />} />
      <Route path="/feed/:feedId" element={<PodcastFeedPage initialView="jamiePro" />} />
      <Route path="/feed/:feedId/episode/:episodeId" element={<PodcastFeedPage initialView="curatedClips" />} />
      <Route path="/dashboard/:feedId" element={<DashboardPage />} />
      <Route path="/feed/:feedId/clipBatch/:runId" element={<SearchInterface isClipBatchPage={true} />} />
      <Route path="/feed/:feedId/jamieProHistory" element={<PodcastFeedPage initialView="jamiePro" defaultTab="history" />} />
    </Routes>
  </BrowserRouter>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
inject();
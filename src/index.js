import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import SearchInterface from './components/SearchInterface.tsx';
import AccountButton from './components/AccountButton.tsx';


const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<SearchInterface />} />
      <Route path="/account" element={<AccountButton />} />
      {/* Add other routes here */}
    </Routes>
  </BrowserRouter>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

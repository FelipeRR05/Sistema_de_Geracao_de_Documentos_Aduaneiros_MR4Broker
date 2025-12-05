import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import UploadPage from './pages/UploadPage';

function App() {
  return (
    <Router>
      <Header />
      <main className="page-container">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          
        </Routes>
      </main>
    </Router>
  );
}

export default App;
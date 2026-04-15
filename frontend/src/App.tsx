import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import DrugProfile from './pages/DrugProfile';
import NewDrugs from './pages/NewDrugs';
import Countries from './pages/Countries';
import CountryDashboard from './pages/CountryDashboard';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <BrowserRouter basename="/medilens">
      <ScrollToTop />
      {/* v1.0.1-fresh-deploy-check */}
      <Navbar />
      <main style={{ flex: 1 }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/"              element={<Home />} />
            <Route path="/drug/:inn"     element={<DrugProfile />} />
            <Route path="/new-drugs"     element={<NewDrugs />} />
            <Route path="/countries"     element={<Countries />} />
            <Route path="/country/:code" element={<CountryDashboard />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </BrowserRouter>
  );
}


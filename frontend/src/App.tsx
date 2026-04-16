import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import DrugProfile from './pages/DrugProfile';
import NewDrugs from './pages/NewDrugs';
import Countries from './pages/Countries';
import CountryDashboard from './pages/CountryDashboard';
import NotFound from './pages/NotFound';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter basename="/medilens">
      <ScrollToTop />
      <Navbar />
      <main style={{ flex: 1 }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/"              element={<Home />} />
            <Route path="/drug/:inn"     element={<DrugProfile />} />
            <Route path="/new-drugs"     element={<NewDrugs />} />
            <Route path="/countries"     element={<Countries />} />
            <Route path="/country/:code" element={<CountryDashboard />} />
            <Route path="*"              element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </BrowserRouter>
  );
}


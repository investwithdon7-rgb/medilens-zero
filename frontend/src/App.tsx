import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import DrugProfile from './pages/DrugProfile';
import NewDrugs from './pages/NewDrugs';
import CountryDashboard from './pages/CountryDashboard';

export default function App() {
  return (
    <BrowserRouter basename="/medilens">
      {/* v1.0.1-fresh-deploy-check */}
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/drug/:inn"     element={<DrugProfile />} />
          <Route path="/new-drugs"     element={<NewDrugs />} />
          <Route path="/country/:code" element={<CountryDashboard />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

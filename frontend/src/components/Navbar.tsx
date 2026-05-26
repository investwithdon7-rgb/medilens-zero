import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Globe, Activity, Menu, X, Sun, Moon } from 'lucide-react';
import { searchDrugs } from '../lib/search';
import RequestDrugModal from './RequestDrugModal';

export default function Navbar() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialDrugName, setInitialDrugName] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate  = useNavigate();

  const handleRequestTrackingClick = (name: string) => {
    setInitialDrugName(name);
    setIsModalOpen(true);
    setQuery('');
    setResults([]);
  };

  // Theme state defaulting to light
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.className = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await searchDrugs(query);
        setResults(res.hits?.slice(0, 6) ?? []);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (inn: string) => {
    setQuery('');
    setResults([]);
    navigate(`/drug/${inn}`);
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="nav-logo">
          <span className="logo-icon">
            <Activity size={15} />
          </span>
          Medi<span className="logo-accent">Lens</span>
        </Link>

        {/* Search */}
        <div className="search-wrapper" ref={searchRef}>
          <Search className="search-icon" />
          <input
            className="search-input"
            type="text"
            placeholder="Search any drug, brand name, or condition..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && results.length > 0) {
                handleSelect(results[0].document?.inn ?? results[0].id);
              }
            }}
            aria-label="Search drugs"
            aria-autocomplete="list"
            aria-controls="search-results-list"
            aria-expanded={results.length > 0}
          />
          {(results.length > 0 || query.trim().length >= 2) && (
            <div
              className="search-results"
              role="listbox"
              aria-label="Search results"
              id="search-results-list"
            >
              {results.length > 0 ? (
                results.map((hit, i) => (
                  <div
                    key={hit.id}
                    className="search-result-item"
                    role="option"
                    aria-selected={i === 0}
                    tabIndex={0}
                    onClick={() => handleSelect(hit.document?.inn ?? hit.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect(hit.document?.inn ?? hit.id);
                      }
                    }}
                  >
                    <div className="search-result-name">{hit.document?.inn}</div>
                    <div className="search-result-meta">
                      {hit.document?.brand_names}{hit.document?.drug_class ? ` · ${hit.document.drug_class}` : ''}
                    </div>
                  </div>
                ))
              ) : (
                <div 
                  className="search-result-item" 
                  role="option"
                  tabIndex={0}
                  onClick={() => handleRequestTrackingClick(query)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRequestTrackingClick(query);
                    }
                  }}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '0.85rem 1rem', 
                    borderLeft: '3px solid var(--teal-400)',
                    background: 'rgba(20, 184, 166, 0.03)' 
                  }}
                >
                  <div className="search-result-name" style={{ color: 'var(--teal-400)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    🔍 Don't see "{query}"?
                  </div>
                  <div className="search-result-meta" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                    Click here to ask MediLens AI to start tracking this drug →
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/new-drugs">New Drugs</NavLink>
          <NavLink to="/regulatory-hub">Advocacy Hub</NavLink>
          <NavLink to="/trial-finder">Trial Finder</NavLink>
          <NavLink to="/countries" className={({ isActive }) => isActive ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
            <Globe size={14} />
            Countries
          </NavLink>
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-sm"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            style={{ padding: '0.4375rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', height: '32px' }}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>

        {/* Mobile menu toggle & switcher */}
        <div className="mobile-menu-toggle" style={{ display: 'none', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-sm"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            style={{ padding: '0.4375rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', height: '32px' }}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', height: '32px' }}
          >
            {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="mobile-nav" id="mobile-nav-drawer" role="navigation" aria-label="Mobile menu">
          <ul className="mobile-nav-links">
            <li><NavLink to="/" onClick={() => setMobileOpen(false)}>Dashboard</NavLink></li>
            <li><NavLink to="/new-drugs" onClick={() => setMobileOpen(false)}>New Drugs</NavLink></li>
            <li><NavLink to="/regulatory-hub" onClick={() => setMobileOpen(false)}>Advocacy Hub</NavLink></li>
            <li><NavLink to="/trial-finder" onClick={() => setMobileOpen(false)}>Trial Finder</NavLink></li>
            <li>
              <NavLink to="/countries" onClick={() => setMobileOpen(false)}>
                <Globe size={14} style={{ display: 'inline', marginRight: 4 }} />
                Countries
              </NavLink>
            </li>
          </ul>
        </div>
      )}

      {/* Secure crowdsourced drug tracking modal portal */}
      <RequestDrugModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialDrugName={initialDrugName} 
      />
    </nav>
  );
}

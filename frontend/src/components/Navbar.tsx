import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Globe, Activity, Menu, X } from 'lucide-react';
import { searchDrugs } from '../lib/search';

export default function Navbar() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate  = useNavigate();

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
          {results.length > 0 && (
            <div
              className="search-results"
              role="listbox"
              aria-label="Search results"
              id="search-results-list"
            >
              {results.map((hit, i) => (
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
              ))}
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className="nav-links">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/new-drugs">New Drugs</NavLink>
          <NavLink to="/countries" className={({ isActive }) => isActive ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
            <Globe size={14} />
            Countries
          </NavLink>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="btn btn-ghost btn-sm mobile-menu-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-drawer"
        >
          {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="mobile-nav" id="mobile-nav-drawer" role="navigation" aria-label="Mobile menu">
          <ul className="mobile-nav-links">
            <li><NavLink to="/" onClick={() => setMobileOpen(false)}>Dashboard</NavLink></li>
            <li><NavLink to="/new-drugs" onClick={() => setMobileOpen(false)}>New Drugs</NavLink></li>
            <li>
              <NavLink to="/countries" onClick={() => setMobileOpen(false)}>
                <Globe size={14} style={{ display: 'inline', marginRight: 4 }} />
                Countries
              </NavLink>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}

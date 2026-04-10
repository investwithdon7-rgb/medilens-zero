import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Globe, Zap, Menu, X } from 'lucide-react';
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
          <Zap size={20} style={{ color: 'var(--teal-400)' }} />
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
            aria-label="Search drugs"
          />
          {results.length > 0 && (
            <div className="search-results">
              {results.map((hit) => (
                <div
                  key={hit.id}
                  className="search-result-item"
                  onClick={() => handleSelect(hit.document?.inn ?? hit.id)}
                >
                  <div className="search-result-name">{hit.document?.inn}</div>
                  <div className="search-result-meta">
                    {hit.document?.brand_names} · {hit.document?.drug_class}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nav links */}
        <ul className="nav-links">
          <li><NavLink to="/">Dashboard</NavLink></li>
          <li><NavLink to="/new-drugs">New Drugs</NavLink></li>
          <li>
            <NavLink to="/country/USA">
              <Globe size={14} style={{ display: 'inline', marginRight: 4 }} />
              Countries
            </NavLink>
          </li>
        </ul>

        {/* Mobile menu toggle */}
        <button
          className="btn btn-ghost btn-sm"
          style={{ display: 'none' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}

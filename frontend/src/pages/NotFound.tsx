import { Link, useLocation } from 'react-router-dom';
import { Search, ArrowLeft, Globe, Activity } from 'lucide-react';

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '70vh', padding: '4rem 2rem',
      textAlign: 'center',
    }}>
      {/* Logo mark */}
      <div style={{
        width: 64, height: 64, borderRadius: 16, marginBottom: '1.5rem',
        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--blue-400)',
      }}>
        <Activity size={30} />
      </div>

      <div className="badge badge-outline" style={{ marginBottom: '1rem', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
        404 · PAGE NOT FOUND
      </div>

      <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>
        We couldn't find that page
      </h1>
      <p className="text-secondary" style={{ maxWidth: 440, marginBottom: '2rem', lineHeight: 1.7 }}>
        <code style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{pathname}</code>
        {' '}doesn't exist. The drug, country, or page you're looking for may have moved
        or may not be in our database yet.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <Link to="/new-drugs" className="btn btn-ghost">
          <Activity size={14} /> New Drug Radar
        </Link>
        <Link to="/countries" className="btn btn-ghost">
          <Globe size={14} /> Countries
        </Link>
      </div>

      <p className="text-muted text-xs" style={{ marginTop: '2.5rem', maxWidth: 380 }}>
        Looking for a specific drug? Use the search bar at the top of the page,
        or try searching by INN (generic name) rather than brand name.
        <br /><br />
        <Search size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
        Tip: search for "metformin" not "Glucophage"
      </p>
    </div>
  );
}

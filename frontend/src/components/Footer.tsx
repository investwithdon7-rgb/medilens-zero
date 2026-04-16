import { Link } from 'react-router-dom';
import { Activity, Code2, ExternalLink } from 'lucide-react';

const DATA_SOURCES = [
  { label: 'FDA openFDA',          href: 'https://open.fda.gov' },
  { label: 'EMA EPAR',             href: 'https://www.ema.europa.eu/en/medicines/download-medicine-data' },
  { label: 'WHO Prequalification', href: 'https://extranet.who.int/prequal/' },
  { label: 'WHO GPRM',             href: 'https://apps.who.int/gprm/' },
  { label: 'NHS Drug Tariff',      href: 'https://www.nhsbsa.nhs.uk/pharmacies-gp-practices-and-appliance-contractors/drug-tariff' },
  { label: 'ILO ILOSTAT',          href: 'https://ilostat.ilo.org' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      padding: '3rem 0 2rem',
      marginTop: 'auto',
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2.5rem',
          marginBottom: '2.5rem',
        }}>

          {/* Brand */}
          <div>
            <Link to="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em',
              color: 'var(--text-primary)', textDecoration: 'none', marginBottom: '0.75rem',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: 6,
                background: 'var(--blue-600)', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>
                <Activity size={13} />
              </span>
              Medi<span style={{ color: 'var(--blue-400)' }}>Lens</span>
            </Link>
            <p style={{
              color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.7,
              maxWidth: 240, display: 'block', marginTop: '0.5rem',
            }}>
              Open global pharmaceutical intelligence for patients, advocates, and researchers.
              Free. Forever.
            </p>
          </div>

          {/* Navigate */}
          <div>
            <h4 style={{
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem',
            }}>
              Navigate
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Dashboard',          to: '/' },
                { label: 'New Drug Radar',     to: '/new-drugs' },
                { label: 'Country Dashboards', to: '/countries' },
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} style={{
                    color: 'var(--text-secondary)', fontSize: '0.875rem',
                    textDecoration: 'none', transition: 'color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Data Sources */}
          <div>
            <h4 style={{
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem',
            }}>
              Data Sources
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {DATA_SOURCES.map(s => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" style={{
                    color: 'var(--text-secondary)', fontSize: '0.8125rem',
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  }}>
                    {s.label}
                    <ExternalLink size={10} style={{ opacity: 0.5 }} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* About & Contact */}
          <div>
            <h4 style={{
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem',
            }}>
              About
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
              MediLens surfaces pharmaceutical access inequities using open public data.
              All prices and approval dates are reference data — consult official sources before
              clinical or procurement decisions.
            </p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                color: 'var(--text-muted)', fontSize: '0.8125rem', textDecoration: 'none',
              }}
            >
              <Code2 size={14} /> Open source
            </a>
          </div>

        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: '1.25rem',
          display: 'flex', flexWrap: 'wrap', gap: '1rem',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            © {year} MediLens · Reference data only · Not a substitute for medical advice
          </p>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            {[
              { label: 'Data methodology', href: '#' },
              { label: 'Privacy',          href: '#' },
              { label: 'Contact',          href: 'mailto:contact@tekdruid.com' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{
                color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'none',
              }}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

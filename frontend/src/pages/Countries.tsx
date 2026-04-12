import { Globe, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const COUNTRIES = [
  { code: 'AUS', name: 'Australia', region: 'Oceania' },
  { code: 'AUT', name: 'Austria', region: 'Europe' },
  { code: 'BGD', name: 'Bangladesh', region: 'Asia' },
  { code: 'BEL', name: 'Belgium', region: 'Europe' },
  { code: 'BRA', name: 'Brazil', region: 'South America' },
  { code: 'CAN', name: 'Canada', region: 'North America' },
  { code: 'DNK', name: 'Denmark', region: 'Europe' },
  { code: 'FIN', name: 'Finland', region: 'Europe' },
  { code: 'FRA', name: 'France', region: 'Europe' },
  { code: 'DEU', name: 'Germany', region: 'Europe' },
  { code: 'GRC', name: 'Greece', region: 'Europe' },
  { code: 'IND', name: 'India', region: 'Asia' },
  { code: 'ITA', name: 'Italy', region: 'Europe' },
  { code: 'JPN', name: 'Japan', region: 'Asia' },
  { code: 'KEN', name: 'Kenya', region: 'Africa' },
  { code: 'NLD', name: 'Netherlands', region: 'Europe' },
  { code: 'NGA', name: 'Nigeria', region: 'Africa' },
  { code: 'PAK', name: 'Pakistan', region: 'Asia' },
  { code: 'POL', name: 'Poland', region: 'Europe' },
  { code: 'PRT', name: 'Portugal', region: 'Europe' },
  { code: 'ZAF', name: 'South Africa', region: 'Africa' },
  { code: 'ESP', name: 'Spain', region: 'Europe' },
  { code: 'LKA', name: 'Sri Lanka', region: 'Asia' },
  { code: 'SWE', name: 'Sweden', region: 'Europe' },
  { code: 'GBR', name: 'United Kingdom', region: 'Europe' },
  { code: 'USA', name: 'United States', region: 'North America' },
];

export default function Countries() {
  // Group by region
  const grouped = COUNTRIES.reduce((acc, c) => {
    acc[c.region] = acc[c.region] || [];
    acc[c.region].push(c);
    return acc;
  }, {} as Record<string, typeof COUNTRIES>);

  return (
    <div className="container section">
      <div style={{ marginBottom: '3rem' }}>
        <h1 className="hero-title" style={{ fontSize: '2.5rem', textAlign: 'left', marginBottom: '1rem' }}>
          Global Intelligence Network
        </h1>
        <p className="text-secondary" style={{ maxWidth: 600 }}>
          Select a country to view its pharmaceutical intelligence dashboard, including approval lags, 
          pricing equity, and therapeutic gaps relative to the global first approval.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {Object.entries(grouped).map(([region, countries]) => (
          <div key={region}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--teal-400)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={20} />
              {region}
            </h2>
            <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {countries.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                <Link key={c.code} to={`/country/${c.code}`} className="pillar-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{c.name}</div>
                      <div className="text-xs text-muted mt-1">{c.code}</div>
                    </div>
                    <div style={{ color: 'var(--teal-400)' }}>
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Globe, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COUNTRY_DATA, incomeClassBadge } from '../lib/reference-data';

const COUNTRIES = [
  { code: 'AUS', name: 'Australia',       region: 'Oceania' },
  { code: 'AUT', name: 'Austria',         region: 'Europe' },
  { code: 'BGD', name: 'Bangladesh',      region: 'Asia' },
  { code: 'BEL', name: 'Belgium',         region: 'Europe' },
  { code: 'BRA', name: 'Brazil',          region: 'South America' },
  { code: 'CAN', name: 'Canada',          region: 'North America' },
  { code: 'DNK', name: 'Denmark',         region: 'Europe' },
  { code: 'FIN', name: 'Finland',         region: 'Europe' },
  { code: 'FRA', name: 'France',          region: 'Europe' },
  { code: 'DEU', name: 'Germany',         region: 'Europe' },
  { code: 'GRC', name: 'Greece',          region: 'Europe' },
  { code: 'IND', name: 'India',           region: 'Asia' },
  { code: 'ITA', name: 'Italy',           region: 'Europe' },
  { code: 'JPN', name: 'Japan',           region: 'Asia' },
  { code: 'KEN', name: 'Kenya',           region: 'Africa' },
  { code: 'NLD', name: 'Netherlands',     region: 'Europe' },
  { code: 'NGA', name: 'Nigeria',         region: 'Africa' },
  { code: 'PAK', name: 'Pakistan',        region: 'Asia' },
  { code: 'POL', name: 'Poland',          region: 'Europe' },
  { code: 'PRT', name: 'Portugal',        region: 'Europe' },
  { code: 'ZAF', name: 'South Africa',    region: 'Africa' },
  { code: 'ESP', name: 'Spain',           region: 'Europe' },
  { code: 'LKA', name: 'Sri Lanka',       region: 'Asia' },
  { code: 'SWE', name: 'Sweden',          region: 'Europe' },
  { code: 'GBR', name: 'United Kingdom',  region: 'Europe' },
  { code: 'USA', name: 'United States',   region: 'North America' },
];

const INCOME_LABELS: Record<string, string> = {
  HIC:  'High Income',
  UMIC: 'Upper-Middle Income',
  LMIC: 'Lower-Middle Income',
  LIC:  'Low Income',
};

export default function Countries() {
  const grouped = COUNTRIES.reduce((acc, c) => {
    acc[c.region] = acc[c.region] || [];
    acc[c.region].push(c);
    return acc;
  }, {} as Record<string, typeof COUNTRIES>);

  const totalCountries = COUNTRIES.length;
  const lmicCount = COUNTRIES.filter(c => {
    const ref = COUNTRY_DATA[c.code];
    return ref && (ref.income_class === 'LMIC' || ref.income_class === 'LIC');
  }).length;

  return (
    <div className="container section">
      <div style={{ marginBottom: '3rem' }}>
        <h1 className="hero-title" style={{ fontSize: '2.5rem', textAlign: 'left', marginBottom: '1rem' }}>
          Global Intelligence Network
        </h1>
        <p className="text-secondary" style={{ maxWidth: 640, marginBottom: '1.5rem' }}>
          Select a country to view its pharmaceutical intelligence dashboard — approval lags,
          Access Equity Score, pricing, gap bottleneck classification, and AI-generated policy briefs.
        </p>

        {/* Income class legend */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-xs text-muted">Income class:</span>
          {Object.entries(INCOME_LABELS).map(([key, label]) => (
            <span key={key} className={`badge ${incomeClassBadge(key as any)} text-xs`}>
              {key} — {label}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted mt-2" style={{ marginTop: '0.5rem' }}>
          Tracking {totalCountries} countries · {lmicCount} lower/low income (LMIC/LIC) · Source: World Bank 2024
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
              {countries.sort((a, b) => a.name.localeCompare(b.name)).map(c => {
                const ref = COUNTRY_DATA[c.code];
                return (
                  <Link key={c.code} to={`/country/${c.code}`} className="pillar-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{c.name}</div>
                        <div className="text-xs text-muted mt-1">{c.code}</div>
                        {ref && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span className={`badge ${incomeClassBadge(ref.income_class)} text-xs`} style={{ fontSize: '0.65rem' }}>
                              {ref.income_class}
                            </span>
                            <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>
                              {ref.population_m >= 1000
                                ? `${(ref.population_m / 1000).toFixed(1)}B`
                                : `${ref.population_m}M`} people
                            </span>
                          </div>
                        )}
                      </div>
                      <div style={{ color: 'var(--teal-400)', marginTop: '0.25rem' }}>
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, RefreshCw, Globe, TrendingUp } from 'lucide-react';
import { getNewDrugsFeed } from '../lib/firebase';
import { COUNTRY_DATA } from '../lib/reference-data';

export default function NewDrugs() {
  const [drugs, setDrugs]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'lmic' | 'hic-only'>('all');

  useEffect(() => {
    getNewDrugsFeed(30).then(d => { setDrugs(d); setLoading(false); });
  }, []);

  // Filter by coverage equity
  const filtered = drugs.filter(drug => {
    if (filter === 'all') return true;
    const countries: string[] = drug.countries_registered ?? [];
    const hasLMIC = countries.some(c => {
      const ref = COUNTRY_DATA[c];
      return ref && (ref.income_class === 'LMIC' || ref.income_class === 'LIC');
    });
    if (filter === 'lmic')     return hasLMIC;
    if (filter === 'hic-only') return !hasLMIC && countries.length > 0;
    return true;
  });

  // HIC-only: drug is registered in ≥1 tracked country AND all of them are HIC
  // AND we have LMIC coverage data (lmic_count field present) to avoid false positives
  // from sparse data where we simply haven't ingested LMIC records yet.
  const licOnly = drugs.filter(d => {
    const countries: string[] = d.countries_registered ?? [];
    if (countries.length === 0) return false;
    // Only flag as HIC-only when we have confirmed data coverage (≥2 countries or lmic_count field present)
    const hasCoverage = countries.length >= 2 || d.data_coverage >= 2;
    if (!hasCoverage) return false;
    return countries.every(c => {
      const ref = COUNTRY_DATA[c];
      return ref && ref.income_class === 'HIC';
    });
  }).length;

  const withLMIC = drugs.filter(d => (d.lmic_count ?? 0) > 0).length;
  const sparseData = drugs.filter(d => (d.data_coverage ?? 0) <= 1).length;

  return (
    <>
      {/* Header */}
      <div className="drug-header">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Zap size={24} style={{ color: 'var(--teal-400)' }} />
            <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>New Drug Radar</h1>
          </div>
          <p className="text-secondary">
            Drugs approved globally in the past 24 months — see which reached your country and which didn't.
          </p>
        </div>
      </div>

      <div className="container section">

        {/* Equity summary banner */}
        {!loading && drugs.length > 0 && (
          <div className="access-gap-banner mb-4" style={{ marginBottom: '1.5rem' }}>
            <TrendingUp size={22} />
            <div>
              <div className="access-gap-headline">
                <strong>{drugs.length}</strong> drugs with first global approval in the last 24 months tracked in our database.
                {licOnly > 0 && (
                  <> Of those with multi-country data, <strong style={{ color: 'var(--amber-400)' }}>{licOnly}</strong> show <strong>registration only in high-income countries</strong> so far.</>
                )}
                {withLMIC > 0 && (
                  <> <strong style={{ color: 'var(--emerald-400)' }}>{withLMIC}</strong> have confirmed LMIC registrations.</>
                )}
              </div>
              <div className="access-gap-sub">
                {sparseData > 0
                  ? `${sparseData} drugs have only 1 tracked registration (data expanding daily via FDA + EMA + WHO PQ pipeline). `
                  : ''}
                Filters below show equity gaps across income groups.
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {!loading && drugs.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {([
              { key: 'all',      label: `All tracked (${drugs.length})` },
              { key: 'lmic',     label: `Has LMIC registration (${withLMIC})` },
              { key: 'hic-only', label: `Confirmed HIC-only (${licOnly})` },
            ] as const).map(f => (
              <button
                key={f.key}
                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton skeleton-card" style={{ height: 200 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {Object.entries(
              filtered.reduce((acc, drug) => {
                const category = drug.drug_class || 'General Therapies';
                if (!acc[category]) acc[category] = [];
                acc[category].push(drug);
                return acc;
              }, {} as Record<string, any[]>)
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, categoryDrugs]) => (
                <div key={category}>
                  <h2 className="mb-3 text-teal" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    {category}
                    <span className="text-xs text-muted font-mono" style={{ fontWeight: 400, marginLeft: '0.75rem' }}>
                      {(categoryDrugs as any[]).length} drug{(categoryDrugs as any[]).length !== 1 ? 's' : ''}
                    </span>
                  </h2>
                  <div className="grid-2">
                    {(categoryDrugs as any[]).map(drug => (
                      <DrugCard key={drug.id || drug.inn} drug={drug} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}

function DrugCard({ drug }: { drug: any }) {
  const countries: string[]  = drug.countries_registered ?? [];
  const countryCount         = countries.length;
  const firstCountryRef      = COUNTRY_DATA[drug.first_approval_country];

  // Compute LMIC reach
  const lmicCountries = countries.filter(c => {
    const ref = COUNTRY_DATA[c];
    return ref && (ref.income_class === 'LMIC' || ref.income_class === 'LIC');
  });
  const hicCountries = countries.filter(c => {
    const ref = COUNTRY_DATA[c];
    return ref && ref.income_class === 'HIC';
  });

  // Adoption momentum: speed of spread (countries/month since first approval)
  let momentumLabel = '';
  if (drug.approval_date && countryCount > 1) {
    const monthsSinceFirst = (Date.now() - new Date(drug.approval_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
    const rate = countryCount / Math.max(monthsSinceFirst, 1);
    if (rate >= 0.5)      momentumLabel = '⚡ Fast spread';
    else if (rate >= 0.2) momentumLabel = '↗ Growing';
    else                  momentumLabel = '↔ Slow spread';
  }

  return (
    <div className="card" style={{ transition: 'all 0.2s' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
            <span className="badge badge-teal">🆕 {drug.approval_type ?? 'Novel drug'}</span>
            {drug.ai_analytics && (
              <span className="badge badge-outline" style={{ border: '1px solid var(--teal-400)', color: 'var(--teal-400)' }}>
                ✨ AI Profile
              </span>
            )}
            {drug.is_essential && (
              <span className="badge badge-green text-xs">WHO EML</span>
            )}
          </div>
          <h3 style={{ fontSize: '1.1rem' }}>
            <Link to={`/drug/${drug.inn}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {drug.brand_name ?? drug.inn}
            </Link>
          </h3>
          <p className="text-xs text-muted">{drug.inn}</p>
        </div>
        <span className="badge badge-blue">{drug.authority}</span>
      </div>

      {/* Indication */}
      {drug.indication && (
        <p className="text-sm text-secondary" style={{ marginBottom: '0.75rem', lineHeight: 1.5 }}>
          {drug.indication}
        </p>
      )}

      {/* AI summary */}
      {drug.ai_summary && (
        <p className="text-xs text-muted" style={{ marginBottom: '0.75rem', lineHeight: 1.5, fontStyle: 'italic' }}>
          {drug.ai_summary.length > 140 ? drug.ai_summary.slice(0, 140) + '…' : drug.ai_summary}
        </p>
      )}

      {/* First approval country */}
      {firstCountryRef && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted">
          <Globe size={12} />
          First approved in <strong className="text-secondary">{firstCountryRef.name}</strong>
        </div>
      )}

      {/* Coverage breakdown */}
      <div className="adoption-mini-bars mb-3">
        {hicCountries.length > 0 && (
          <div className="adoption-mini-row">
            <span className="text-xs text-muted" style={{ width: 80 }}>HIC</span>
            <div className="adoption-mini-track">
              <div className="adoption-mini-bar" style={{ width: `${Math.min((hicCountries.length / 20) * 100, 100)}%`, background: 'var(--green-400)' }} />
            </div>
            <span className="text-xs text-muted">{hicCountries.length}</span>
          </div>
        )}
        {lmicCountries.length > 0 ? (
          <div className="adoption-mini-row">
            <span className="text-xs text-muted" style={{ width: 80 }}>LMIC/LIC</span>
            <div className="adoption-mini-track">
              <div className="adoption-mini-bar" style={{ width: `${Math.min((lmicCountries.length / 20) * 100, 100)}%`, background: 'var(--amber-400)' }} />
            </div>
            <span className="text-xs text-muted">{lmicCountries.length}</span>
          </div>
        ) : (
          <div className="text-xs" style={{ color: 'var(--red-400)' }}>⚠ No LMIC coverage yet</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="text-xs text-muted">
          First approved{' '}
          <strong style={{ color: 'var(--text-secondary)' }}>
            {drug.approval_date
              ? new Date(drug.approval_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
              : '—'}
          </strong>
          {momentumLabel && <span className="text-xs text-teal" style={{ marginLeft: '0.5rem' }}>{momentumLabel}</span>}
        </div>
        <span className={`badge ${countryCount > 5 ? 'badge-green' : countryCount > 1 ? 'badge-amber' : 'badge-red'}`}>
          {countryCount} {countryCount === 1 ? 'country' : 'countries'}
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card text-center" style={{ padding: '4rem 2rem' }}>
      <RefreshCw size={48} style={{ color: 'var(--teal-400)', margin: '0 auto 1rem', animation: 'spin 3s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <h3 className="mb-2" style={{ marginTop: '0.5rem' }}>Data refresh incoming</h3>
      <p className="text-secondary text-sm" style={{ maxWidth: 420, margin: '0.5rem auto 0' }}>
        Our global intelligence pipeline is collecting the latest drug approvals from openFDA, EMA, and WHO.
        New entries typically appear within 24 hours.
      </p>
      <Link to="/countries" className="btn btn-outline" style={{ marginTop: '1.75rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
        <Zap size={14} /> Browse Country Dashboards
      </Link>
    </div>
  );
}

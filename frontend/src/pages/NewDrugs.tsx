import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ExternalLink } from 'lucide-react';
import { getNewDrugsFeed } from '../lib/firebase';

export default function NewDrugs() {
  const [drugs, setDrugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNewDrugsFeed(20).then(d => { setDrugs(d); setLoading(false); });
  }, []);

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
        {loading ? (
          <div className="grid-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton skeleton-card" style={{ height: 160 }} />
            ))}
          </div>
        ) : drugs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid-2">
            {drugs.map(drug => <DrugCard key={drug.id} drug={drug} />)}
          </div>
        )}
      </div>
    </>
  );
}

function DrugCard({ drug }: { drug: any }) {
  const countriesYes = drug.countries_registered ?? [];
  const countryCount = countriesYes.length;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <span className="badge badge-teal" style={{ marginBottom: '0.5rem', display: 'inline-flex' }}>
            🆕 {drug.approval_type ?? 'Novel drug'}
          </span>
          <h3 style={{ fontSize: '1.1rem' }}>
            <Link to={`/drug/${drug.inn}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {drug.brand_name ?? drug.inn}
            </Link>
          </h3>
          <p className="text-xs text-muted">{drug.inn}</p>
        </div>
        <span className="badge badge-blue">{drug.authority}</span>
      </div>

      <p className="text-sm text-secondary" style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
        {drug.indication}
      </p>

      {drug.ai_summary && (
        <p className="text-xs text-muted" style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
          {drug.ai_summary.length > 140 ? drug.ai_summary.slice(0, 140) + '…' : drug.ai_summary}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="text-xs text-muted">
          First approved{' '}
          <strong style={{ color: 'var(--text-secondary)' }}>
            {drug.approval_date
              ? new Date(drug.approval_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
              : '—'}
          </strong>
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
      <Zap size={48} style={{ color: 'var(--teal-400)', margin: '0 auto 1rem' }} />
      <h3 className="mb-2">No new drugs yet</h3>
      <p className="text-secondary text-sm">
        Run the <code className="font-mono">01-ingest-approvals</code> GitHub Actions workflow
        to seed the first batch of drug approval data from openFDA and EMA.
      </p>
      <a
        href="https://github.com"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline mt-4"
        style={{ marginTop: '1.5rem', display: 'inline-flex' }}
      >
        <ExternalLink size={14} /> Open GitHub Actions
      </a>
    </div>
  );
}

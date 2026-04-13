import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Globe, Clock, X, Copy, Check, RefreshCw } from 'lucide-react';
import { getCountryDashboard } from '../lib/firebase';
import { callAiProxy } from '../lib/ai-proxy';

export default function CountryDashboard() {
  const { code }           = useParams<{ code: string }>();
  const [data, setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiModal, setAiModal]     = useState<{ title: string; content: string; task: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    getCountryDashboard(code.toUpperCase()).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [code]);

  const handleDrugAnalysis = async (drugName: string) => {
    if (!data) return;
    setIsGenerating(drugName);
    try {
      const content = await callAiProxy({
        task: 'drug_country_analysis',
        payload: {
          country: data.country_name,
          drug: drugName
        }
      });
      setAiModal({ title: `Analysis: ${drugName} in ${data.country_name}`, content, task: 'drug_country_analysis' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGenerating(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingSkeleton />;
  if (!data)   return <Seeding code={code} />;

  const lag    = data.lag_summary ?? {};
  const gaps   = data.top_gaps ?? [];

  return (
    <>
      {/* Header */}
      <div className="drug-header">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Globe size={24} style={{ color: 'var(--teal-400)' }} />
            <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
              {data.country_name ?? code}
            </h1>
            <span className="badge badge-blue">{code?.toUpperCase()}</span>
          </div>
          <p className="text-secondary text-sm">
            Pharmaceutical intelligence dashboard · Updated {data.updated_at ?? 'recently'}
          </p>
        </div>
      </div>

      <div className="container section">
        {/* Summary cards */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-value text-amber">{lag.drugs_behind_2yr ?? '—'}</div>
            <div className="stat-label">Drugs &gt;2yr behind</div>
            <div className="stat-delta">vs global first approval</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-red">{data.new_drugs_not_registered ?? '—'}</div>
            <div className="stat-label">New drugs not registered</div>
            <div className="stat-delta">approved elsewhere, not here</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-teal">
              {data.pricing_percentile != null ? `${data.pricing_percentile}th` : '—'}
            </div>
            <div className="stat-label">Pricing percentile</div>
            <div className="stat-delta">globally for EML basket</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-purple-400">{data.shortage_risk_high ?? '—'}</div>
            <div className="stat-label">High shortage risk</div>
            <div className="stat-delta">vulnerability score &gt; 0.7</div>
          </div>
        </div>

        {/* AI narrative */}
        {data.ai_narrative && (
          <div className="card card-lg" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--teal-500)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="badge badge-teal">AI Summary</span>
            </div>
            <p className="text-secondary" style={{ lineHeight: 1.75 }}>{data.ai_narrative}</p>
          </div>
        )}



        {/* Top access gaps */}
        {gaps.length > 0 && (
          <div className="card card-lg">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Clock size={18} style={{ color: 'var(--amber-400)' }} />
              <h3>Biggest Access Gaps</h3>
            </div>
            {gaps.map((g: any, i: number) => (
              <div key={i} className="timeline-row">
                <span className="timeline-country" style={{ flex: 2 }}>
                  <span className="dot-not-filed" style={{ marginRight: 8 }} />
                  {g.inn}
                </span>
                <span className="timeline-authority text-muted" style={{ flex: 1 }}>{g.authority}</span>
                <span className="timeline-date text-sm" style={{ flex: 1.5 }}>
                  First: {g.first_approved
                    ? new Date(g.first_approved).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
                    : '—'}
                </span>
                <span className="timeline-lag" style={{ flex: 1 }}>
                  <span className="badge badge-red">{g.condition}</span>
                </span>
                <button 
                  className="btn btn-outline btn-sm"
                  disabled={isGenerating === g.inn}
                  onClick={() => handleDrugAnalysis(g.inn)}
                  style={{ marginLeft: 'auto' }}
                >
                  {isGenerating === g.inn ? '...' : 'Analyze'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Modal */}
      {aiModal && (
        <div className="ai-modal-overlay" onClick={() => setAiModal(null)}>
          <div className="ai-modal" onClick={e => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h3 className="font-bold">{aiModal.title}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setAiModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="ai-modal-body">
              <div className="ai-output-text">
                {aiModal.content}
              </div>
            </div>
            <div className="ai-modal-footer">
              <button className="btn btn-ghost" onClick={() => setAiModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => copyToClipboard(aiModal.content)}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy to Clipboard</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="container section">
      <div className="skeleton skeleton-title" />
      <div className="grid-4" style={{ marginTop: '2rem' }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
      </div>
      <div className="skeleton" style={{ height: 200, marginTop: '1.5rem', borderRadius: 12 }} />
    </div>
  );
}

function Seeding({ code }: { code?: string }) {
  return (
    <div className="container section text-center" style={{ padding: '6rem 2rem' }}>
      <RefreshCw
        size={56}
        style={{
          color: 'var(--teal-400)',
          margin: '0 auto 1.5rem',
          animation: 'spin 4s linear infinite',
        }}
      />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <h2>Intelligence report pending for {code?.toUpperCase()}</h2>
      <p className="text-secondary mt-2" style={{ maxWidth: 520, margin: '1rem auto 2rem' }}>
        Our AI engine is currently processing global registration data and therapeutic landscapes 
        for this country. This usually takes less than 24 hours for new regions.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-outline">
          Back to Global Dashboard
        </Link>
        <Link to="/new-drugs" className="btn btn-primary">
          View Latest Approvals
        </Link>
      </div>
    </div>
  );
}

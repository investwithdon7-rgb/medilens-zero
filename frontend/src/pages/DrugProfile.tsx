import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, TrendingDown, FileText, Send, X, Copy, Check, DollarSign, Zap } from 'lucide-react';
import { getDrug, getDrugApprovals, getDrugPrices } from '../lib/firebase';
import { callAiProxy, type AiTask } from '../lib/ai-proxy';

type Approval = {
  country: string;
  authority: string;
  approval_date: string;
  lag_days: number | null;
};

export default function DrugProfile() {
  const { inn }           = useParams<{ inn: string }>();
  const [drug, setDrug]   = useState<any>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [prices, setPrices]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [aiModal, setAiModal]     = useState<{ title: string; content: string; task: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    if (!inn) return;
    setLoading(true);
    Promise.all([getDrug(inn), getDrugApprovals(inn), getDrugPrices(inn)]).then(([d, a, p]) => {
      setDrug(d);
      setApprovals((a as Approval[]).sort((x, y) =>
        (x.lag_days ?? Infinity) - (y.lag_days ?? Infinity)
      ));
      setPrices(p);
      setLoading(false);
    });
  }, [inn]);

  const handleAdvocacy = async (task: AiTask, title: string) => {
    if (!drug) return;
    setIsGenerating(task);
    try {
      const content = await callAiProxy({
        task,
        payload: {
          drug_name: drug.inn,
          drug_class: drug.drug_class,
          brand_names: drug.brand_names,
          approvals: approvals,
        }
      });
      setAiModal({ title, content, task });
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
  if (!drug)   return <NotFound inn={inn} />;

  const firstApproval = approvals[0];
  const notRegistered = approvals.filter(a => !a.approval_date).length;

  return (
    <>
      {/* Drug header */}
      <div className="drug-header">
        <div className="container">
          <Link to="/" className="btn btn-ghost btn-sm mb-4" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
            <ArrowLeft size={14} /> Back
          </Link>
          <div className="drug-inn">{drug.atc_code}</div>
          <h1 className="drug-name">{drug.inn}</h1>
          <p className="drug-brands">
            {Array.isArray(drug.brand_names) ? drug.brand_names.join(' · ') : drug.brand_names}
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-teal">{drug.drug_class}</span>
            {drug.is_essential && <span className="badge badge-green">WHO Essential Medicine</span>}
          </div>
        </div>
      </div>

      <div className="container section">
        {/* Advocacy Actions */}
        <div className="mb-8">
          <h3 className="mb-4 text-teal">Advocacy Toolkit</h3>
          <div className="advocacy-grid">
            <div className="advocacy-card">
              <div className="flex items-center gap-4 mb-3">
                <div className="pillar-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--blue-400)', margin: 0 }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Therapeutic Briefing</h4>
                  <p className="text-xs text-muted">Clinical value proposition</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                Generate a comprehensive clinical summary of this drug's therapeutic value and impact.
              </p>
              <button 
                className="btn btn-primary btn-sm w-full"
                disabled={!!isGenerating}
                onClick={() => handleAdvocacy('appeal_letter', 'Insurance Appeal Letter')}
              >
                {isGenerating === 'appeal_letter' ? 'Generating...' : 'Generate Letter'}
              </button>
            </div>

            <div className="advocacy-card">
              <div className="flex items-center gap-4 mb-3">
                <div className="pillar-icon" style={{ background: 'rgba(192, 132, 252, 0.1)', color: 'var(--purple-400)', margin: 0 }}>
                  <Send size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Strategic Analysis</h4>
                  <p className="text-xs text-muted">Access & registration profile</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                Get an intelligence report on registration lags, patent status, and global access barriers.
              </p>
              <button 
                className="btn btn-ghost btn-sm w-full"
                disabled={!!isGenerating}
                onClick={() => handleAdvocacy('policy_brief', 'Strategic Analysis')}
              >
                {isGenerating === 'policy_brief' ? 'Generating...' : 'Analyze Market Access'}
              </button>
            </div>
          </div>
        </div>
        {/* Clinical & Market Analysis */}
        {(drug.ai_summary || drug.ai_analytics) && (
          <div className="card card-lg mb-8" style={{ borderLeft: '4px solid var(--teal-400)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap size={20} className="text-teal" />
              <h3 className="m-0">Clinical & Market Intelligence</h3>
            </div>
            
            <div className="grid-2 gap-8">
              <div>
                <h4 className="text-xs uppercase tracking-widest text-muted mb-2">Therapeutic Significance</h4>
                <p className="text-secondary leading-relaxed">
                  {drug.ai_analytics?.significance || drug.ai_summary}
                </p>
              </div>
              
              {drug.ai_analytics?.access_outlook && (
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-muted mb-2">Global Access Outlook</h4>
                  <p className="text-secondary leading-relaxed">
                    {drug.ai_analytics.access_outlook}
                  </p>
                </div>
              )}
            </div>

            {drug.ai_analytics?.alternatives && drug.ai_analytics.alternatives.length > 0 && (
              <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-xs uppercase tracking-widest text-muted mb-3">Therapeutic Alternatives</h4>
                <div className="flex flex-wrap gap-2">
                  {drug.ai_analytics.alternatives.map((alt: string) => (
                    <span key={alt} className="badge badge-outline text-xs">
                      {alt}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary stats */}
        <div className="grid-4 mb-4" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-value text-teal">{approvals.filter(a => a.approval_date).length}</div>
            <div className="stat-label">Countries approved</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-amber">{notRegistered}</div>
            <div className="stat-label">Not yet registered</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {firstApproval?.approval_date
                ? new Date(firstApproval.approval_date).getFullYear()
                : '—'}
            </div>
            <div className="stat-label">First global approval</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {firstApproval?.authority ?? '—'}
            </div>
            <div className="stat-label">Lead regulator</div>
          </div>
        </div>

        {/* Global Pricing */}
        {prices.length > 0 && (
          <div className="card card-lg mb-4" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <DollarSign size={18} style={{ color: 'var(--amber-400)' }} />
              <h3>Global Pricing Insights</h3>
            </div>
            
            <div className="grid-2">
              <div>
                <p className="text-secondary text-sm mb-4">
                  Reference prices sourced from WHO GPRM, UNICEF, and MSF. Prices are shown for standard units.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {prices.sort((a,b) => b.price - a.price).map(p => (
                    <div key={p.country} className="flex justify-between items-center p-2 rounded" style={{ background: 'var(--bg-glass)' }}>
                      <span className="font-bold">{p.country || p.id}</span>
                      <div className="text-right">
                        <div className="text-teal font-mono">{p.currency} {p.price}</div>
                        <div className="text-xs text-muted">{p.unit}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col justify-center items-center p-4 border rounded" style={{ borderColor: 'var(--border)', background: 'rgba(251, 191, 36, 0.03)' }}>
                <TrendingDown size={32} className="text-amber mb-2" />
                <h4 className="text-center">Financial Toxicity Alert</h4>
                <p className="text-xs text-secondary text-center mt-2">
                  Significant price variance detected across reference markets.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Approval timeline */}
        <div className="card card-lg">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Clock size={18} style={{ color: 'var(--teal-400)' }} />
            <h3>Approval Timeline</h3>
          </div>

          {approvals.length === 0 ? (
            <p className="text-muted">No approval data available yet.</p>
          ) : (
            <div>
              {approvals.map(a => (
                <div key={a.country} className="timeline-row">
                  <span className="timeline-country">
                    <span className={a.approval_date ? 'dot-approved' : 'dot-not-filed'} style={{ marginRight: 8 }} />
                    {a.country}
                  </span>
                  <span className="timeline-authority text-muted">{a.authority}</span>
                  <span className="timeline-date">
                    {a.approval_date
                      ? new Date(a.approval_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
                      : <span className="text-muted">Not registered</span>
                    }
                  </span>
                  <span className="timeline-lag">
                    {a.lag_days === 0
                      ? <span className="badge badge-green">First global approval</span>
                      : a.lag_days != null
                        ? <span className="badge badge-amber">+{Math.round(a.lag_days / 365 * 10) / 10} yrs lag</span>
                        : <span className="text-muted text-xs">No data</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
      <div className="skeleton skeleton-text" style={{ width: '40%' }} />
      <div className="grid-4" style={{ marginTop: '2rem' }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
      </div>
    </div>
  );
}

function NotFound({ inn }: { inn?: string }) {
  return (
    <div className="container section text-center" style={{ padding: '6rem 2rem' }}>
      <div className="pillar-icon" style={{ background: 'rgba(248, 113, 113, 0.1)', color: 'var(--red-400)', margin: '0 auto 1.5rem', width: 64, height: 64 }}>
        <X size={32} />
      </div>
      <h2>Drug not found: {inn}</h2>
      <p className="text-secondary mt-2" style={{ maxWidth: 480, margin: '1rem auto 2rem' }}>
        We couldn't find intelligence data for this specific molecule yet. 
        It might be under a different name, or our pipeline hasn't indexed it yet.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-ghost">
          Back to Dashboard
        </Link>
        <Link to="/new-drugs" className="btn btn-primary">
          Browse Recent Approvals
        </Link>
      </div>
    </div>
  );
}

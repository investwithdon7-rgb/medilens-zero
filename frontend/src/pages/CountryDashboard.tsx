import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Globe, Clock, DollarSign, AlertTriangle, FileText, Send, X, Copy, Check } from 'lucide-react';
import { getCountryDashboard } from '../lib/firebase';
import { callAiProxy, AiTask } from '../lib/ai-proxy';

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

  const handleAdvocacy = async (task: AiTask, title: string) => {
    if (!data) return;
    setIsGenerating(task);
    try {
      const content = await callAiProxy({
        task,
        payload: {
          country_name: data.country_name,
          country_code: code,
          lag_summary: data.lag_summary,
          top_gaps: data.top_gaps,
          ai_narrative: data.ai_narrative
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

        {/* Advocacy Toolkit */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 className="mb-4 text-teal">Policy & Advocacy Toolkit</h3>
          <div className="advocacy-grid">
            <div className="advocacy-card">
              <div className="flex items-center gap-4 mb-3">
                <div className="pillar-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--blue-400)', margin: 0 }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Ministry Briefing</h4>
                  <p className="text-xs text-muted">For policy makers</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                Generate a professional evidence-based briefing showing how {data.country_name} lags in global drug access.
              </p>
              <button 
                className="btn btn-primary btn-sm w-full"
                disabled={!!isGenerating}
                onClick={() => handleAdvocacy('policy_brief', 'Ministry Of Health Briefing')}
              >
                {isGenerating === 'policy_brief' ? 'Generating...' : 'Generate Brief'}
              </button>
            </div>

            <div className="advocacy-card">
              <div className="flex items-center gap-4 mb-3">
                <div className="pillar-icon" style={{ background: 'rgba(251, 191, 36, 0.1)', color: 'var(--amber-400)', margin: 0 }}>
                  <Send size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Citizen Petition</h4>
                  <p className="text-xs text-muted">For patient advocacy</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                Draft a formal petition to improve drug registration speed and transparency in {data.country_name}.
              </p>
              <button 
                className="btn btn-ghost btn-sm w-full"
                disabled={!!isGenerating}
                onClick={() => handleAdvocacy('appeal_letter', 'Citizen Advocacy Petition')}
              >
                {isGenerating === 'appeal_letter' ? 'Generating...' : 'Generate Petition'}
              </button>
            </div>
          </div>
        </div>

        {/* Top access gaps */}
        {gaps.length > 0 && (
          <div className="card card-lg">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Clock size={18} style={{ color: 'var(--amber-400)' }} />
              <h3>Biggest Access Gaps</h3>
            </div>
            {gaps.map((g: any, i: number) => (
              <div key={i} className="timeline-row">
                <span className="timeline-country">
                  <span className="dot-not-filed" style={{ marginRight: 8 }} />
                  {g.inn}
                </span>
                <span className="timeline-authority text-muted">{g.authority}</span>
                <span className="timeline-date text-sm">
                  First: {g.first_approved
                    ? new Date(g.first_approved).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
                    : '—'}
                </span>
                <span className="timeline-lag">
                  <span className="badge badge-red">{g.condition}</span>
                </span>
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
    <div className="container section text-center">
      <Globe size={56} style={{ color: 'var(--teal-400)', margin: '0 auto 1rem' }} />
      <h2>No dashboard data yet for {code?.toUpperCase()}</h2>
      <p className="text-secondary mt-2" style={{ maxWidth: 480, margin: '0.75rem auto 0' }}>
        The nightly pipeline hasn't run for this country yet. Run the
        {' '}<code className="font-mono">02-ai-enrich</code> workflow to generate country dashboards.
      </p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Globe, Clock, X, Copy, Check, RefreshCw, Shield, FileText, Megaphone } from 'lucide-react';
import { getCountryDashboard } from '../lib/firebase';
import { callAiProxy } from '../lib/ai-proxy';
import { COUNTRY_DATA, accessEquityScore, incomeClassBadge } from '../lib/reference-data';

// ── Gap bottleneck classifier ─────────────────────────────────────────────────

type BottleneckType =
  | 'patent'
  | 'affordability'
  | 'regulatory-capacity'
  | 'manufacturer-choice'
  | 'recent'
  | 'unknown';

interface BottleneckInfo {
  label: string;
  badgeClass: string;
  description: string;
}

const BOTTLENECK_INFO: Record<BottleneckType, BottleneckInfo> = {
  patent:               { label: 'Patent Barrier',      badgeClass: 'badge-purple', description: 'Brand-only; generic entry pending patent expiry' },
  affordability:        { label: 'Affordability Gap',   badgeClass: 'badge-amber',  description: 'Price likely exceeds national reimbursement threshold' },
  'regulatory-capacity':{ label: 'Regulatory Lag',      badgeClass: 'badge-red',    description: 'Country regulatory agency has limited review bandwidth' },
  'manufacturer-choice':{ label: 'Manufacturer Gap',    badgeClass: 'badge-blue',   description: 'Manufacturer has not submitted in this market' },
  recent:               { label: 'Recently Approved',   badgeClass: 'badge-teal',   description: 'Approved globally <12 months ago; filing likely pending' },
  unknown:              { label: 'Gap Unclassified',    badgeClass: 'badge-outline', description: 'Insufficient data to classify barrier type' },
};

/** Heuristic gap classifier — replace with AI classification when data quality improves */
function classifyGap(gap: { first_approved?: string; condition?: string }, incomeClass: string): BottleneckType {
  if (!gap.first_approved) return 'unknown';
  const lagMonths = (Date.now() - new Date(gap.first_approved).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (lagMonths < 12)  return 'recent';
  const cond = (gap.condition || '').toLowerCase();
  if (cond.includes('oncolog') || cond.includes('rare'))          return 'patent';
  if (incomeClass === 'LIC' || incomeClass === 'LMIC')            return 'affordability';
  if (lagMonths > 60 && incomeClass === 'HIC')                    return 'manufacturer-choice';
  if (lagMonths > 24 && (incomeClass === 'LMIC' || incomeClass === 'LIC')) return 'regulatory-capacity';
  return 'unknown';
}

// ── Equity Score Card ─────────────────────────────────────────────────────────

function EquityScoreCard({ score }: { score: number }) {
  const color = score >= 75 ? 'var(--green-400)' : score >= 50 ? 'var(--amber-400)' : 'var(--red-400)';
  const label = score >= 75 ? 'Strong' : score >= 50 ? 'Moderate' : 'Critical';
  const barW  = `${score}%`;

  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="stat-value" style={{ color, fontSize: '1.75rem' }}>{score}</div>
      <div className="stat-label">Access Equity Score</div>
      <div style={{ marginTop: '0.5rem' }}>
        <div className="equity-bar-track">
          <div className="equity-bar-fill" style={{ width: barW, background: color }} />
        </div>
        <div className="stat-delta" style={{ color, marginTop: '0.25rem' }}>{label} · out of 100</div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CountryDashboard() {
  const { code }                = useParams<{ code: string }>();
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [aiModal, setAiModal]   = useState<{ title: string; content: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    getCountryDashboard(code.toUpperCase()).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [code]);

  const countryRef   = code ? COUNTRY_DATA[code.toUpperCase()] : null;
  const incomeClass  = countryRef?.income_class ?? 'HIC';

  const handleAI = async (task: string, title: string, extra?: object) => {
    if (!data) return;
    setIsGenerating(task);
    try {
      const content = await callAiProxy({
        task: task as any,
        payload: {
          country:      data.country_name,
          country_code: code?.toUpperCase(),
          income_class: incomeClass,
          gap_data:     data.top_gaps ?? [],
          stats: {
            drugs_behind_2yr:      data.lag_summary?.drugs_behind_2yr ?? 0,
            new_drugs_not_registered: data.new_drugs_not_registered ?? 0,
            pricing_percentile:    data.pricing_percentile ?? null,
            shortage_risk_high:    data.shortage_risk_high ?? 0,
          },
          ...extra,
        },
      });
      setAiModal({ title, content });
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
  const equity = accessEquityScore(lag.drugs_behind_2yr ?? 0, lag.total ?? 1);

  return (
    <>
      {/* Header */}
      <div className="drug-header">
        <div className="container">
          <Link to="/countries" className="btn btn-ghost btn-sm mb-4" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
            <Globe size={14} /> All Countries
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
              {data.country_name ?? code}
            </h1>
            <span className="badge badge-blue">{code?.toUpperCase()}</span>
            {countryRef && (
              <span className={`badge ${incomeClassBadge(incomeClass)}`}>
                {incomeClass}
              </span>
            )}
          </div>
          <p className="text-secondary text-sm">
            Pharmaceutical intelligence dashboard · Updated {data.updated_at
              ? new Date(data.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'recently'}
          </p>
        </div>
      </div>

      <div className="container section">

        {/* Summary cards */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          <div
            className="stat-card clickable-card"
            onClick={() => document.getElementById('access-gaps')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <div className="stat-value text-amber">{lag.drugs_behind_2yr ?? '0'}</div>
            <div className="stat-label">Drugs &gt;2yr behind</div>
            <div className="stat-delta">vs global first approval</div>
          </div>

          <div
            className="stat-card clickable-card highlight-card"
            onClick={() => document.getElementById('access-gaps')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <div className="stat-value text-red">{data.new_drugs_not_registered ?? '0'}</div>
            <div className="stat-label">New drugs not registered</div>
            <div className="stat-delta">approved globally in last 2 yrs</div>
          </div>

          <div className="stat-card">
            <div className="stat-value text-teal">
              {data.pricing_percentile != null ? `${data.pricing_percentile}th` : '—'}
            </div>
            <div className="stat-label">Pricing percentile</div>
            <div className="stat-delta">
              {data.pricing_percentile != null
                ? data.pricing_percentile <= 33
                  ? 'Lower-cost market ✓'
                  : data.pricing_percentile <= 66
                  ? 'Mid-range market'
                  : 'Higher-cost market'
                : 'globally for EML basket'}
            </div>
          </div>

          <EquityScoreCard score={equity} />
        </div>

        {/* AI Country Actions */}
        <div className="advocacy-grid mb-4" style={{ marginBottom: '1.5rem' }}>
          <div className="advocacy-card">
            <div className="flex items-center gap-3 mb-2">
              <FileText size={16} style={{ color: 'var(--blue-400)' }} />
              <h4 className="font-bold text-sm">Country Policy Brief</h4>
            </div>
            <p className="text-xs text-muted mb-3">
              Full pharmaceutical access report for this country — barriers, benchmarks, policy actions.
            </p>
            <button
              className="btn btn-outline btn-sm w-full"
              disabled={!!isGenerating}
              onClick={() => handleAI('country_narrative', `${data.country_name} Policy Brief`)}
            >
              {isGenerating === 'country_narrative' ? 'Generating…' : 'Generate Country Brief'}
            </button>
          </div>

          <div className="advocacy-card">
            <div className="flex items-center gap-3 mb-2">
              <Shield size={16} style={{ color: 'var(--amber-400)' }} />
              <h4 className="font-bold text-sm">Shortage Risk Assessment</h4>
            </div>
            <p className="text-xs text-muted mb-3">
              Supply chain vulnerability report for essential medicines in this country.
            </p>
            <button
              className="btn btn-outline btn-sm w-full"
              disabled={!!isGenerating}
              onClick={() => handleAI('shortage_risk', `${data.country_name} Shortage Risk`)}
            >
              {isGenerating === 'shortage_risk' ? 'Generating…' : 'Assess Shortage Risk'}
            </button>
          </div>

          <div className="advocacy-card">
            <div className="flex items-center gap-3 mb-2">
              <Megaphone size={16} style={{ color: 'var(--green-400)' }} />
              <h4 className="font-bold text-sm">Advocacy Action Plan</h4>
            </div>
            <p className="text-xs text-muted mb-3">
              Concrete advocacy steps, contacts to target, and draft messages for this country.
            </p>
            <button
              className="btn btn-outline btn-sm w-full"
              disabled={!!isGenerating}
              onClick={() => handleAI('advocacy_plan', `${data.country_name} Advocacy Plan`)}
            >
              {isGenerating === 'advocacy_plan' ? 'Generating…' : 'Build Advocacy Plan'}
            </button>
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
          <div id="access-gaps" className="card card-lg">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Clock size={18} style={{ color: 'var(--amber-400)' }} />
              <h3>Biggest Access Gaps</h3>
              <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>{gaps.length} drugs</span>
            </div>

            <div className="gap-table-header text-xs text-muted">
              <span>Drug (INN)</span>
              <span>First Approved</span>
              <span>Category</span>
              <span>Barrier Type</span>
              <span></span>
            </div>

            {gaps.map((g: any, i: number) => {
              const bottleneck = classifyGap(g, incomeClass);
              const info = BOTTLENECK_INFO[bottleneck];
              const lagYears = g.first_approved
                ? ((Date.now() - new Date(g.first_approved).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1)
                : null;

              return (
                <div key={i} className="gap-table-row">
                  <div className="gap-drug-name">
                    <span className="dot-not-filed" style={{ marginRight: 8 }} />
                    <Link to={`/drug/${g.inn}`} style={{ color: 'var(--teal-400)', fontWeight: 600 }}>
                      {g.inn}
                    </Link>
                  </div>

                  <div className="text-sm text-muted">
                    {g.first_approved
                      ? <>
                          {new Date(g.first_approved).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })}
                          {lagYears && <span className="badge badge-red" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>{lagYears}yr gap</span>}
                        </>
                      : '—'}
                  </div>

                  <div>
                    <span className="badge badge-outline text-xs" style={{ border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                      {g.condition ?? '—'}
                    </span>
                  </div>

                  <div title={info.description}>
                    <span className={`badge ${info.badgeClass} text-xs`}>{info.label}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={isGenerating === g.inn}
                      onClick={() => handleAI('drug_country_analysis',
                        `Analysis: ${g.inn} in ${data.country_name}`,
                        { drug: g.inn, gap_data: g }
                      )}
                    >
                      {isGenerating === g.inn ? '…' : 'Analyze'}
                    </button>
                  </div>
                </div>
              );
            })}

            <p className="text-xs text-muted mt-4">
              Barrier types are heuristic estimates based on income class, therapeutic category, and lag duration.
              Use "Analyze" for AI-generated per-drug assessment.
            </p>
          </div>
        )}

        {/* Shortage risk card */}
        {data.shortage_risk_high > 0 && (
          <div className="card mt-4" style={{ marginTop: '1.5rem', borderLeft: '3px solid var(--purple-400)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} style={{ color: 'var(--purple-400)' }} />
              <h4 className="font-bold">Supply Vulnerability</h4>
              <span className="badge badge-purple" style={{ marginLeft: 'auto' }}>
                {data.shortage_risk_high} high-risk drugs
              </span>
            </div>
            <p className="text-sm text-secondary">
              {data.shortage_risk_high} essential medicines in this country have high supply chain vulnerability —
              approved globally but with limited manufacturer diversity, indicating single-source dependency risk.
            </p>
            <button
              className="btn btn-ghost btn-sm mt-3"
              disabled={!!isGenerating}
              onClick={() => handleAI('shortage_risk', `${data.country_name} Supply Chain Risk`)}
            >
              {isGenerating === 'shortage_risk' ? 'Generating…' : 'Get Full Risk Assessment →'}
            </button>
          </div>
        )}
      </div>

      {/* AI Modal */}
      {aiModal && (
        <div
          className="ai-modal-overlay"
          onClick={() => setAiModal(null)}
          onKeyDown={(e) => e.key === 'Escape' && setAiModal(null)}
          tabIndex={-1}
        >
          <div
            className="ai-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="ai-modal-header">
              <h3 id="modal-title" className="font-bold">{aiModal.title}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setAiModal(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="ai-modal-body">
              <div className="ai-output-text">{aiModal.content}</div>
            </div>
            <div className="ai-modal-footer">
              <button className="btn btn-ghost" onClick={() => setAiModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => copyToClipboard(aiModal.content)}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Skeleton & States ─────────────────────────────────────────────────────────

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
      <RefreshCw size={56} style={{ color: 'var(--teal-400)', margin: '0 auto 1.5rem', animation: 'spin 4s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <h2>Intelligence pending for {code?.toUpperCase()}</h2>
      <p className="text-secondary mt-2" style={{ maxWidth: 520, margin: '1rem auto 2rem' }}>
        Our pipeline is processing global registration data for this country. Usually ready within 24 hours.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link to="/countries" className="btn btn-outline">All Countries</Link>
        <Link to="/new-drugs" className="btn btn-primary">Latest Approvals</Link>
      </div>
    </div>
  );
}

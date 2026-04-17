import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, TrendingDown, FileText, Send, X,
  Copy, Check, DollarSign, Zap, Users, TrendingUp, Shield, Megaphone,
} from 'lucide-react';
import { getDrug, getDrugApprovals, getDrugPrices } from '../lib/firebase';
import { callAiProxy, type AiTask } from '../lib/ai-proxy';
import {
  COUNTRY_DATA, getPopulationWithoutDrug, affordabilityDays,
} from '../lib/reference-data';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Drug {
  inn: string;
  brand_names: string | string[];
  drug_class: string;
  is_essential?: boolean;
  who_essential?: boolean;
  atc_code?: string;
  who_eml_section_display?: string;
  year_added_to_eml?: number;
  drugbank_id?: string;
  who_aware_category?: string;
  // Quick-facts fields (from drug_details.py seeder)
  originator_company?: string;
  indication?: string;
  patent_status?: 'originator' | 'generic_available' | 'biosimilar_available';
  patent_expired_year?: number;
  generic_manufacturers?: string[];
  formulations?: { form: string; strength: string; route: string }[];
  who_formulations?: string[];  // raw strings from WHO EML scraper (fallback)
  ai_summary?: string;
  ai_analytics?: {
    significance?: string;
    access_outlook?: string;
    alternatives?: string[];
    mechanism?: string;
    access_barriers?: string[];
    advocacy_angle?: string;
  };
}

interface Approval {
  country: string;
  authority: string;
  approval_date: string | null;
  lag_days: number | null;
  first_global?: string;
}

interface Price {
  country: string;
  id?: string;
  price: number;       // already converted to USD by pricing.py
  price_orig?: number; // original price in local currency (for display)
  currency: string;    // original currency code (for display label)
  unit: string;
  source: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const REGIONS: Record<string, string[]> = {
  'North America': ['USA', 'CAN'],
  'Europe':        ['GBR', 'DEU', 'FRA', 'ITA', 'ESP', 'AUT', 'BEL', 'NLD', 'POL', 'SWE', 'DNK', 'FIN', 'GRC', 'PRT'],
  'Asia-Pacific':  ['JPN', 'AUS', 'IND', 'LKA', 'BGD', 'PAK'],
  'Latin America': ['BRA'],
  'Africa':        ['ZAF', 'KEN', 'NGA'],
};

function buildRegionalSummary(prices: Price[]): { region: string; avg: number; min: number; max: number; count: number }[] {
  const result = [];
  for (const [region, codes] of Object.entries(REGIONS)) {
    const regionPrices = prices
      .filter(p => codes.includes(p.id || p.country))
      .map(p => p.price)  // already USD
      .filter(v => v > 0);
    if (regionPrices.length === 0) continue;
    const avg = regionPrices.reduce((a, b) => a + b, 0) / regionPrices.length;
    result.push({
      region,
      avg,
      min: Math.min(...regionPrices),
      max: Math.max(...regionPrices),
      count: regionPrices.length,
    });
  }
  return result.sort((a, b) => b.avg - a.avg);
}

function fmtUSD(v: number): string {
  if (v >= 1000) return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1)    return '$' + v.toFixed(2);
  return '$' + v.toFixed(2);
}

function lagColor(days: number | null): string {
  if (days === 0)                           return 'var(--green-400)';
  if (days !== null && days <= 365)        return 'var(--teal-400)';
  if (days !== null && days <= 730)        return 'var(--amber-400)';
  if (days !== null)                        return 'var(--red-400)';
  return 'var(--text-muted)';
}

function lagBadge(days: number | null): React.ReactElement {
  if (days === 0)        return <span className="badge badge-green">First global</span>;
  if (days !== null && days <= 365)
    return <span className="badge badge-teal">+{(days / 365).toFixed(1)} yr</span>;
  if (days !== null && days <= 730)
    return <span className="badge badge-amber">+{(days / 365).toFixed(1)} yrs</span>;
  if (days !== null)
    return <span className="badge badge-red">+{(days / 365).toFixed(1)} yrs ⚠</span>;
  return <span className="text-muted text-xs">Not registered</span>;
}

/** Group approvals by approval year → adoption over time */
function buildAdoptionCurve(approvals: Approval[]): { year: number; count: number; cumulative: number }[] {
  const yearMap: Record<number, number> = {};
  for (const a of approvals) {
    if (!a.approval_date) continue;
    const y = new Date(a.approval_date).getFullYear();
    yearMap[y] = (yearMap[y] || 0) + 1;
  }
  const years = Object.keys(yearMap).map(Number).sort();
  let cum = 0;
  return years.map(y => {
    cum += yearMap[y];
    return { year: y, count: yearMap[y], cumulative: cum };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Quick Facts card — originator, indication, formulations, patent status */
function QuickFacts({ drug, firstApproval }: { drug: Drug; firstApproval: Approval | undefined }) {
  const patentBadgeMap = {
    originator:           { cls: 'badge-red',   label: 'Under patent' },
    generic_available:    { cls: 'badge-green', label: 'Generic available' },
    biosimilar_available: { cls: 'badge-teal',  label: 'Biosimilar available' },
  } as const;
  const patentBadge = drug.patent_status ? patentBadgeMap[drug.patent_status] ?? null : null;

  const hasAnyFact = drug.originator_company || drug.indication || drug.formulations?.length || drug.who_formulations?.length || firstApproval?.approval_date;
  if (!hasAnyFact) return null;

  return (
    <div className="card card-lg mb-4" style={{ marginBottom: '1.5rem' }}>
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} style={{ color: 'var(--blue-400)' }} />
        <h3>Drug Overview</h3>
        {patentBadge && <span className={`badge ${patentBadge.cls}`} style={{ marginLeft: 'auto' }}>{patentBadge.label}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>

        {/* What it treats */}
        {drug.indication && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Treats / Indication
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{drug.indication}</div>
          </div>
        )}

        {/* Originator pharma */}
        {drug.originator_company && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Originator Company
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{drug.originator_company}</div>
            {drug.patent_expired_year && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {drug.patent_status === 'originator'
                  ? `Patent expires ~${drug.patent_expired_year}`
                  : `Patent expired ~${drug.patent_expired_year}`}
              </div>
            )}
          </div>
        )}

        {/* First global approval */}
        {firstApproval?.approval_date && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              First Global Approval
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {new Date(firstApproval.approval_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {COUNTRY_DATA[firstApproval.country]?.name ?? firstApproval.country} · {firstApproval.authority}
            </div>
          </div>
        )}

        {/* Generic manufacturers */}
        {drug.generic_manufacturers && drug.generic_manufacturers.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              {drug.patent_status === 'biosimilar_available' ? 'Biosimilar Makers' : 'Generic Makers'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {drug.generic_manufacturers.map(m => (
                <span key={m} className="badge badge-outline" style={{ fontSize: '0.72rem' }}>{m}</span>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Formulations — structured (drug_details.py) takes priority over WHO EML raw strings */}
      {(drug.formulations && drug.formulations.length > 0) ? (
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Available Formulations
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {drug.formulations.map((f, i) => (
              <div key={i} style={{
                padding: '0.4rem 0.75rem', borderRadius: 6,
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                fontSize: '0.8rem', color: 'var(--text-secondary)',
              }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{f.form}</span>
                <span style={{ color: 'var(--text-muted)', margin: '0 0.3rem' }}>·</span>
                {f.strength}
                <span style={{ color: 'var(--text-muted)', margin: '0 0.3rem' }}>·</span>
                {f.route}
              </div>
            ))}
          </div>
        </div>
      ) : drug.who_formulations && drug.who_formulations.length > 0 ? (
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Available Formulations <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.65rem' }}>(WHO EML)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {drug.who_formulations.map((f, i) => (
              <div key={i} style={{
                padding: '0.4rem 0.75rem', borderRadius: 6,
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                fontSize: '0.8rem', color: 'var(--text-secondary)',
              }}>
                {f}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Population Without Access Banner */
function AccessGapBanner({ approvals }: { approvals: Approval[] }) {
  const { totalM, topCountries } = getPopulationWithoutDrug(approvals);
  if (totalM === 0) return null;

  const pct = ((totalM / 8_100) * 100).toFixed(1);
  return (
    <div className="access-gap-banner">
      <div className="access-gap-icon">
        <Users size={22} />
      </div>
      <div>
        <div className="access-gap-headline">
          <strong>{totalM >= 1000 ? `${(totalM / 1000).toFixed(1)}B` : `${totalM}M`}</strong> people live in countries
          that have <strong>not approved</strong> this drug — {pct}% of the global population.
        </div>
        {topCountries.length > 0 && (
          <div className="access-gap-sub">
            Largest gaps: {topCountries.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

/** Lag Bar Chart — shows countries with real approval dates; summarises the rest */
function LagBarChart({ approvals }: { approvals: Approval[] }) {
  const [showPending, setShowPending] = React.useState(false);

  // Split into confirmed (have a real date) vs pending (in DB but no date yet)
  const confirmed = approvals.filter(a => a.approval_date);
  const pending   = approvals.filter(a => !a.approval_date);

  const maxLag = Math.max(
    365, // 1-year baseline minimum
    ...confirmed.filter(a => a.lag_days != null).map(a => a.lag_days as number),
  );

  if (confirmed.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Clock size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
        <p className="text-sm">No approval dates on record yet.</p>
        <p className="text-xs mt-2">Our pipeline is ingesting FDA, EMA EPAR, and WHO PQ data daily.</p>
      </div>
    );
  }

  return (
    <div className="lag-chart">
      {/* Confirmed approvals with real dates */}
      {confirmed.map(a => {
        const days = a.lag_days;
        const pct  = days != null ? Math.min((days / maxLag) * 100, 100) : 0;
        const color = lagColor(days);
        const ref  = COUNTRY_DATA[a.country];

        return (
          <div key={a.country} className="lag-chart-row">
            <div className="lag-chart-country">
              <span className="lag-chart-dot" style={{ background: color }} />
              <span className="font-bold text-sm">{ref?.name ?? a.country}</span>
              <span className="text-xs text-muted">{a.authority}</span>
            </div>
            <div className="lag-chart-track">
              <div
                className="lag-chart-bar"
                style={{ width: `${Math.max(pct, 1)}%`, background: color }}
                title={days === 0 ? 'First global approval' : `+${days} days`}
              />
              <span className="lag-chart-date text-xs text-muted">
                {new Date(a.approval_date!).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="lag-chart-badge">{lagBadge(days)}</div>
          </div>
        );
      })}

      {/* Pending / no-data countries — collapsed by default */}
      {pending.length > 0 && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowPending(s => !s)}
            style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          >
            {showPending ? '▲ Hide' : '▼ Show'} {pending.length} countries with no registration data
          </button>
          {showPending && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {pending.map(a => {
                const ref = COUNTRY_DATA[a.country];
                return (
                  <span key={a.country} className="badge badge-outline text-xs"
                    style={{ color: 'var(--text-muted)' }}>
                    {ref?.name ?? a.country}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Adoption Velocity — year-over-year country adoption */
function AdoptionVelocity({ approvals }: { approvals: Approval[] }) {
  const curve = buildAdoptionCurve(approvals);
  if (curve.length < 2) return null;

  const maxCum = curve[curve.length - 1].cumulative;
  const totalApproved = approvals.filter(a => a.approval_date).length;
  const totalCountries = approvals.length;
  const spreadPct = totalCountries > 0 ? Math.round((totalApproved / totalCountries) * 100) : 0;

  return (
    <div className="card card-lg mb-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} style={{ color: 'var(--blue-400)' }} />
        <h3>Global Adoption Velocity</h3>
        <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>
          {spreadPct}% country coverage
        </span>
      </div>
      <p className="text-xs text-muted mb-4">
        Cumulative countries approving this drug each year since first global approval.
      </p>
      <div className="adoption-chart">
        {curve.map(row => (
          <div key={row.year} className="adoption-row">
            <span className="adoption-year text-xs text-muted font-mono">{row.year}</span>
            <div className="adoption-track">
              <div
                className="adoption-bar"
                style={{ width: `${(row.cumulative / maxCum) * 100}%` }}
                title={`${row.cumulative} countries by end of ${row.year}`}
              />
            </div>
            <span className="adoption-count text-xs text-secondary">
              {row.cumulative} <span className="text-muted">(+{row.count})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Affordability indicator for a single price row */
function AffordabilityTag({ price, countryCode }: { price: number; countryCode: string }) {
  // price is already in USD (pricing.py converts before storing)
  const days = affordabilityDays(price, countryCode);
  const ref  = COUNTRY_DATA[countryCode];
  if (!ref || days === 0) return null;

  let cls = 'badge-green';
  let label = `${days.toFixed(0)}d wages`;
  if (days > 90)  { cls = 'badge-red';   label = `${days.toFixed(0)} days wages ⛔`; }
  else if (days > 30)  { cls = 'badge-amber'; label = `${days.toFixed(0)} days wages ⚠`; }
  else if (days > 5)   { cls = 'badge-teal';  }

  return <span className={`badge ${cls} text-xs`}>{label}</span>;
}

/** Regional Price Summary — average price by world region */
function RegionalPriceSummary({ prices }: { prices: Price[] }) {
  const regions = buildRegionalSummary(prices);
  if (regions.length < 2) return null;

  const globalMax = Math.max(...regions.map(r => r.avg));

  return (
    <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
      <h4 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.9rem' }}>
        Average Price by Region (USD equivalent)
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {regions.map(r => {
          const barPct = globalMax > 0 ? (r.avg / globalMax) * 100 : 0;
          return (
            <div key={r.region} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 80px', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{r.region}</span>
              <div style={{ background: 'var(--bg-glass)', borderRadius: 4, overflow: 'hidden', height: 6 }}>
                <div style={{ width: `${Math.max(barPct, 2)}%`, height: '100%', background: 'var(--blue-400)', borderRadius: 4 }} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {fmtUSD(r.avg)}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
                  {r.count} {r.count === 1 ? 'country' : 'countries'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Gap Severity Score — only meaningful when we have ≥3 confirmed approvals */
function GapSeverityScore({ approvals }: { approvals: Approval[] }) {
  const approved = approvals.filter(a => a.approval_date).length;
  const total    = approvals.length;
  if (approved < 3) return (
    <div className="stat-card">
      <div className="stat-value text-muted" style={{ fontSize: '1.25rem' }}>—</div>
      <div className="stat-label">Gap Severity / 10</div>
      <div className="stat-delta">Needs more country data</div>
    </div>
  );

  const unregistered  = total - approved;
  const avgLag        = approvals
    .filter(a => a.lag_days != null && a.lag_days > 0)
    .reduce((s, a) => s + (a.lag_days as number), 0) /
    Math.max(1, approvals.filter(a => a.lag_days != null && a.lag_days > 0).length);

  // Score: 0–10 based on unregistered % and average lag
  const unregScore = (unregistered / total) * 5;
  const lagScore   = Math.min((avgLag / 1825) * 5, 5);
  const score      = Math.round((unregScore + lagScore) * 10) / 10;

  const color = score >= 7 ? 'var(--red-400)' : score >= 4 ? 'var(--amber-400)' : 'var(--green-400)';
  const label = score >= 7 ? 'CRITICAL' : score >= 4 ? 'MODERATE' : 'LOW';

  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="stat-value" style={{ color, fontSize: '1.75rem' }}>{score.toFixed(1)}</div>
      <div className="stat-label">Gap Severity / 10</div>
      <div className="stat-delta" style={{ color }}>
        {label} · {unregistered} countries unregistered
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DrugProfile() {
  const { inn }                       = useParams<{ inn: string }>();
  const [drug, setDrug]               = useState<Drug | null>(null);
  const [approvals, setApprovals]     = useState<Approval[]>([]);
  const [prices, setPrices]           = useState<Price[]>([]);
  const [loading, setLoading]         = useState(true);
  const [aiModal, setAiModal]         = useState<{ title: string; content: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [chartView, setChartView]     = useState<'bars' | 'table'>('bars');

  useEffect(() => {
    if (!inn) return;
    setLoading(true);
    Promise.all([getDrug(inn), getDrugApprovals(inn), getDrugPrices(inn)]).then(([d, a, p]) => {
      setDrug(d as Drug | null);
      setApprovals((a as Approval[]).sort((x, y) =>
        (x.lag_days ?? Infinity) - (y.lag_days ?? Infinity)
      ));
      setPrices(p as Price[]);
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
          drug:         drug.inn,
          drug_class:   drug.drug_class,
          brand_names:  drug.brand_names,
          is_essential: drug.is_essential,
          approvals:    approvals.slice(0, 20),
          prices:       prices.slice(0, 10),
          ai_analytics: drug.ai_analytics,
          data: {
            first_approval:   approvals[0],
            total_approved:   approvals.filter(a => a.approval_date).length,
            total_countries:  approvals.length,
            avg_lag_days:     Math.round(
              approvals.filter(a => a.lag_days != null && a.lag_days > 0)
                       .reduce((s, a) => s + (a.lag_days as number), 0) /
              Math.max(1, approvals.filter(a => a.lag_days != null && a.lag_days > 0).length)
            ),
          },
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
  if (!drug)   return <NotFound inn={inn} />;

  const firstApproval    = approvals[0];
  const confirmedApprovals = approvals.filter(a => a.approval_date);
  const pendingApprovals   = approvals.filter(a => !a.approval_date);
  // Only call something "not registered" if we have solid global coverage data.
  // With sparse data, the absence is a data gap, not a confirmed registration gap.
  const hasGoodCoverage  = confirmedApprovals.length >= 3;
  const notRegistered    = hasGoodCoverage ? pendingApprovals.length : 0;
  // price is already USD (converted by pricing.py) — no toUSD() needed
  const pricesSorted   = [...prices].sort((a, b) => b.price - a.price);
  const maxPriceUSD    = pricesSorted.length > 0 ? pricesSorted[0].price : 0;
  const minPriceUSD    = pricesSorted.length > 0 ? pricesSorted[pricesSorted.length - 1].price : 0;
  const priceRatio     = minPriceUSD > 0 ? Math.round(maxPriceUSD / minPriceUSD) : 0;

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
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-teal">{drug.drug_class}</span>
            {(drug.who_essential || drug.is_essential) && (
              <span
                className="badge badge-green"
                title={drug.who_eml_section_display
                  ? `WHO EML — ${drug.who_eml_section_display}${drug.year_added_to_eml ? ` · Since ${drug.year_added_to_eml}` : ''}`
                  : 'WHO Essential Medicine'}
              >
                ✓ WHO Essential Medicine
                {drug.year_added_to_eml && (
                  <span style={{ opacity: 0.75, marginLeft: '0.3rem', fontSize: '0.7rem' }}>
                    since {drug.year_added_to_eml}
                  </span>
                )}
              </span>
            )}
            {drug.who_aware_category && (
              <span
                className={`badge ${
                  drug.who_aware_category === 'Access'  ? 'badge-green'  :
                  drug.who_aware_category === 'Watch'   ? 'badge-amber'  : 'badge-red'
                }`}
                title={`WHO AWaRe: ${drug.who_aware_category} — ${
                  drug.who_aware_category === 'Access'  ? 'First-line antibiotic for common infections' :
                  drug.who_aware_category === 'Watch'   ? 'Use only for specific indications (stewardship priority)' :
                                                          'Last-resort antibiotic — reserve for multidrug-resistant infections'
                }`}
              >
                AWaRe: {drug.who_aware_category}
              </span>
            )}
            {drug.atc_code && (
              <span className="badge badge-outline" title="ATC Classification Code" style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                {drug.atc_code}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container section">

        {/* Quick Facts — indication, originator, first approval, formulations */}
        <QuickFacts drug={drug} firstApproval={firstApproval} />

        {/* Population Without Access Banner */}
        <AccessGapBanner approvals={approvals} />

        {/* Summary stats */}
        <div className="grid-4 mb-4" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-value text-blue">{confirmedApprovals.length}</div>
            <div className="stat-label">Countries approved</div>
            <div className="stat-delta">
              {approvals.length > 0
                ? `${approvals.length} countries tracked`
                : 'No records yet'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-amber">
              {hasGoodCoverage ? notRegistered : '—'}
            </div>
            <div className="stat-label">Confirmed gaps</div>
            <div className="stat-delta">
              {hasGoodCoverage
                ? notRegistered > 0
                  ? `${Math.round((notRegistered / approvals.length) * 100)}% coverage gap`
                  : 'Full tracked coverage'
                : 'Insufficient data for gap analysis'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {firstApproval?.approval_date
                ? new Date(firstApproval.approval_date).getFullYear()
                : '—'}
            </div>
            <div className="stat-label">First global approval</div>
            <div className="stat-delta">
              {firstApproval
                ? `${COUNTRY_DATA[firstApproval.country]?.name ?? firstApproval.country} · ${firstApproval.authority}`
                : '—'}
            </div>
          </div>
          <GapSeverityScore approvals={approvals} />
        </div>

        {/* Clinical & Market Intelligence */}
        {(drug.ai_summary || drug.ai_analytics) && (
          <div className="card card-lg mb-4" style={{ borderLeft: '4px solid var(--teal-400)', marginBottom: '1.5rem' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap size={20} className="text-teal" />
              <h3 className="m-0">Clinical & Market Intelligence</h3>
            </div>

            <div className="grid-2 gap-8" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h4 className="text-xs uppercase tracking-widest text-muted mb-2">Therapeutic Significance</h4>
                <p className="text-secondary leading-relaxed">
                  {drug.ai_analytics?.significance || drug.ai_summary}
                </p>
              </div>
              {drug.ai_analytics?.access_outlook && (
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-muted mb-2">Global Access Outlook</h4>
                  <p className="text-secondary leading-relaxed">{drug.ai_analytics.access_outlook}</p>
                </div>
              )}
            </div>

            {drug.ai_analytics?.mechanism && (
              <div className="mb-4 p-3 rounded" style={{ background: 'var(--bg-glass)' }}>
                <h4 className="text-xs uppercase tracking-widest text-muted mb-1">Mechanism of Action</h4>
                <p className="text-sm text-secondary">{drug.ai_analytics.mechanism}</p>
              </div>
            )}

            {drug.ai_analytics?.access_barriers && drug.ai_analytics.access_barriers.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs uppercase tracking-widest text-muted mb-2">Key Access Barriers</h4>
                <div className="flex flex-wrap gap-2">
                  {drug.ai_analytics.access_barriers.map((b: string) => (
                    <span key={b} className="badge badge-red text-xs">{b}</span>
                  ))}
                </div>
              </div>
            )}

            {drug.ai_analytics?.alternatives && drug.ai_analytics.alternatives.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-xs uppercase tracking-widest text-muted mb-2">Therapeutic Alternatives</h4>
                <div className="flex flex-wrap gap-2">
                  {drug.ai_analytics.alternatives.map((alt: string) => (
                    <Link key={alt} to={`/drug/${alt}`} className="badge badge-outline text-xs" style={{ border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                      {alt}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {drug.ai_analytics?.advocacy_angle && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-xs uppercase tracking-widest text-muted mb-1">Advocacy Angle</h4>
                <p className="text-sm text-secondary italic">{drug.ai_analytics.advocacy_angle}</p>
              </div>
            )}
          </div>
        )}

        {/* Advocacy Toolkit */}
        <div className="mb-4" style={{ marginBottom: '1.5rem' }}>
          <h3 className="mb-4 text-teal">Advocacy Toolkit</h3>
          <div className="advocacy-grid">
            <div className="advocacy-card">
              <div className="flex items-center gap-4 mb-3">
                <div className="pillar-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--blue-400)', margin: 0 }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Policy Brief</h4>
                  <p className="text-xs text-muted">For Ministers & Health Economists</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                Structured brief with public health cost of delay, regulatory barriers, and 3 concrete policy actions.
              </p>
              <button
                className="btn btn-primary btn-sm w-full"
                disabled={!!isGenerating}
                onClick={() => handleAdvocacy('policy_brief', 'Policy Brief')}
              >
                {isGenerating === 'policy_brief' ? 'Generating…' : 'Generate Policy Brief'}
              </button>
            </div>

            <div className="advocacy-card">
              <div className="flex items-center gap-4 mb-3">
                <div className="pillar-icon" style={{ background: 'rgba(192,132,252,0.1)', color: 'var(--purple-400)', margin: 0 }}>
                  <Send size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Appeal Letter</h4>
                  <p className="text-xs text-muted">For Insurers & Formulary Boards</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                Clinical justification for reimbursement with cost-effectiveness evidence and patient impact.
              </p>
              <button
                className="btn btn-ghost btn-sm w-full"
                disabled={!!isGenerating}
                onClick={() => handleAdvocacy('appeal_letter', 'Insurance Appeal Letter')}
              >
                {isGenerating === 'appeal_letter' ? 'Generating…' : 'Generate Appeal Letter'}
              </button>
            </div>

            <div className="advocacy-card">
              <div className="flex items-center gap-4 mb-3">
                <div className="pillar-icon" style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--amber-400)', margin: 0 }}>
                  <Shield size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Supply Chain Risk</h4>
                  <p className="text-xs text-muted">For Procurement Agencies</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                Supply chain vulnerability assessment with stockout probability and buffer stock recommendations.
              </p>
              <button
                className="btn btn-ghost btn-sm w-full"
                disabled={!!isGenerating}
                onClick={() => handleAdvocacy('shortage_risk', 'Supply Chain Risk Report')}
              >
                {isGenerating === 'shortage_risk' ? 'Generating…' : 'Assess Supply Risk'}
              </button>
            </div>

            <div className="advocacy-card">
              <div className="flex items-center gap-4 mb-3">
                <div className="pillar-icon" style={{ background: 'rgba(74,222,128,0.1)', color: 'var(--green-400)', margin: 0 }}>
                  <Megaphone size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Advocacy Action Plan</h4>
                  <p className="text-xs text-muted">For Patient Advocates & NGOs</p>
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                Who to contact, key messages, international frameworks to cite, and draft social posts.
              </p>
              <button
                className="btn btn-ghost btn-sm w-full"
                disabled={!!isGenerating}
                onClick={() => handleAdvocacy('advocacy_plan', 'Advocacy Action Plan')}
              >
                {isGenerating === 'advocacy_plan' ? 'Generating…' : 'Build Advocacy Plan'}
              </button>
            </div>
          </div>
        </div>

        {/* Global Pricing Insights */}
        <div className="card card-lg mb-4" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <DollarSign size={18} style={{ color: 'var(--amber-400)' }} />
            <h3>Global Pricing Insights</h3>
            {priceRatio > 1 && (
              <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>
                {priceRatio}× price variance
              </span>
            )}
          </div>

          {prices.length > 0 ? (
            <>
              {/* Price gap summary — always shown when we have ≥2 countries */}
              {pricesSorted.length >= 2 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: '0.5rem',
                  alignItems: 'center',
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.9rem 1.1rem',
                  marginBottom: '1.25rem',
                }}>
                  {/* Cheapest */}
                  <div>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>Lowest price</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--green-400)', fontFamily: 'monospace' }}>
                      {fmtUSD(minPriceUSD)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {COUNTRY_DATA[pricesSorted[pricesSorted.length - 1].id || pricesSorted[pricesSorted.length - 1].country]?.name
                        ?? (pricesSorted[pricesSorted.length - 1].id || pricesSorted[pricesSorted.length - 1].country)}
                    </div>
                  </div>
                  {/* Ratio */}
                  <div style={{ textAlign: 'center', padding: '0 0.5rem' }}>
                    {priceRatio > 1 && (
                      <>
                        <div style={{
                          fontSize: '1.4rem',
                          fontWeight: 800,
                          color: priceRatio >= 50 ? 'var(--red-400)' : priceRatio >= 10 ? 'var(--amber-400)' : 'var(--teal-400)',
                          fontFamily: 'monospace',
                          lineHeight: 1,
                        }}>{priceRatio}×</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>price gap</div>
                      </>
                    )}
                  </div>
                  {/* Most expensive */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>Highest price</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: priceRatio >= 10 ? 'var(--red-400)' : 'var(--amber-400)', fontFamily: 'monospace' }}>
                      {fmtUSD(maxPriceUSD)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {COUNTRY_DATA[pricesSorted[0].id || pricesSorted[0].country]?.name
                        ?? (pricesSorted[0].id || pricesSorted[0].country)}
                    </div>
                  </div>
                </div>
              )}

              {priceRatio >= 5 && (
                <div className="financial-toxicity-alert mb-4">
                  <TrendingDown size={16} />
                  <span>
                    <strong>{priceRatio >= 50 ? 'Extreme Price Inequity:' : priceRatio >= 10 ? 'Financial Toxicity Alert:' : 'Significant Price Gap:'}</strong>{' '}
                    {COUNTRY_DATA[pricesSorted[0].id || pricesSorted[0].country]?.name ?? pricesSorted[0].country} charges {priceRatio}× more
                    ({fmtUSD(maxPriceUSD)}) than {COUNTRY_DATA[pricesSorted[pricesSorted.length - 1].id || pricesSorted[pricesSorted.length - 1].country]?.name ?? pricesSorted[pricesSorted.length - 1].country} ({fmtUSD(minPriceUSD)})
                    for the same drug.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {pricesSorted.map((p, idx) => {
                  const countryCode = p.id || p.country;
                  // p.price is already USD; p.price_orig is local currency
                  const barPct = maxPriceUSD > 0 ? (p.price / maxPriceUSD) * 100 : 0;
                  const isCheapest = idx === pricesSorted.length - 1 && pricesSorted.length >= 2;
                  const isMostExp  = idx === 0 && pricesSorted.length >= 2;
                  const displayOrig = p.price_orig != null
                    ? `${p.currency} ${p.price_orig.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : null;
                  return (
                    <div key={countryCode} className="price-row" style={isCheapest ? { background: 'rgba(52,211,153,0.05)', borderRadius: 6 } : isMostExp ? { background: 'rgba(248,113,113,0.04)', borderRadius: 6 } : undefined}>
                      <span className="price-country font-bold text-sm">
                        {isCheapest && <span style={{ color: 'var(--green-400)', marginRight: 4 }}>↓</span>}
                        {isMostExp  && <span style={{ color: 'var(--red-400)',   marginRight: 4 }}>↑</span>}
                        {COUNTRY_DATA[countryCode]?.name ?? countryCode}
                      </span>
                      <div className="price-bar-track">
                        <div className="price-bar" style={{
                          width: `${Math.max(barPct, 2)}%`,
                          background: isCheapest ? 'var(--green-400)' : isMostExp ? 'var(--red-400)' : 'var(--teal-400)',
                        }} />
                      </div>
                      <div className="price-value">
                        {/* Show original local-currency price if available, else USD */}
                        <span className="text-teal font-mono">{displayOrig ?? fmtUSD(p.price)}</span>
                        {displayOrig && <span className="text-xs text-muted" style={{ display: 'block' }}>{fmtUSD(p.price)}</span>}
                        <span className="text-xs text-muted">{p.unit}</span>
                      </div>
                      <div className="price-affordability">
                        <AffordabilityTag price={p.price} countryCode={countryCode} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <RegionalPriceSummary prices={prices} />
              <p className="text-xs text-muted mt-4">
                "Days wages" = cost as a multiple of local daily minimum wage (ILO 2024).
                Reference prices: WHO GPRM, NHS Drug Tariff, GoodRx, MSF, UNICEF. Approximate USD conversion used.
                ↓ cheapest · ↑ most expensive.
              </p>
            </>
          ) : (
            <div className="text-center p-8 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--bg-glass)', borderStyle: 'dashed' }}>
              <DollarSign size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
              <h4 className="text-secondary">No global reference data yet</h4>
              <p className="text-xs text-muted mt-1">Our pipeline is indexing pricing for this molecule. Essential generics are prioritised.</p>
            </div>
          )}
        </div>

        {/* Adoption Velocity */}
        <AdoptionVelocity approvals={approvals} />

        {/* Approval Timeline */}
        <div className="card card-lg">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Clock size={18} style={{ color: 'var(--teal-400)' }} />
            <h3>Approval Timeline</h3>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn btn-sm ${chartView === 'bars' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setChartView('bars')}
              >
                Visual
              </button>
              <button
                className={`btn btn-sm ${chartView === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setChartView('table')}
              >
                Table
              </button>
            </div>
          </div>

          {approvals.length === 0 ? (
            <p className="text-muted">No approval data available yet.</p>
          ) : chartView === 'bars' ? (
            <LagBarChart approvals={approvals} />
          ) : (
            <div>
              {approvals.map(a => (
                <div key={a.country} className="timeline-row">
                  <span className="timeline-country">
                    <span className={a.approval_date ? 'dot-approved' : 'dot-not-filed'} style={{ marginRight: 8 }} />
                    {COUNTRY_DATA[a.country]?.name ?? a.country}
                  </span>
                  <span className="timeline-authority text-muted">{a.authority}</span>
                  <span className="timeline-date">
                    {a.approval_date
                      ? new Date(a.approval_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
                      : <span className="text-muted">Not registered</span>}
                  </span>
                  <span className="timeline-lag">{lagBadge(a.lag_days ?? null)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
              <button className="btn btn-ghost btn-sm" onClick={() => setAiModal(null)} aria-label="Close modal">
                <X size={16} />
              </button>
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

// ── Skeleton & Error ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="container section">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" style={{ width: '40%' }} />
      <div className="grid-4" style={{ marginTop: '2rem' }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
      </div>
      <div className="skeleton" style={{ height: 300, marginTop: '1.5rem', borderRadius: 12 }} />
    </div>
  );
}

function NotFound({ inn }: { inn?: string }) {
  return (
    <div className="container section text-center" style={{ padding: '6rem 2rem' }}>
      <div className="pillar-icon" style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--red-400)', margin: '0 auto 1.5rem', width: 64, height: 64 }}>
        <X size={32} />
      </div>
      <h2>Drug not found: {inn}</h2>
      <p className="text-secondary mt-2" style={{ maxWidth: 480, margin: '1rem auto 2rem' }}>
        We couldn't find intelligence data for this molecule yet. It may be under a different INN,
        or our pipeline hasn't indexed it yet.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link to="/" className="btn btn-ghost">Back to Dashboard</Link>
        <Link to="/new-drugs" className="btn btn-primary">Browse Recent Approvals</Link>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import {
  Clock, Globe, Activity, DollarSign, AlertTriangle, FileText, BarChart2, TrendingUp,
} from 'lucide-react';

const pillars = [
  { icon: <Clock size={20} />,         title: 'Approval Lag Monitor',    desc: 'Visual bar chart: how many years behind is each country for any drug?',        href: '/countries', color: '#3b82f6' },
  { icon: <Globe size={20} />,         title: 'Therapeutic Landscape',   desc: 'What does your country use for a condition vs. the global standard?',           href: '/countries', color: '#6366f1' },
  { icon: <Activity size={20} />,      title: 'New Drug Radar',          desc: 'New approvals globally — see HIC vs. LMIC coverage gaps at a glance.',          href: '/new-drugs',  color: '#a78bfa' },
  { icon: <DollarSign size={20} />,    title: 'Affordability Index',     desc: 'Price expressed as days of local minimum wage — not just a number.',             href: '/countries', color: '#f59e0b' },
  { icon: <BarChart2 size={20} />,     title: 'Country Dashboard',       desc: 'Access Equity Score, gap severity, bottleneck classification per country.',      href: '/countries', color: '#10b981' },
  { icon: <AlertTriangle size={20} />, title: 'Shortage Risk Radar',     desc: 'Supply chain vulnerability score for essential medicines per country.',          href: '/countries', color: '#fb7185' },
  { icon: <FileText size={20} />,      title: 'Advocacy Action Engine',  desc: 'Generate policy briefs, appeal letters, and advocacy plans using AI.',           href: '/countries', color: '#60a5fa' },
];

const stats = [
  { num: '80+',    label: 'Countries tracked' },
  { num: '2B+',    label: 'People without access' },
  { num: '8yr',    label: 'Avg LMIC lag' },
  { num: '40×',    label: 'Max price disparity' },
];

/** Static Innovation Equity Index — replace with live Firestore query when available */
const innovationGaps = [
  { area: 'HIV/AIDS',         hic: '8mo',  lmic: '14mo', equity: 75, status: 'improving' },
  { area: 'Cardiovascular',   hic: '10mo', lmic: '38mo', equity: 42, status: 'stagnant'  },
  { area: 'Oncology',         hic: '6mo',  lmic: '52mo', equity: 20, status: 'worsening' },
  { area: 'Diabetes',         hic: '9mo',  lmic: '34mo', equity: 47, status: 'stagnant'  },
  { area: 'Rare Diseases',    hic: '18mo', lmic: 'never', equity: 5,  status: 'critical'  },
];

function equityColor(score: number) {
  if (score >= 65) return 'var(--emerald-400)';
  if (score >= 40) return 'var(--amber-400)';
  return 'var(--rose-400)';
}

function statusBadge(status: string) {
  if (status === 'improving') return <span className="badge badge-green text-xs">↑ improving</span>;
  if (status === 'worsening') return <span className="badge badge-red text-xs">↓ worsening</span>;
  if (status === 'critical')  return <span className="badge badge-red text-xs">⛔ critical</span>;
  return <span className="badge badge-amber text-xs">→ stagnant</span>;
}

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-eyebrow">🔬 Open Global Medicine Intelligence</div>
          <h1 className="hero-title">
            The Medicine Gap is<br />
            <span className="accent">Real. Now It's Visible.</span>
          </h1>
          <p className="hero-subtitle">
            MediLens tracks where every drug is approved, what it costs relative to local wages,
            and which patients are being left behind — for patients, advocates, and policy professionals.
            Free. Forever.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/countries" className="btn btn-primary">Explore Dashboards →</Link>
            <Link to="/new-drugs" className="btn btn-outline">New Drug Radar</Link>
          </div>
          <div className="hero-stats">
            {stats.map(s => (
              <div key={s.label}>
                <div className="hero-stat-num">{s.num}</div>
                <div className="hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seven pillars */}
      <section className="section">
        <div className="container">
          <h2 className="text-center mb-4" style={{ marginBottom: '0.5rem' }}>Seven Intelligence Pillars</h2>
          <p className="text-center text-secondary" style={{ marginBottom: '2.5rem', maxWidth: 560, margin: '0 auto 2.5rem' }}>
            Each pillar delivers standalone insight. Select a country to unlock a personalised view across all seven at once.
          </p>
          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {pillars.map(p => (
              <Link key={p.title} to={p.href} className="pillar-card">
                <div className="pillar-icon" style={{ background: `${p.color}18`, border: `1px solid ${p.color}30` }}>
                  <span style={{ color: p.color }}>{p.icon}</span>
                </div>
                <div className="pillar-title">{p.title}</div>
                <div className="pillar-desc">{p.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Innovation Equity Index */}
      <section className="section" style={{ background: 'var(--card-bg)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={20} style={{ color: 'var(--blue-400)' }} />
            <h2>Innovation Equity Index</h2>
          </div>
          <p className="text-secondary mb-4" style={{ marginBottom: '1.5rem', maxWidth: 640 }}>
            How long does it take for new drugs to reach high-income vs. lower-income countries?
            The gap varies dramatically by therapeutic area.
          </p>

          <div className="card card-lg">
            <div className="equity-index-header text-xs text-muted mb-3" style={{ marginBottom: '1rem' }}>
              <span>Therapeutic Area</span>
              <span>HIC avg lag</span>
              <span>LMIC avg lag</span>
              <span style={{ flex: 2 }}>Equity Score</span>
              <span>Trend</span>
            </div>
            {innovationGaps.map(row => {
              const color = equityColor(row.equity);
              return (
                <div key={row.area} className="equity-index-row">
                  <span className="font-bold text-sm">{row.area}</span>
                  <span className="text-xs text-muted font-mono">{row.hic}</span>
                  <span className="text-xs font-mono" style={{ color }}>{row.lmic}</span>
                  <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="equity-bar-track" style={{ flex: 1 }}>
                      <div className="equity-bar-fill" style={{ width: `${row.equity}%`, background: color }} />
                    </div>
                    <span className="text-xs font-mono" style={{ color, minWidth: 32 }}>{row.equity}</span>
                  </div>
                  <div>{statusBadge(row.status)}</div>
                </div>
              );
            })}
            <p className="text-xs text-muted mt-4">
              Equity Score: 100 = no lag gap between HIC and LMIC. 0 = LMIC never receives drug.
              Data estimated from pipeline averages — live computation launching in next release.
            </p>
          </div>

          <div className="flex gap-4 mt-4" style={{ marginTop: '1.5rem' }}>
            <Link to="/countries" className="btn btn-outline btn-sm">Explore by Country →</Link>
            <Link to="/new-drugs"  className="btn btn-ghost btn-sm">New Drug Radar</Link>
          </div>
        </div>
      </section>

      {/* EU/UK Focus Spotlight */}
      <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <div className="grid-2 align-center gap-12">
            <div>
              <div className="badge badge-blue mb-4">🌍 Regional Focus</div>
              <h2 className="mb-4">European & UK Intelligence</h2>
              <p className="text-secondary leading-relaxed mb-6">
                MediLens provides enhanced coverage of the <strong>EU27 and United Kingdom</strong> markets.
                Our pipeline tracks timelines from <strong>EMA and MHRA</strong>, benchmarked against
                real-world reimbursement data from the <strong>NHS Drug Tariff</strong> and Lauer-Taxe.
              </p>
              <div className="flex gap-4">
                <Link to="/country/GBR" className="btn btn-outline btn-sm">UK / MHRA View →</Link>
                <Link to="/country/DEU" className="btn btn-outline btn-sm">Germany / EMA View →</Link>
              </div>
            </div>
            <div className="card text-center" style={{ border: '1px solid var(--blue-400)', background: 'rgba(59,130,246,0.05)' }}>
              <h4 className="text-blue-400 mb-2">UK Access Index</h4>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>14.2 Mo.</div>
              <p className="text-xs text-muted font-mono">AVG GBR APPROVAL LAG (2025)</p>
              <hr className="my-4" style={{ borderColor: 'var(--border)' }} />
              <p className="text-xs text-secondary">Sourced from MHRA Registration Data</p>
            </div>
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section className="section" style={{ borderTop: '1px solid var(--border)', paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="container">
          <p className="text-center text-xs text-muted mb-4" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>
            Data sourced from
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
            {['FDA openFDA', 'EMA', 'WHO Prequalification', 'CMS NADAC', 'NHS Drug Tariff',
              'ILO ILOSTAT', 'UN Population', 'WHO EML', 'Health Canada', 'TGA Australia', 'ANVISA Brazil'
            ].map(src => (
              <span key={src} className="badge badge-teal">{src}</span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

import { Link } from 'react-router-dom';
import {
  Clock, Globe, Zap, DollarSign, AlertTriangle, FileText, BarChart2
} from 'lucide-react';

const pillars = [
  { icon: <Clock size={22} />, title: 'Approval Lag Monitor',      desc: 'How many years behind is your country for this drug?',          href: '/drug/semaglutide', color: '#2dd4bf' },
  { icon: <Globe size={22} />, title: 'Therapeutic Landscape',     desc: 'What does your country use for a condition vs. others?',         href: '/country/USA',      color: '#60a5fa' },
  { icon: <Zap size={22} />,   title: 'New Drug Radar',            desc: 'What new drugs were approved globally? Which reached you?',      href: '/new-drugs',        color: '#c084fc' },
  { icon: <DollarSign size={22} />, title: 'Global Pricing',       desc: 'What does this drug cost worldwide? Where does your country rank?', href: '/country/USA',   color: '#fbbf24' },
  { icon: <BarChart2 size={22} />, title: 'Country Dashboard',     desc: 'A complete pharmaceutical intelligence view for your country.',   href: '/country/USA',      color: '#4ade80' },
  { icon: <AlertTriangle size={22} />, title: 'Shortage Risk Radar', desc: 'Which essential drugs are at risk of going out of stock?',      href: '/country/USA',      color: '#f87171' },
  { icon: <FileText size={22} />, title: 'Advocacy Action Engine', desc: 'Generate policy briefs and insurance appeal letters with AI.',   href: '/country/USA',      color: '#fb923c' },
];

const stats = [
  { num: '80+',    label: 'Countries' },
  { num: '2B+',    label: 'People without access' },
  { num: '8yr',    label: 'Avg lag for LMIC' },
  { num: '40×',    label: 'Max price disparity' },
];

export default function Home() {
  return (
    <>
      {/* Hero ──────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="hero-eyebrow">
            🔬 Open Global Medicine Intelligence
          </div>
          <h1 className="hero-title">
            The Medicine Gap is<br />
            <span className="accent">Real. Now It's Visible.</span>
          </h1>
          <p className="hero-subtitle">
            MediLens tracks where every drug is approved, what it costs round the world,
            and which patients are being left behind — for patients, advocates, and
            policy professionals. Free. Forever.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/country/USA" className="btn btn-primary">
              Explore Country Dashboard →
            </Link>
            <Link to="/new-drugs" className="btn btn-outline">
              New Drug Radar
            </Link>
          </div>

          {/* Key stats */}
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

      {/* Seven pillars ─────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <h2 className="text-center mb-4" style={{ marginBottom: '0.5rem' }}>Seven Intelligence Pillars</h2>
          <p className="text-center text-secondary mb-4" style={{ marginBottom: '2.5rem', maxWidth: 560, margin: '0 auto 2.5rem' }}>
            Each pillar delivers standalone value. Select your country to unlock a personalised view across all seven at once.
          </p>

          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {pillars.map((p) => (
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

      {/* Data sources ribbon ───────────────────────────────── */}
      <section className="section" style={{ borderTop: '1px solid var(--border)', paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="container">
          <p className="text-center text-xs text-muted mb-4" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>
            Data sourced from
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
            {['FDA openFDA', 'EMA', 'WHO Prequalification', 'CMS NADAC', 'NHS Drug Tariff', 'Health Canada', 'TGA Australia', 'ANVISA Brazil'].map(src => (
              <span key={src} className="badge badge-teal">{src}</span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

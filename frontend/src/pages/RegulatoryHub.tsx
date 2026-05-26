import { useState } from 'react';
import { Shield, Users, Compass, ChevronRight, Award, HelpCircle, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const PATHWAYS = [
  {
    country: 'Kenya / East Africa (PPB)',
    steps: [
      { name: 'Dossier Submission', time: '1–2 Months', desc: 'Manufacturer submits the Common Technical Document (CTD) dossier to the Pharmacy and Poisons Board.' },
      { name: 'Technical Evaluation', time: '6–12 Months', desc: 'Clinical safety, efficacy data, and bioequivalence records are thoroughly analyzed by the board.' },
      { name: 'Local GMP Audit', time: '3–6 Months', desc: 'Good Manufacturing Practices (GMP) audit of the production facility is completed or verified.' },
      { name: 'Registration Decision', time: '1–2 Months', desc: 'Marketing Authorization is granted and the drug is gazetted for local distribution.' },
      { name: 'KEMSA / Public Tender', time: '3–9 Months', desc: 'Listed on the national essential medicines procurement registry for public hospital supply.' }
    ]
  },
  {
    country: 'India (CDSCO)',
    steps: [
      { name: 'IND / Clinical Filing', time: '2–3 Months', desc: 'Filing of new drug registration application at the Central Drugs Standard Control Organisation.' },
      { name: 'SEC Expert Review', time: '4–8 Months', desc: 'Subject Expert Committees (SEC) evaluate safety, dosage parameters, and ethnicity-specific clinical trials.' },
      { name: 'Quality Lab Testing', time: '2–4 Months', desc: 'Central Drugs Laboratory (CDL) conducts molecular purity, safety validation, and batch consistency testing.' },
      { name: 'Approval & Pricing', time: '3–6 Months', desc: 'Approved for marketing; retail pricing is capped by the National Pharmaceutical Pricing Authority (NPPA).' }
    ]
  },
  {
    country: 'European Union (EMA)',
    steps: [
      { name: 'EPAR Submission', time: '1 Month', desc: 'Scientific review request submitted to the Committee for Medicinal Products for Human Use (CHMP).' },
      { name: 'Scientific Assessment', time: '7–9 Months', desc: 'Rigorous central scientific review of chemical, preclinical, and clinical trial dossiers.' },
      { name: 'EC Commission Decision', time: '2 Months', desc: 'European Commission issues formal legally-binding Marketing Authorization for all EU27 markets.' },
      { name: 'HTA / National Listing', time: '3–18 Months', desc: 'Individual member states (e.g. G-BA in Germany) complete pricing assessments and national health insurance inclusion.' }
    ]
  },
  {
    country: 'United States (FDA)',
    steps: [
      { name: 'NDA Filing', time: '2 Months', desc: 'Sponsor submits the New Drug Application (NDA) or Biologics License Application (BLA).' },
      { name: 'CDER Technical Review', time: '6–10 Months', desc: 'Comprehensive safety, statistical, pharmacology, and clinical reviews by FDA scientists.' },
      { name: 'Manufacturing Inspection', time: '2–4 Months', desc: 'Rigorous pre-approval safety inspection of the pharmaceutical production plant.' },
      { name: 'FDA Approval', time: '1 Month', desc: 'Formal approval granted; commercial launch and post-market safety surveillance begin.' }
    ]
  }
];

const DIRECTORY = [
  { name: 'MSF Access Campaign', role: 'Global Essential Meds Lobbying', desc: 'Secures access, low prices, and pipeline research for vaccines, diagnostics, and essential medicines in LMICs.', link: 'https://msfaccess.org' },
  { name: 'Medicines Patent Pool (MPP)', role: 'Voluntary Licensing Broker', desc: 'United Nations-backed body negotiating public health licenses with originator companies to allow global generic production.', link: 'https://medicinespatentpool.org' },
  { name: 'UAEM', role: 'Student & Academic Coalition', desc: 'Universities Allied for Essential Medicines campaigns to ensure biomedical innovations funded by universities are licensed affordably.', link: 'https://uaem.org' },
  { name: 'Cancer Alliance', role: 'Oncology Access & Price Lobbying', desc: 'Coordinated coalition of patient advocates battling for affordable cancer therapies and patent law reforms.', link: 'https://www.canceralliance.co.za' }
];

export default function RegulatoryHub() {
  const [activeTab, setActiveTab] = useState<'navigator' | 'reliance' | 'trips' | 'directory'>('navigator');
  const [selectedPathway, setSelectedPathway] = useState(0);

  return (
    <div className="container section">
      {/* Hero Header */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div className="hero-eyebrow" style={{ margin: '0 auto 1rem' }}>📣 NGO & Patient Advocacy Center</div>
        <h1 className="hero-title" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
          Demystifying the Drug <span className="accent">Approval Process</span>
        </h1>
        <p className="text-secondary" style={{ maxWidth: 640, margin: '1rem auto 1.5rem', lineHeight: 1.75 }}>
          Hello advocate! Navigating health ministries, drug registries, and patents can feel incredibly overwhelming. 
          This hub is your guide to understanding how medicines are approved, how governments can fast-track access 
          using international frameworks, and where you can join forces.
        </p>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          {([
            { key: 'navigator', label: 'Pathway Navigator', icon: <Compass size={14} /> },
            { key: 'reliance',  label: 'Fast-Track Reliance', icon: <Award size={14} /> },
            { key: 'trips',     label: 'Patent Options & TRIPS', icon: <Shield size={14} /> },
            { key: 'directory', label: 'NGO Collaborators', icon: <Users size={14} /> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab(tab.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Pathway Navigator */}
      {activeTab === 'navigator' && (
        <div className="grid-2 gap-8" style={{ alignItems: 'start' }}>
          {/* Pathway Selector */}
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass style={{ color: 'var(--blue-400)' }} /> Select Regulatory Agency
            </h3>
            <p className="text-secondary text-sm mb-4" style={{ marginBottom: '1.5rem' }}>
              Every country evaluates drugs differently. Select an agency below to view its simplified technical timeline from initial file submission to local launch:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {PATHWAYS.map((p, idx) => (
                <button
                  key={p.country}
                  onClick={() => setSelectedPathway(idx)}
                  className={`btn ${selectedPathway === idx ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ justifyContent: 'space-between', padding: '0.75rem 1rem', width: '100%' }}
                >
                  <span style={{ fontWeight: 600 }}>{p.country}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </div>

          {/* Visual Timeline display */}
          <div className="card card-lg" style={{ borderLeft: '3px solid var(--blue-500)' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>
              {PATHWAYS[selectedPathway].country} approval Timeline
            </h3>
            <p className="text-secondary text-xs mb-8" style={{ marginBottom: '2rem' }}>
              Average progression stages for novel molecular approvals. Highlighting estimated administrative delay.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
              {/* Vertical line connector */}
              <div style={{
                position: 'absolute', left: '16px', top: '10px', bottom: '10px',
                width: '2px', background: 'var(--border-strong)', zIndex: 1
              }} />

              {PATHWAYS[selectedPathway].steps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 2 }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: 'var(--bg-elevated)', border: '2px solid var(--blue-500)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', color: 'var(--blue-400)', flexShrink: 0
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{step.name}</span>
                      <span className="badge badge-teal text-xs" style={{ fontSize: '0.65rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                        <Clock size={10} /> {step.time} avg.
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-2" style={{ marginTop: '0.25rem', lineHeight: 1.6 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Fast-Track Reliance */}
      {activeTab === 'reliance' && (
        <div className="card card-lg" style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <Award size={28} style={{ color: 'var(--teal-400)' }} />
            <h2>The Regulatory Reliance Pathway</h2>
          </div>
          <p className="text-secondary leading-relaxed" style={{ marginBottom: '1.5rem' }}>
            Do you represent an NGO in a developing country with limited drug review resources? You don't have to wait years for your local agency to review thousand-page clinical dossiers! 
            Under the <strong>WHO Regulatory Reliance Framework</strong>, small local drug registries can instantly adopt reviews already completed by "Stringent Regulatory Authorities" (like the FDA or EMA).
          </p>

          <div className="access-gap-banner" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            <CheckCircle size={22} style={{ color: 'var(--teal-400)', marginTop: '2px' }} />
            <div>
              <div className="access-gap-headline"><strong>The 90-Day Acceleration</strong></div>
              <div className="access-gap-sub">
                Instead of conducting an independent review from scratch (which takes an average of <strong>2.5 years</strong> in most LMICs), the local agency simply verifies the FDA/EMA certificate and grants approval in <strong>under 90 days</strong>.
              </div>
            </div>
          </div>

          <h3 style={{ marginBottom: '1rem' }}>How You Can Campaign for This:</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card card-sm bg-elevated">
              <div className="font-bold text-sm text-blue mb-1">1. Identify Eligible Medications</div>
              <p className="text-xs text-muted leading-relaxed">
                Use the MediLens <strong>New Drug Radar</strong> to find drugs approved in the US/EU (flagged as HIC-only) that are currently missing in your country.
              </p>
            </div>
            <div className="card card-sm bg-elevated">
              <div className="font-bold text-sm text-blue mb-1">2. Draft a Reliance Petition</div>
              <p className="text-xs text-muted leading-relaxed">
                Go to your Country Dashboard and click <strong>📢 Build Advocacy Action Plan</strong> or use the <strong>Appeal Letter</strong> tool. The AI will cite the WHO Reliance Framework and draft a formal proposal tailored for your health minister.
              </p>
            </div>
            <div className="card card-sm bg-elevated">
              <div className="font-bold text-sm text-blue mb-1">3. Lobby Your Health Committee</div>
              <p className="text-xs text-muted leading-relaxed">
                Coordinate with local medical societies (e.g. oncology leagues, diabetes associations) to joint-sign the appeal, presenting a clear, united case study on clinical lag times.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Patent Options & TRIPS */}
      {activeTab === 'trips' && (
        <div className="card card-lg" style={{ maxWidth: 840, margin: '0 auto', borderLeft: '3px solid var(--amber-500)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
            <Shield size={28} style={{ color: 'var(--amber-400)' }} />
            <h2>Patent Gaps & WTO TRIPS Flexibilities</h2>
          </div>
          <p className="text-secondary leading-relaxed" style={{ marginBottom: '1.5rem' }}>
            When a life-saving drug is priced out of reach due to strict patent monopolies, advocates can look to international law. 
            Under the World Trade Organization's <strong>TRIPS Agreement (Declaration on Public Health)</strong>, governments possess the absolute sovereign right to bypass patent restrictions to protect national health.
          </p>

          <div className="financial-toxicity-alert" style={{ marginBottom: '2rem' }}>
            <HelpCircle size={22} style={{ color: 'var(--amber-400)', marginTop: '2px' }} />
            <div>
              <div className="font-bold">What is a Compulsory License?</div>
              <p style={{ marginTop: '0.25rem' }}>
                It is a formal decree issued by a government allowing local generic manufacturers to produce (or import) affordable, high-quality generic copies of a patented drug, paying the patent holder a small statutory royalty.
              </p>
            </div>
          </div>

          <h3 style={{ marginBottom: '1rem' }}>Three Access Tools for Advocates:</h3>
          <div className="grid-3" style={{ gap: '1rem' }}>
            <div className="card card-sm">
              <h4 className="mb-2 text-sm" style={{ color: 'var(--blue-400)' }}>Patent Opposition</h4>
              <p className="text-xs text-muted leading-relaxed">
                NGOs can challenge 'evergreening' patents (where companies file minor updates to extend monopolies) directly at the national patent registry, opening the door for legal generic equivalents.
              </p>
            </div>
            <div className="card card-sm">
              <h4 className="mb-2 text-sm" style={{ color: 'var(--blue-400)' }}>Compulsory Import</h4>
              <p className="text-xs text-muted leading-relaxed">
                Under WTO TRIPS Article 31bis, countries with no local drug manufacturing capacity can legally import generic counterparts manufactured under compulsory licenses in other countries (like India).
              </p>
            </div>
            <div className="card card-sm">
              <h4 className="mb-2 text-sm" style={{ color: 'var(--blue-400)' }}>Parallel Importation</h4>
              <p className="text-xs text-muted leading-relaxed">
                Allows governments to import patented originator products from third-party countries where the manufacturer sells the identical product at a much lower price (without manufacturer permission).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: NGO Collaborators */}
      {activeTab === 'directory' && (
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <h2 className="text-center mb-4" style={{ fontSize: '1.375rem' }}>Advocacy & NGO Directory</h2>
          <p className="text-center text-secondary mb-8" style={{ marginBottom: '2.5rem', maxWidth: 540, margin: '0 auto 2.5rem' }}>
            You do not have to battle alone. Connect with these global initiatives, study their campaigns, and download their toolkits to implement in your local drives:
          </p>

          <div className="grid-2" style={{ gap: '1rem' }}>
            {DIRECTORY.map(ngo => (
              <div key={ngo.name} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{ngo.name}</h3>
                    <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>Global partner</span>
                  </div>
                  <div className="text-xs font-bold text-blue mb-2" style={{ color: 'var(--blue-400)', marginBottom: '0.75rem' }}>{ngo.role}</div>
                  <p className="text-xs text-muted leading-relaxed" style={{ marginBottom: '1.25rem' }}>{ngo.desc}</p>
                </div>
                <a
                  href={ngo.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm w-full text-center"
                  style={{ display: 'block', textDecoration: 'none' }}
                >
                  Visit Campaign Website →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back to Dashboards */}
      <div style={{ marginTop: '4rem', textAlign: 'center' }}>
        <Link to="/countries" className="btn btn-primary">
          Explore Country Dashboards
        </Link>
      </div>
    </div>
  );
}

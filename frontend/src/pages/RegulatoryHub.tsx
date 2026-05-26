import { useState } from 'react';
import { Shield, Users, Compass, ChevronRight, Award, HelpCircle, CheckCircle, Clock, Zap, AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const PATHWAYS = [
  {
    country: 'Kenya / East Africa (PPB)',
    agencyName: 'Pharmacy and Poisons Board (PPB)',
    framework: 'EAC Joint Medical Products Harmonization (EAC-MRH) & WHO Regulatory Reliance Framework',
    standardSteps: [
      { name: 'Dossier Submission', time: '1–2 Months', desc: 'Manufacturer submits the Common Technical Document (CTD) dossier to the Pharmacy and Poisons Board.' },
      { name: 'Technical Evaluation', time: '12–18 Months', desc: 'Clinical safety, efficacy data, and bioequivalence records are thoroughly analyzed by the board.' },
      { name: 'Local GMP Audit', time: '6–12 Months', desc: 'Physical Good Manufacturing Practices (GMP) audit of the foreign production facility is scheduled and completed.' },
      { name: 'Registration & Gazettement', time: '2–3 Months', desc: 'Marketing Authorization is granted and the drug is gazetted for local distribution.' },
      { name: 'KEMSA / Public Tender', time: '3–9 Months', desc: 'Listed on the national essential medicines procurement registry for public hospital supply.' }
    ],
    relianceSteps: [
      { name: 'SRA Approval Verification', time: '1 Month', desc: 'Manufacturer submits proof of FDA, EMA, or WHO Prequalification (WHO-PQ) approval to PPB.' },
      { name: 'Fast-Track Dossier Review', time: '1–2 Months', desc: 'PPB conducts a simplified administrative review, adopting the SRA scientific evaluation report.' },
      { name: 'GMP Inspection Waiver', time: 'Under 1 Month', desc: 'PPB waives the local physical inspection, relying on the foreign SRA audit clearance.' },
      { name: 'Accelerated Authorization', time: '90 Days Total', desc: 'Marketing authorization granted under PPB Regulatory Reliance guidelines, enabling instant importation.' }
    ],
    leverageClause: 'Section 12 of the Pharmacy and Poisons Act (Cap 244) & PPB Guidelines on Regulatory Reliance.',
    bottleneckStrategy: 'If a drug is approved by the FDA/EMA/WHO-PQ but has been stuck in Kenya for >6 months, petition the PPB to apply their Regulatory Reliance Guidelines. This legally waives the physical GMP inspection requirement—which is the single longest bottleneck for generic imports.',
    aiPreset: 'Reliance Petition / Cap 244 Waiver'
  },
  {
    country: 'India (CDSCO)',
    agencyName: 'Central Drugs Standard Control Organisation (CDSCO)',
    framework: 'New Drugs and Clinical Trial Rules (2019) & Rule 75/80 SRA waivers',
    standardSteps: [
      { name: 'IND Filing & Application', time: '2–3 Months', desc: 'Sponsor submits application for approval of a new drug or clinical trial to the DCGI.' },
      { name: 'SEC Expert Review & Trials', time: '12–24 Months', desc: 'Subject Expert Committees (SEC) evaluate safety and often mandate local Phase III clinical trials in Indian populations.' },
      { name: 'Quality Lab Validation', time: '3–6 Months', desc: 'Central Drugs Laboratory (CDL) conducts molecular purity, safety validation, and batch consistency testing.' },
      { name: 'Approval & NPPA Pricing', time: '4–8 Months', desc: 'Approved for marketing; retail pricing is evaluated and capped by the National Pharmaceutical Pricing Authority (NPPA).' }
    ],
    relianceSteps: [
      { name: 'SRA Waiver Application', time: '1 Month', desc: 'Sponsor files under Rule 75/80 showing approval in an SRA (US, EU, UK, Japan, Australia) for severe/orphan diseases.' },
      { name: 'SEC Clinical Trial Waiver', time: '2 Months', desc: 'SEC waives the mandatory local Phase III clinical trial requirement based on established global safety records.' },
      { name: 'Fast-Track Scientific Approval', time: '90–120 Days', desc: 'Accelerated marketing authorization granted by CDSCO, bypassing months of clinical trials.' }
    ],
    leverageClause: 'Rule 75 & Rule 80 of the New Drugs and Clinical Trials Rules, 2019 (Clinical Trial Waiver).',
    bottleneckStrategy: 'For critical oncology, rare disease, or orphan drugs approved in high-income countries but delayed in India, petition the SEC/DCGI for a local trial waiver. Cite the rule that allows waiving Phase III trials if the drug is already approved by major global SRAs and satisfies an unmet public health need.',
    aiPreset: 'Rule 75 Trial Waiver Petition'
  },
  {
    country: 'European Union (EMA)',
    agencyName: 'European Medicines Agency (EMA)',
    framework: 'EMA Accelerated Assessment (Article 14(9) of Regulation (EC) 726/2004)',
    standardSteps: [
      { name: 'EPAR Dossier Submission', time: '1 Month', desc: 'Scientific review request and complete clinical dossier submitted to the Committee for Medicinal Products (CHMP).' },
      { name: 'CHMP Scientific Assessment', time: '7–9 Months', desc: 'Rigorous central scientific review of chemical, preclinical, and clinical trial records (active review takes 210 days).' },
      { name: 'European Commission Decision', time: '67 Days', desc: 'European Commission issues a formal legally-binding Marketing Authorization for all EU27 member states.' },
      { name: 'HTA & Pricing Negotiations', time: '3–18 Months', desc: 'Individual member states complete Health Technology Assessments (HTA) and national health insurance pricing inclusion.' }
    ],
    relianceSteps: [
      { name: 'Accelerated Assessment Request', time: 'Before Filing', desc: 'Sponsor requests fast-track status by proving the drug represents a major therapeutic innovation for public health.' },
      { name: 'Fast-Track CHMP Evaluation', time: '150 Days', desc: 'CHMP review timeline is cut from 210 days to 150 days, prioritizing scientific resources and active evaluation.' },
      { name: 'Joint HTA Acceleration', time: 'Parallel Stage', desc: 'Member states conduct collaborative clinical HTA reviews concurrently, reducing country-level reimbursement lag.' }
    ],
    leverageClause: 'Article 14(9) of Regulation (EC) 726/2004 & EU Joint HTA Regulation (Regulation (EU) 2021/2282).',
    bottleneckStrategy: 'In Central and Eastern Europe, the biggest hurdle is not the EMA approval, but the national HTA pricing negotiation delay (often exceeding 500 days). Campaign for rapid adoption of the EU Joint HTA reports at the national level to bypass redundant, slow local assessments.',
    aiPreset: 'Joint HTA National Adoption Appeal'
  },
  {
    country: 'United States (FDA)',
    agencyName: 'Food and Drug Administration (FDA)',
    framework: 'FDA Priority Review, Breakthrough Designation & Collaborative Project Orbis',
    standardSteps: [
      { name: 'NDA / BLA Submission', time: '2 Months', desc: 'Sponsor submits the New Drug Application (NDA) or Biologics License Application (BLA).' },
      { name: 'Standard CDER Review', time: '10 Months', desc: 'Comprehensive safety, statistical, pharmacology, and clinical dossier reviews by CDER scientists.' },
      { name: 'GMP Facility Inspection', time: '2–4 Months', desc: 'Rigorous pre-approval safety inspection of the pharmaceutical production facility.' },
      { name: 'FDA Approval & Launch', time: '1 Month', desc: 'Formal marketing approval granted; commercial launch and post-market safety surveillance begin.' }
    ],
    relianceSteps: [
      { name: 'Priority Review Designation', time: 'Immediate', desc: 'FDA grants Priority Review, cutting the active CDER evaluation timeline from 10 months to 6 months.' },
      { name: 'Project Orbis Concurrent Review', time: 'Concurrent', desc: 'FDA shares review data in real-time with regulatory partners in Australia, Canada, UK, and Switzerland for simultaneous global approval.' },
      { name: 'Accelerated / Surrogate Approval', time: 'Fast-Tracked', desc: 'Approval granted based on surrogate clinical endpoints, allowing immediate patient access while confirmatory trials run.' }
    ],
    leverageClause: 'FDA Food and Drug Administration Safety and Innovation Act (FDASIA) Section 901.',
    bottleneckStrategy: 'For diseases with high unmet needs, leverage the FDA Patient-Focused Drug Development (PFDD) framework. Advocates can testify directly at advisory committees to encourage the FDA to adopt surrogate endpoints, accelerating Breakthrough and Accelerated Approval tracks.',
    aiPreset: 'Advisory Committee Patient Testimony'
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
  const [routeType, setRouteType] = useState<'standard' | 'reliance'>('standard');

  const selectedPathData = PATHWAYS[selectedPathway];
  const stepsToRender = routeType === 'standard' ? selectedPathData.standardSteps : selectedPathData.relianceSteps;

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
              Select a regulatory body below to diagnose its approval pipeline bottlenecks, or compare the standard slow registration track with WHO Regulatory Reliance pathways:
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ marginBottom: '0.25rem' }}>
                  {selectedPathData.agencyName} Timeline
                </h3>
                <p className="text-xs text-muted" style={{ marginBottom: '0.5rem' }}>
                  Framework: <strong>{selectedPathData.framework}</strong>
                </p>
              </div>
            </div>

            {/* Toggle Track Selector */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '2rem', width: 'fit-content' }}>
              <button 
                onClick={() => setRouteType('standard')}
                className={`btn btn-xs ${routeType === 'standard' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '6px' }}
              >
                Standard Approval Track
              </button>
              <button 
                onClick={() => setRouteType('reliance')}
                className={`btn btn-xs ${routeType === 'reliance' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Zap size={11} style={{ color: 'var(--amber-400)' }} /> WHO Reliance Track (Accelerated)
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
              {/* Vertical line connector */}
              <div style={{
                position: 'absolute', left: '16px', top: '10px', bottom: '10px',
                width: '2px', background: 'var(--border-strong)', zIndex: 1
              }} />

              {stepsToRender.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 2 }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: 'var(--bg-elevated)', border: routeType === 'reliance' ? '2px solid var(--amber-500)' : '2px solid var(--blue-500)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', color: routeType === 'reliance' ? 'var(--amber-400)' : 'var(--blue-400)', flexShrink: 0
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{step.name}</span>
                      <span className={`badge ${routeType === 'reliance' ? 'badge-amber' : 'badge-teal'} text-xs`} style={{ fontSize: '0.65rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                        <Clock size={10} /> {step.time} avg.
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-2" style={{ marginTop: '0.25rem', lineHeight: 1.6 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Advocacy Action Box */}
            <div className="card" style={{ marginTop: '2.5rem', borderTop: '4px solid var(--teal-500)', background: 'rgba(16, 185, 129, 0.02)', padding: '1.25rem' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--teal-400)', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>
                <AlertTriangle size={15} /> Advocacy Bottleneck Strategy: {selectedPathData.country}
              </h4>
              <div className="text-xs text-muted mb-2" style={{ lineHeight: 1.6 }}>
                <strong>Leverage Framework:</strong> {selectedPathData.leverageClause}
              </div>
              <p className="text-xs text-secondary leading-relaxed mb-4" style={{ lineHeight: 1.6 }}>
                <strong>NGO Campaign Action:</strong> {selectedPathData.bottleneckStrategy}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <Link to="/countries" className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', textDecoration: 'none' }}>
                  <ExternalLink size={11} /> Generate AI Action Plan: {selectedPathData.aiPreset}
                </Link>
              </div>
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

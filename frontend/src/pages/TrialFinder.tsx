import { useState, useEffect } from 'react';
import { Award, Compass, Search, Clock, Shield, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Copy, Check, FileText, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COUNTRY_DATA } from '../lib/reference-data';

// Dynamically generate country list from shared Reference Data
const COUNTRIES_LIST = Object.entries(COUNTRY_DATA).map(([code, value]) => ({
  code,
  name: value.name
})).sort((a, b) => a.name.localeCompare(b.name));

const TRIALS_PROXY_URL = import.meta.env.VITE_TRIALS_PROXY_URL || 'https://tekdruid.com/medilens/api/trials.php';

export default function TrialFinder() {
  // Query States
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState('');
  const [status, setStatus] = useState('RECRUITING');
  const [country, setCountry] = useState('');

  // Data Loading States
  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Copy States
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Toolkit Accordion States
  const [activeToolkit, setActiveToolkit] = useState<string | null>(null);

  // Fetch trials from ClinicalTrials.gov APIv2 via secure CORS proxy
  const fetchTrials = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('pageSize', '12');
      
      const terms: string[] = [];
      if (query.trim()) terms.push(query.trim());
      if (country) {
        const countryName = COUNTRY_DATA[country]?.name;
        if (countryName) terms.push(`"${countryName}"`);
      }

      if (terms.length > 0) {
        params.append('query.term', terms.join(' AND '));
      }
      if (phase) {
        params.append('filter.phases', phase);
      }
      if (status) {
        params.append('filter.overallStatus', status);
      }

      const url = `${TRIALS_PROXY_URL}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch: Server returned ${res.status}`);
      }
      const data = await res.json();
      setStudies(data.studies ?? []);
      setTotalCount(data.totalCount ?? (data.studies ? data.studies.length : 0));
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while querying ClinicalTrials.gov.');
      setStudies([]);
      setTotalCount(null);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchTrials();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrials();
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Toggle toolkit panels
  const toggleToolkit = (key: string) => {
    setActiveToolkit(prev => prev === key ? null : key);
  };

  const statusBadge = (s: string) => {
    switch (s.toUpperCase()) {
      case 'RECRUITING': return 'badge-green';
      case 'ACTIVE_NOT_RECRUITING': return 'badge-amber';
      case 'COMPLETED': return 'badge-teal';
      default: return 'badge-outline';
    }
  };

  return (
    <div className="container section">
      {/* Hero Header */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div className="hero-eyebrow" style={{ margin: '0 auto 1rem' }}>🔬 Live Clinical Trial Radar</div>
        <h1 className="hero-title" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
          Real-Time Trial <span className="accent">Finder Dashboard</span>
        </h1>
        <p className="text-secondary" style={{ maxWidth: 680, margin: '1rem auto 1.5rem', lineHeight: 1.75 }}>
          Search recruiting clinical trials worldwide. Locate active trial centers near you to match patients 
          with free, cutting-edge therapies, and access strategic advocacy toolkits to request Compassionate Use.
        </p>
      </div>

      {/* Main Search Panel */}
      <div className="card card-lg" style={{ marginBottom: '2.5rem' }}>
        <form onSubmit={handleSearchSubmit}>
          <div className="grid-4 gap-4" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 750 }}>
                Condition, Drug Name, or Sponsor:
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="e.g. Oncology, Lenacapavir, Novartis..." 
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '2.25rem', height: '38px', borderRadius: '6px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div style={{ minWidth: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 750 }}>
                Target Phase:
              </label>
              <select 
                value={phase} 
                onChange={e => setPhase(e.target.value)}
                className="btn btn-outline"
                style={{ width: '100%', padding: '0.45rem 1rem', height: '38px', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border-strong)' }}
              >
                <option value="">All Phases</option>
                <option value="PHASE1">Phase I (Safety)</option>
                <option value="PHASE2">Phase II (Dosing)</option>
                <option value="PHASE3">Phase III (Confirmatory)</option>
                <option value="PHASE4">Phase IV (Post-Market)</option>
              </select>
            </div>

            <div style={{ minWidth: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 750 }}>
                Recruitment Status:
              </label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value)}
                className="btn btn-outline"
                style={{ width: '100%', padding: '0.45rem 1rem', height: '38px', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border-strong)' }}
              >
                <option value="">All Statuses</option>
                <option value="RECRUITING">Recruiting</option>
                <option value="ACTIVE_NOT_RECRUITING">Active, Not Recruiting</option>
                <option value="ENROLLING_BY_INVITATION">By Invitation</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div style={{ minWidth: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 750 }}>
                Target Country:
              </label>
              <select 
                value={country} 
                onChange={e => setCountry(e.target.value)}
                className="btn btn-outline"
                style={{ width: '100%', padding: '0.45rem 1rem', height: '38px', borderRadius: '6px', fontSize: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border-strong)' }}
              >
                <option value="">Global Coverage</option>
                {COUNTRIES_LIST.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
              style={{ padding: '0.45rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '36px' }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              Search Active Trials
            </button>
          </div>
        </form>
      </div>

      {/* Database Attribution Notice */}
      <p className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '-1.5rem', marginBottom: '2.5rem', textAlign: 'center' }}>
        ℹ️ Real-time clinical registry data sourced from the US National Library of Medicine (ClinicalTrials.gov).
      </p>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--blue-400)', margin: '0 auto 1rem' }} />
          <p className="text-secondary text-sm">Querying ClinicalTrials.gov API...</p>
        </div>
      )}

      {error && (
        <div className="card text-center" style={{ border: '1px solid var(--red-400)', background: 'rgba(239, 68, 68, 0.05)', padding: '2rem 1.5rem', marginBottom: '2rem' }}>
          <AlertTriangle size={32} style={{ color: 'var(--red-400)', margin: '0 auto 1rem' }} />
          <h4 style={{ color: 'var(--red-400)' }}>API Connection Issue</h4>
          <p className="text-xs text-secondary mt-1">{error}</p>
        </div>
      )}

      {/* Dynamic Results Grid */}
      {!loading && !error && (
        <div style={{ marginBottom: '4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Matching Studies</h3>
            {totalCount !== null && (
              <span className="badge badge-teal text-xs">
                {totalCount} trials tracked
              </span>
            )}
          </div>

          {studies.length === 0 ? (
            <div className="card text-center" style={{ padding: '4rem 2rem' }}>
              <Clock size={36} style={{ color: 'var(--border-strong)', margin: '0 auto 1rem' }} />
              <h4>No clinical trials found</h4>
              <p className="text-secondary text-sm" style={{ maxWidth: 420, margin: '0.5rem auto 0' }}>
                Try relaxing your search terms or selecting "Global Coverage" to find trials currently active in other regions.
              </p>
            </div>
          ) : (
            <div className="grid-3" style={{ gap: '1.25rem' }}>
              {studies.map((s, idx) => {
                const protocol = s.protocolSection ?? {};
                const nctId = protocol.identificationModule?.nctId ?? 'NCT—';
                const title = protocol.identificationModule?.briefTitle ?? 'Untitled Clinical Trial';
                const sponsor = protocol.sponsorCollaboratorsModule?.leadSponsor?.name ?? 'Unknown Sponsor';
                const phaseLabel = protocol.designModule?.phases?.join(', ') ?? 'N/A';
                const trialStatus = protocol.statusModule?.overallStatus ?? 'UNKNOWN';
                const conds = protocol.conditionsModule?.conditions?.slice(0, 2).join(', ') ?? 'General Condition';
                const locations = protocol.contactsLocationsModule?.locations ?? [];
                
                // Deduplicate countries
                const countries = Array.from(new Set(locations.map((l: any) => l.country).filter(Boolean))) as string[];

                return (
                  <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '3px solid var(--blue-400)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span className="font-mono text-xs font-bold text-blue" style={{ color: 'var(--blue-400)' }}>{nctId}</span>
                        <span className={`badge ${statusBadge(trialStatus)} text-xs`} style={{ fontSize: '0.65rem' }}>
                          {trialStatus.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.4, height: '40px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                        {title}
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
                        <div className="text-xs text-muted">
                          <strong>Sponsor:</strong> {sponsor}
                        </div>
                        <div className="text-xs text-muted">
                          <strong>Phase:</strong> {phaseLabel.replace(/PHASE/g, 'Phase ')}
                        </div>
                        <div className="text-xs text-muted">
                          <strong>Conditions:</strong> {conds}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                      <div className="text-xs text-secondary leading-relaxed mb-3" style={{ height: '32px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <strong>Active in:</strong> {countries.length > 0 ? countries.slice(0, 3).join(', ') + (countries.length > 3 ? ` (+${countries.length - 3} more)` : '') : 'Global Centers'}
                      </div>
                      <a 
                        href={`https://clinicaltrials.gov/study/${nctId}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-outline btn-sm w-full text-center"
                        style={{ display: 'block', textDecoration: 'none', fontSize: '0.75rem' }}
                      >
                        View Official Registry Details →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* NGO & Patient Advocacy Toolkits Section */}
      <div style={{ maxWidth: 840, margin: '0 auto 4rem' }}>
        <h2 className="text-center mb-2" style={{ fontSize: '1.5rem' }}>NGO & Patient Advocacy Toolkits</h2>
        <p className="text-center text-secondary mb-8 text-sm" style={{ marginBottom: '2.5rem', maxWidth: 540, margin: '0 auto 2.5rem' }}>
          Locating a trial is the first step. Use these specialized checklists, legal templates, and lobbying petitions to secure drug access for your community.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Toolkit 1: Patient Matching */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <button 
              onClick={() => toggleToolkit('matching')}
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Award size={18} style={{ color: 'var(--teal-400)' }} /> 1. Patient Trial Screening & Matching Guide
              </h3>
              {activeToolkit === 'matching' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {activeToolkit === 'matching' && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <p className="text-xs text-secondary leading-relaxed mb-4">
                  Before contacting a trial site coordinator, advocates must verify that the patient matches the trial's core inclusion criteria to avoid immediate rejection.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="card card-sm bg-elevated">
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--blue-400)', marginBottom: '0.25rem' }}>Stage 1: Basic Criteria Mapping</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Locate the **Eligibility Module** on the official registry page. Verify that the patient matches the mandatory Age boundaries, Sex, and specific Diagnostic mutations (e.g. HER2+ or BRCA1 status in oncology).
                    </p>
                  </div>
                  <div className="card card-sm bg-elevated">
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--blue-400)', marginBottom: '0.25rem' }}>Stage 2: Check Exclusion Contraindications</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Screen the "Exclusion" list. Common rejection factors include prior exposure to specific drug families, active liver/renal dysfunction, or concurrent cardiovascular risks.
                    </p>
                  </div>
                  <div className="card card-sm bg-elevated">
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--blue-400)', marginBottom: '0.25rem' }}>Stage 3: Establish Informed Consent</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Advocates must walk patients through trial risks, double-blind parameters (the chance of receiving a placebo if not an open-label trial), and establish formal patient consent.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Toolkit 2: Compassionate Use outreach */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <button 
              onClick={() => toggleToolkit('compassionate')}
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <FileText size={18} style={{ color: 'var(--blue-400)' }} /> 2. Compassionate Use Sponsor Outreach Letter
              </h3>
              {activeToolkit === 'compassionate' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {activeToolkit === 'compassionate' && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <p className="text-xs text-secondary leading-relaxed mb-3">
                  If a terminal patient matches a drug's trial but does not qualify (or is located too far from active centers), advocates can appeal directly to the manufacturer/lead sponsor for **Compassionate Use (Named Patient Importation)**.
                </p>
                <p className="text-xs text-muted mb-4">
                  Copy and customize this professional letter template to send to the clinical sponsor contact listed in the trial details:
                </p>
                
                <div style={{ position: 'relative' }}>
                  <pre style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '1rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-primary)' }}>
{`Subject: Urgent Request for Compassionate Use Access - [Drug Name] for [Patient Name]

Dear Clinical Sponsor Team / Principal Investigator,

I am writing on behalf of [Patient Name], a patient in [Country] diagnosed with severe [Condition Name]. The patient's disease has progressed, and they have exhausted all locally approved, commercially available therapies.

We have studied your ongoing Phase III clinical trial (NCT identifier: [Insert NCT Number]) for your investigational agent, [Drug Name]. The patient matches the clinical rationale for the trial, but unfortunately is unable to enroll due to [state reason, e.g., geographic distance from active trial sites / narrow inclusion criteria boundaries].

Given the severe, life-threatening nature of the illness and the absence of comparable therapeutic options, we respectfully request that your company grant named-patient Compassionate Use (Expanded Access) to [Drug Name] under [Country's] special importation laws (Section 12 / Emergency importation provisions).

The patient's treating oncologist, Dr. [Oncologist Name] at [Hospital Name], is fully prepared to oversee the administration of [Drug Name], compile all necessary safety reports, and manage clinical protocol. 

Thank you for your scientific leadership and your consideration of this urgent, life-saving request.

Sincerely,

[Your Name / NGO Title]
[Contact Information]`}
                  </pre>
                  <button 
                    onClick={() => handleCopy(`Subject: Urgent Request for Compassionate Use Access...`, 'compassionate')}
                    className="btn btn-sm btn-ghost"
                    style={{ position: 'absolute', right: '10px', top: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                  >
                    {copiedText === 'compassionate' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Template</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toolkit 3: Trial Site Lobbying */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <button 
              onClick={() => toggleToolkit('lobbying')}
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Globe size={18} style={{ color: 'var(--amber-400)' }} /> 3. Regional Trial Site Lobbying Petition
              </h3>
              {activeToolkit === 'lobbying' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {activeToolkit === 'lobbying' && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <p className="text-xs text-secondary leading-relaxed mb-3">
                  Developing countries are severely underrepresented in global trials, leading to approval delays because agencies claim "ethnic safety factors" are missing. Use this petition template to lobby your Health Ministry and global sponsors to expand geographic site diversity:
                </p>
                
                <div style={{ position: 'relative' }}>
                  <pre style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '1rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-primary)' }}>
{`PETITION FOR REGIONAL CLINICAL TRIAL EXPANSION & ACCESS EQUITY

TO: The Ministry of Health & Medical Research Directorate of [Country Name]
CC: Clinical Trial Sponsorship Board, [Pharmaceutical Sponsor Name]

SUBJECT: Request to Add Regional Healthcare Centers as Active Investigation Sites for [Drug/Treatment Name] (Trial NCT: [Insert NCT])

We, the undersigned clinical societies, patient advocates, and community health networks representing [Country/Region], write to formally petition that our national reference clinics are integrated as active sites in upcoming multi-center global clinical trials for [Drug Name].

1. THE ACCESS GAP: Currently, 85% of clinical trials for novel oncological, rare-disease, and infectious treatments are confined to high-income countries. This severely delays national approvals, as local agencies frequently hold decisions demanding local ethnic safety verification.
2. RESEARCH INFRASTRUCTURE: Our regional teaching hospitals (such as [Insert Hospital Name]) possess qualified medical investigators, fully equipped biosafety labs, and established institutional review boards (IRB) capable of managing advanced clinical study protocols.
3. EQUITABLE ACTION REQUESTED:
— We demand that the Ministry of Health proactively coordinate with global sponsors to fast-track administrative approval of local clinical sites.
— We request that the Sponsor allocates investigative resources to expand trials to [Region Name], ensuring diverse clinical representations and bringing life-saving therapeutic access to our citizens.

Signed,

[Advocacy Coalition Name / Joint signatories list]`}
                  </pre>
                  <button 
                    onClick={() => handleCopy(`PETITION FOR REGIONAL CLINICAL TRIAL EXPANSION...`, 'lobbying')}
                    className="btn btn-sm btn-ghost"
                    style={{ position: 'absolute', right: '10px', top: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                  >
                    {copiedText === 'lobbying' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Template</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toolkit 4: Transparency Audit */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <button 
              onClick={() => toggleToolkit('audit')}
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Shield size={18} style={{ color: 'var(--purple-400)' }} /> 4. Trial Transparency & Ethical Auditing Checklist
              </h3>
              {activeToolkit === 'audit' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {activeToolkit === 'audit' && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <p className="text-xs text-secondary leading-relaxed mb-4">
                  Under WHO ethical guidelines, trial sponsors are **morally and legally required** to publish trial results in a public registry within 12 months of completion. Unfortunately, over 40% of trials go unpublished, hiding vital negative results and efficacy failures. Use this checklist to run transparency audits on critical drugs:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="card card-sm bg-elevated">
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--blue-400)', marginBottom: '0.25rem' }}>Step 1: Check Primary Completion Date</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Identify the trial's "Primary Completion Date" in the registry. If more than 12 months have elapsed and the status is "Completed" but no results are posted, the sponsor is in violation of WHO ethical guidelines.
                    </p>
                  </div>
                  <div className="card card-sm bg-elevated">
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--blue-400)', marginBottom: '0.25rem' }}>Step 2: File a Transparency Complaint</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      File an official registry complaint to ClinicalTrials.gov or the WHO ICTRP oversight committee. Demanding the release of negative clinical results is a critical safety shield against originators claiming false efficacy.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Back to Hub Button */}
      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <Link to="/regulatory-hub" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
          <Compass size={14} /> Return to Advocacy &amp; Regulatory Hub
        </Link>
      </div>
    </div>
  );
}

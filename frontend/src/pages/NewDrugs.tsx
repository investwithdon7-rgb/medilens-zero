import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, RefreshCw, Globe, TrendingUp } from 'lucide-react';
import { getNewDrugsFeed } from '../lib/firebase';
import { COUNTRY_DATA } from '../lib/reference-data';

const DISEASE_CATS = [
  { key: 'all',            label: 'All Diseases'       },
  { key: 'oncology',       label: 'Cancer / Oncology'  },
  { key: 'cardiovascular', label: 'Cardiovascular'     },
  { key: 'diabetes',       label: 'Diabetes & Obesity' },
  { key: 'hiv',            label: 'HIV / AIDS'         },
  { key: 'infectious',     label: 'Infectious Diseases'},
  { key: 'respiratory',    label: 'Respiratory'        },
  { key: 'neurology',      label: 'Neurology'          },
  { key: 'mental-health',  label: 'Mental Health'      },
  { key: 'autoimmune',     label: 'Autoimmune'         },
  { key: 'rare',           label: 'Rare Diseases'      },
  { key: 'maternal',       label: 'Maternal Health'    },
] as const;

type DiseaseCat = typeof DISEASE_CATS[number]['key'];

const COUNTRIES_LIST = Object.entries(COUNTRY_DATA).map(([code, value]) => ({
  code,
  name: value.name
})).sort((a, b) => a.name.localeCompare(b.name));

function getDiseaseCategory(text: string): DiseaseCat {
  const c = (text || '').toLowerCase();
  // Drug-class / indication text matching
  if (/oncol|cancer|tumor|leukemi|lymphom|carcinoma|melanom|immunother|checkpoint|pembroliz|nivolum|trastuz|kinase inhib|myelom|sarcoma|antineoplast|cytotox|pd-1|pd-l1|her2|bcr.abl/.test(c)) return 'oncology';
  if (/cardio|hypertens|heart fail|lipid|statin|cholesterol|angina|arrhythm|anticoagul|thrombos|atrial|venous|coronary|myocard|factor xa|thrombin inhib/.test(c)) return 'cardiovascular';
  if (/diabet|insulin|glucose|sglt|glp-1|glp1|metform|hba1c|obesity|weight loss|glucagon.like|cotransporter|dipeptidyl/.test(c)) return 'diabetes';
  if (/hiv|antiretro|aids|integrase|protease inhib|nrti|nnrti|cabotegravir|reverse transcriptase/.test(c)) return 'hiv';
  // \bhepatit avoids matching "steatohepatitis" (MASH, a hepatology condition) while still catching viral hepatitis
  if (/tuberc|malaria|\bhepatit|anti-infect|antibiotic|antimicro|antivir|antifung|pneumon|sepsis|bacterial|viral infect/.test(c)) return 'infectious';
  if (/respir|asthma|copd|pulmon|broncho|inhaled|lung|airway|bronchodilat/.test(c)) return 'respiratory';
  if (/neuro|epilep|alzheimer|parkinson|multiple sclerosis|seizure|dementia|amyloid/.test(c)) return 'neurology';
  if (/psych|mental|depress|anxiety|bipolar|schizo|antidepres|adhd|serotonin reuptake/.test(c)) return 'mental-health';
  if (/autoimmun|rheuma|arthrit|inflamm|tnf.alpha|interleukin|jak inhib|psoriasis|crohn|colitis|il-[0-9]/.test(c)) return 'autoimmune';
  if (/rare|orphan|genetic|enzyme replac|lysosom|muscular dystrophy|cystic fibrosis|spinal muscular/.test(c)) return 'rare';
  if (/matern|obstet|oxytocin|eclampsia|prenatal|postpart/.test(c)) return 'maternal';

  // INN suffix-based classification (works even when drug_class is empty)
  // Pharmaceutical naming conventions give reliable class signals from the INN itself
  if (/glutide$|natide$/.test(c))       return 'diabetes';    // GLP-1 agonists: semaglutide, liraglutide
  if (/flozin$/.test(c))                return 'diabetes';    // SGLT2 inhibitors: dapagliflozin, empagliflozin
  if (/gliptin$/.test(c))               return 'diabetes';    // DPP-4 inhibitors: sitagliptin
  if (/tinib$|rafenib$|ciclib$/.test(c)) return 'oncology';   // kinase inhibitors
  if (/mab$|mumab$|zumab$|ximab$/.test(c)) return 'oncology'; // monoclonal antibodies (mostly oncology)
  if (/lukast$|sterol$|terol$/.test(c)) return 'respiratory'; // leukotrienes, bronchodilators
  if (/parin$|xaban$|gatran$/.test(c))  return 'cardiovascular'; // anticoagulants
  if (/statin$/.test(c))                return 'cardiovascular'; // statins
  if (/sartan$|pril$/.test(c))          return 'cardiovascular'; // ARBs, ACE inhibitors
  if (/vir$|ciclovir$|navir$/.test(c))  return 'infectious';  // antivirals
  if (/cillin$|mycin$|cycline$|oxacin$/.test(c)) return 'infectious'; // antibiotics
  if (/mab$/.test(c)) {
    // Remaining -mab (not oncology-flagged above) → autoimmune
    return 'autoimmune';
  }

  return 'all';
}

export default function NewDrugs() {
  const [drugs, setDrugs]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'lmic' | 'hic-only'>('all');
  const [disease, setDisease] = useState<DiseaseCat>('all');

  // Country & Pagination States
  const [selectedCountry, setSelectedCountry] = useState('');
  const [localApprovalFilter, setLocalApprovalFilter] = useState<'all' | 'approved' | 'unapproved'>('all');
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    getNewDrugsFeed(120).then(d => { setDrugs(d); setLoading(false); });
  }, []);

  // Filter by coverage equity, disease category, and country local registration status
  const filtered = drugs.filter(drug => {
    // equity filter (existing)
    if (filter !== 'all') {
      const countries: string[] = drug.countries_registered ?? [];
      const hasLMIC = countries.some(c => {
        const ref = COUNTRY_DATA[c];
        return ref && (ref.income_class === 'LMIC' || ref.income_class === 'LIC');
      });
      if (filter === 'lmic' && !hasLMIC) return false;
      if (filter === 'hic-only' && (hasLMIC || countries.length === 0)) return false;
    }
    // disease filter — check drug_class, indication text, and INN suffix
    if (disease !== 'all') {
      const matchesCat = (s: string) => getDiseaseCategory(s) === disease;
      if (!matchesCat(drug.drug_class ?? '') && !matchesCat(drug.indication ?? '') && !matchesCat(drug.inn ?? '')) return false;
    }
    // country registration filter
    if (selectedCountry) {
      const countries: string[] = drug.countries_registered ?? [];
      const isApproved = countries.includes(selectedCountry);
      if (localApprovalFilter === 'approved' && !isApproved) return false;
      if (localApprovalFilter === 'unapproved' && isApproved) return false;
    }
    return true;
  });

  // HIC-only: drug is registered in ≥1 tracked country AND all of them are HIC
  // AND we have LMIC coverage data (lmic_count field present) to avoid false positives
  // from sparse data where we simply haven't ingested LMIC records yet.
  const licOnly = drugs.filter(d => {
    const countries: string[] = d.countries_registered ?? [];
    if (countries.length === 0) return false;
    // Only flag as HIC-only when we have confirmed data coverage (≥2 countries or lmic_count field present)
    const hasCoverage = countries.length >= 2 || d.data_coverage >= 2;
    if (!hasCoverage) return false;
    return countries.every(c => {
      const ref = COUNTRY_DATA[c];
      return ref && ref.income_class === 'HIC';
    });
  }).length;

  const withLMIC = drugs.filter(d => (d.lmic_count ?? 0) > 0).length;
  const sparseData = drugs.filter(d => (d.data_coverage ?? 0) <= 1).length;

  const visibleDrugs = filtered.slice(0, visibleCount);

  return (
    <>
      {/* Header */}
      <div className="drug-header">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Zap size={24} style={{ color: 'var(--teal-400)' }} />
            <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>New Drug Radar</h1>
          </div>
          <p className="text-secondary">
            Drugs with first global approval in the past 3 years — see which reached your country and which didn't.
          </p>
        </div>
      </div>

      <div className="container section">

        {/* Equity summary banner */}
        {!loading && drugs.length > 0 && (
          <div className="access-gap-banner mb-4" style={{ marginBottom: '1.5rem' }}>
            <TrendingUp size={22} />
            <div>
              <div className="access-gap-headline">
                <strong>{drugs.length}</strong> drugs with first global approval in the past 3 years tracked in our database.
                {licOnly > 0 && (
                  <> Of those with multi-country data, <strong style={{ color: 'var(--amber-400)' }}>{licOnly}</strong> show <strong>registration only in high-income countries</strong> so far.</>
                )}
                {withLMIC > 0 && (
                  <> <strong style={{ color: 'var(--emerald-400)' }}>{withLMIC}</strong> have confirmed LMIC registrations.</>
                )}
              </div>
              <div className="access-gap-sub">
                {sparseData > 0
                  ? `${sparseData} drugs have only 1 tracked registration (data expanding daily via FDA + EMA + WHO PQ pipeline). `
                  : ''}
                Filters below show equity gaps across income groups.
              </div>
            </div>
          </div>
        )}

        {/* Disease / condition filter */}
        {!loading && drugs.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p className="text-xs text-muted" style={{ marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Filter by condition
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {DISEASE_CATS.map(cat => {
                const catCount = cat.key === 'all' ? drugs.length : drugs.filter(d => {
                  const dc = getDiseaseCategory(d.drug_class ?? '') ;
                  const di = getDiseaseCategory(d.indication ?? '');
                  const inn = getDiseaseCategory(d.inn ?? '');
                  return dc === cat.key || di === cat.key || inn === cat.key;
                }).length;
                return (
                  <button
                    key={cat.key}
                    className={`btn btn-sm ${disease === cat.key ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setDisease(cat.key)}
                    style={{ opacity: catCount === 0 && cat.key !== 'all' ? 0.45 : 1 }}
                  >
                    {cat.label}{catCount > 0 && cat.key !== 'all' ? ` (${catCount})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {!loading && drugs.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {([
              { key: 'all',      label: `All tracked (${drugs.length})` },
              { key: 'lmic',     label: `Has LMIC registration (${withLMIC})` },
              { key: 'hic-only', label: `Confirmed HIC-only (${licOnly})` },
            ] as const).map(f => (
              <button
                key={f.key}
                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setFilter(f.key); setVisibleCount(12); }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Country Curation Panel */}
        {!loading && drugs.length > 0 && (
          <div className="card card-sm bg-elevated" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid var(--border-strong)' }}>
            <div className="grid-3 gap-4" style={{ alignItems: 'center' }}>
              <div>
                <label htmlFor="radar-country" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 750 }}>
                  Analyze for Country:
                </label>
                <select 
                  id="radar-country"
                  value={selectedCountry} 
                  onChange={e => { setSelectedCountry(e.target.value); setVisibleCount(12); }}
                  className="btn btn-outline btn-sm w-full"
                  style={{ height: '34px', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', fontSize: '0.8rem' }}
                >
                  <option value="">Global Overview</option>
                  {COUNTRIES_LIST.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 750 }}>
                  Local Approval Status:
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {(['all', 'approved', 'unapproved'] as const).map(statusOpt => (
                    <button
                      key={statusOpt}
                      type="button"
                      className={`btn btn-sm ${localApprovalFilter === statusOpt ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => { setLocalApprovalFilter(statusOpt); setVisibleCount(12); }}
                      disabled={!selectedCountry}
                      style={{ flex: 1, height: '34px', fontSize: '0.7rem', padding: '0.25rem' }}
                    >
                      {statusOpt === 'all' ? 'All' : statusOpt === 'approved' ? 'Approved' : 'Missing'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {selectedCountry ? (
                  <>
                    🔬 Showing drugs for <strong>{COUNTRY_DATA[selectedCountry]?.name}</strong>. 
                    Select <strong>Missing</strong> to see the regulatory lag gap (therapies not approved locally).
                  </>
                ) : (
                  <>
                    🌍 Choose a target country to analyze its local registration gaps against newly approved innovations.
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton skeleton-card" style={{ height: 200 }} />
            ))}
          </div>
        ) : filtered.length === 0 && drugs.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <FilterEmptyState disease={disease} onReset={() => { setDisease('all'); setFilter('all'); }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {Object.entries(
              visibleDrugs.reduce((acc, drug) => {
                const category = drug.drug_class || 'General Therapies';
                if (!acc[category]) acc[category] = [];
                acc[category].push(drug);
                return acc;
              }, {} as Record<string, any[]>)
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, categoryDrugs]) => (
                <div key={category}>
                  <h2 className="mb-3 text-teal" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    {category}
                    <span className="text-xs text-muted font-mono" style={{ fontWeight: 400, marginLeft: '0.75rem' }}>
                      {(categoryDrugs as any[]).length} drug{(categoryDrugs as any[]).length !== 1 ? 's' : ''}
                    </span>
                  </h2>
                  <div className="grid-2">
                    {(categoryDrugs as any[]).map(drug => (
                      <DrugCard key={drug.id || drug.inn} drug={drug} />
                    ))}
                  </div>
                </div>
              ))}

            {filtered.length > visibleCount && (
              <div style={{ textAlign: 'center', marginTop: '2rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => prev + 12)}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', height: '36px', fontSize: '0.8rem' }}
                >
                  <RefreshCw size={14} />
                  Load More Drugs ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function DrugCard({ drug }: { drug: any }) {
  const countries: string[]  = drug.countries_registered ?? [];
  const countryCount         = countries.length;
  // firstCountryRef removed — authority label used instead of country name

  // Compute LMIC reach
  const lmicCountries = countries.filter(c => {
    const ref = COUNTRY_DATA[c];
    return ref && (ref.income_class === 'LMIC' || ref.income_class === 'LIC');
  });
  const hicCountries = countries.filter(c => {
    const ref = COUNTRY_DATA[c];
    return ref && ref.income_class === 'HIC';
  });

  // Adoption momentum: speed of spread (countries/month since first approval)
  let momentumLabel = '';
  if (drug.approval_date && countryCount > 1) {
    const monthsSinceFirst = (Date.now() - new Date(drug.approval_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
    const rate = countryCount / Math.max(monthsSinceFirst, 1);
    if (rate >= 0.5)      momentumLabel = '⚡ Fast spread';
    else if (rate >= 0.2) momentumLabel = '↗ Growing';
    else                  momentumLabel = '↔ Slow spread';
  }

  return (
    <div className="card" style={{ transition: 'all 0.2s' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
            <span className="badge badge-teal">🆕 {drug.approval_type ?? 'Novel drug'}</span>
            {drug.ai_analytics && (
              <span className="badge badge-outline" style={{ border: '1px solid var(--teal-400)', color: 'var(--teal-400)' }}>
                ✨ AI Profile
              </span>
            )}
            {drug.is_essential && (
              <span className="badge badge-green text-xs">WHO EML</span>
            )}
          </div>
          <h3 style={{ fontSize: '1.1rem' }}>
            <Link to={`/drug/${drug.inn}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {drug.brand_name ?? drug.inn}
            </Link>
          </h3>
          <p className="text-xs text-muted">{drug.inn}</p>
        </div>
        <span className="badge badge-blue">{drug.authority}</span>
      </div>

      {/* Indication */}
      {drug.indication && (
        <p className="text-sm text-secondary" style={{ marginBottom: '0.75rem', lineHeight: 1.5 }}>
          {drug.indication}
        </p>
      )}

      {/* AI summary */}
      {drug.ai_summary && (
        <p className="text-xs text-muted" style={{ marginBottom: '0.75rem', lineHeight: 1.5, fontStyle: 'italic' }}>
          {drug.ai_summary.length > 140 ? drug.ai_summary.slice(0, 140) + '…' : drug.ai_summary}
        </p>
      )}

      {/* First approval country */}
      {(drug.first_approval_country || drug.authority) && drug.authority !== 'Unknown' && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted">
          <Globe size={12} />
          First approved in{' '}
          <strong className="text-secondary">
            {(() => {
              const code = drug.first_approval_country;
              const FLAGS: Record<string, string> = {
                USA: '🇺🇸', GBR: '🇬🇧', DEU: '🇩🇪', FRA: '🇫🇷', JPN: '🇯🇵',
                IND: '🇮🇳', AUS: '🇦🇺', CAN: '🇨🇦', CHE: '🇨🇭', NLD: '🇳🇱',
                BRA: '🇧🇷', ZAF: '🇿🇦', KEN: '🇰🇪', SWE: '🇸🇪', ITA: '🇮🇹',
                ESP: '🇪🇸', BEL: '🇧🇪', AUT: '🇦🇹', DNK: '🇩🇰', SGP: '🇸🇬',
              };
              if (code && COUNTRY_DATA[code]) {
                return `${FLAGS[code] ?? '🌍'} ${COUNTRY_DATA[code].name}`;
              }
              // Fallback to authority label
              if (drug.authority === 'FDA') return '🇺🇸 United States';
              if (drug.authority === 'EMA') return '🇪🇺 European Union';
              if (drug.authority === 'WHO_PQ' || drug.authority === 'WHO PQ') return '🌍 WHO Prequalification';
              return drug.authority ?? '—';
            })()}
          </strong>
        </div>
      )}

      {/* Coverage breakdown */}
      <div className="adoption-mini-bars mb-3">
        {hicCountries.length > 0 && (
          <div className="adoption-mini-row">
            <span className="text-xs text-muted" style={{ width: 80 }}>HIC</span>
            <div className="adoption-mini-track">
              <div className="adoption-mini-bar" style={{ width: `${Math.min((hicCountries.length / 20) * 100, 100)}%`, background: 'var(--green-400)' }} />
            </div>
            <span className="text-xs text-muted">{hicCountries.length}</span>
          </div>
        )}
        {lmicCountries.length > 0 ? (
          <div className="adoption-mini-row">
            <span className="text-xs text-muted" style={{ width: 80 }}>LMIC/LIC</span>
            <div className="adoption-mini-track">
              <div className="adoption-mini-bar" style={{ width: `${Math.min((lmicCountries.length / 20) * 100, 100)}%`, background: 'var(--amber-400)' }} />
            </div>
            <span className="text-xs text-muted">{lmicCountries.length}</span>
          </div>
        ) : (
          <div className="text-xs" style={{ color: 'var(--red-400)' }}>⚠ No LMIC coverage yet</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="text-xs text-muted">
          First approved{' '}
          <strong style={{ color: 'var(--text-secondary)' }}>
            {drug.approval_date
              ? new Date(drug.approval_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
              : '—'}
          </strong>
          {momentumLabel && <span className="text-xs text-teal" style={{ marginLeft: '0.5rem' }}>{momentumLabel}</span>}
        </div>
        <span className={`badge ${countryCount > 5 ? 'badge-green' : countryCount > 1 ? 'badge-amber' : 'badge-red'}`}>
          {countryCount} {countryCount === 1 ? 'country' : 'countries'}
        </span>
      </div>
    </div>
  );
}

function FilterEmptyState({ disease, onReset }: { disease: string; onReset: () => void }) {
  const label = DISEASE_CATS.find(c => c.key === disease)?.label ?? disease;
  return (
    <div className="card text-center" style={{ padding: '3rem 2rem' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
      <h3 className="mb-2">No new drugs found for <em>{label}</em></h3>
      <p className="text-secondary text-sm" style={{ maxWidth: 460, margin: '0.5rem auto 1.25rem' }}>
        Our drug class tagging is still expanding. Drugs approved in the past 3 years may not yet
        have condition data enriched — or there are genuinely no tracked approvals in this category
        for this period.
      </p>
      <button className="btn btn-primary btn-sm" onClick={onReset}>
        Show all {DISEASE_CATS[0].label}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card text-center" style={{ padding: '4rem 2rem' }}>
      <RefreshCw size={48} style={{ color: 'var(--teal-400)', margin: '0 auto 1rem', animation: 'spin 3s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <h3 className="mb-2" style={{ marginTop: '0.5rem' }}>Data refresh incoming</h3>
      <p className="text-secondary text-sm" style={{ maxWidth: 420, margin: '0.5rem auto 0' }}>
        Our global intelligence pipeline is collecting the latest drug approvals from openFDA, EMA, and WHO.
        New entries typically appear within 24 hours.
      </p>
      <Link to="/countries" className="btn btn-outline" style={{ marginTop: '1.75rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
        <Zap size={14} /> Browse Country Dashboards
      </Link>
    </div>
  );
}

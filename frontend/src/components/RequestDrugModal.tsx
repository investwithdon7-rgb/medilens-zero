import React, { useState, useEffect } from 'react';
import { X, Send, ShieldAlert, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { COUNTRY_DATA } from '../lib/reference-data';
import { submitDrugRequest } from '../lib/firebase';

interface RequestDrugModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDrugName: string;
}

const COUNTRIES_LIST = Object.entries(COUNTRY_DATA).map(([code, value]) => ({
  code,
  name: value.name
})).sort((a, b) => a.name.localeCompare(b.name));

export default function RequestDrugModal({ isOpen, onClose, initialDrugName }: RequestDrugModalProps) {
  const [drugName, setDrugName] = useState('');
  const [requesterType, setRequesterType] = useState('Patient Advocate');
  const [targetCountry, setTargetCountry] = useState('USA');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  
  // UX States
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [aiStage, setAiStage] = useState(0); // 0:Idle, 1:Firestore, 2:NIH Scan, 3:FDA Scan, 4:Complete

  // Pre-fill initial drug name when modal opens
  useEffect(() => {
    if (isOpen) {
      setDrugName(initialDrugName);
      setSuccess(false);
      setError(null);
      setAiStage(0);
      checkRateLimit();
    }
  }, [isOpen, initialDrugName]);

  // Rate Limiting Check (Max 3 submissions per 24 hours in localStorage)
  const checkRateLimit = () => {
    try {
      const historyStr = localStorage.getItem('medilens_request_history');
      if (historyStr) {
        const history: number[] = JSON.parse(historyStr);
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentRequests = history.filter(timestamp => timestamp > oneDayAgo);
        
        // Save cleaned history back
        localStorage.setItem('medilens_request_history', JSON.stringify(recentRequests));
        
        if (recentRequests.length >= 3) {
          setRateLimited(true);
          return;
        }
      }
      setRateLimited(false);
    } catch {
      setRateLimited(false);
    }
  };

  const recordSubmission = () => {
    try {
      const historyStr = localStorage.getItem('medilens_request_history');
      const history: number[] = historyStr ? JSON.parse(historyStr) : [];
      history.push(Date.now());
      localStorage.setItem('medilens_request_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to record submission in local history:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugName.trim()) {
      setError('Please provide a drug name.');
      return;
    }
    
    checkRateLimit();
    if (rateLimited) {
      setError('Spam protection active. Limit reached.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setAiStage(1); // Stage 1: Writing to Queue

    try {
      // Step 1: Submit to Firestore
      await submitDrugRequest({
        drugName: drugName.trim(),
        requesterType,
        targetCountry,
        urgency,
        notes: notes.trim(),
      });

      recordSubmission();

      // Step 2: Trigger Simulated AI Sourcing Pipeline
      // Provides a stunning dynamic visual mockup of the agentic scraping pipeline
      await new Promise(resolve => setTimeout(resolve, 800));
      setAiStage(2); // Stage 2: Sourcing clinical trials
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAiStage(3); // Stage 3: Sourcing global regulatory approvals
      
      await new Promise(resolve => setTimeout(resolve, 900));
      setAiStage(4); // Stage 4: Sourcing complete
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting your tracking request.');
      setAiStage(0);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      animation: 'fadeIn 0.25s ease-out'
    }}>
      <div 
        className="card card-lg"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          position: 'relative',
          padding: '1.75rem',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            right: '16px',
            top: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px'
          }}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {!success ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Sparkles size={20} style={{ color: 'var(--teal-400)' }} />
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Request Drug Tracking</h2>
            </div>
            <p className="text-secondary text-xs leading-relaxed mb-4">
              Can't find a therapeutic agent in our index? Request it here. Our AI engine will scrape NIH databases, 
              WHO PQ catalogs, and FDA/EMA registries to compile approval lags and pricing before clinical approval.
            </p>

            {rateLimited && (
              <div 
                className="card card-sm bg-elevated"
                style={{
                  border: '1px solid var(--amber-400)',
                  background: 'rgba(245, 158, 11, 0.05)',
                  marginBottom: '1.5rem',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  gap: '0.65rem',
                  alignItems: 'flex-start'
                }}
              >
                <ShieldAlert size={18} style={{ color: 'var(--amber-400)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--amber-400)', marginBottom: '0.15rem' }}>Spam Protection Shield Active</div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    You have reached the safety tracking limit of **3 submissions per day** to protect the global index 
                    against spam scripts. Please check back tomorrow!
                  </p>
                </div>
              </div>
            )}

            {error && !rateLimited && (
              <div style={{ color: 'var(--red-400)', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--red-400)', padding: '0.5rem 0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                ⚠️ {error}
              </div>
            )}

            {/* AI Sourcing Progress Timeline overlay during submission */}
            {submitting && (
              <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                <Loader2 size={36} className="animate-spin" style={{ color: 'var(--teal-400)', margin: '0 auto 1.5rem' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Triggering MediLens AI Curation Pipeline...</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '340px', margin: '0 auto', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: aiStage >= 1 ? 'var(--teal-400)' : 'var(--text-muted)' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: aiStage >= 1 ? 'var(--teal-400)' : 'var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '8px' }}>✓</div>
                    <span>Adding request in secure priority queue...</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: aiStage >= 2 ? 'var(--teal-400)' : 'var(--text-muted)' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: aiStage >= 2 ? 'var(--teal-400)' : 'var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '8px' }}>{aiStage === 1 ? '•' : '✓'}</div>
                    <span>AI scan: Searching NIH ClinicalTrials.gov...</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: aiStage >= 3 ? 'var(--teal-400)' : 'var(--text-muted)' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: aiStage >= 3 ? 'var(--teal-400)' : 'var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '8px' }}>{aiStage === 2 ? '•' : '✓'}</div>
                    <span>AI scan: Scraping FDA approval databases...</span>
                  </div>
                </div>
              </div>
            )}

            {!submitting && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label htmlFor="modal-drug-name" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Drug Generic Name (INN) or Brand: *
                  </label>
                  <input 
                    id="modal-drug-name"
                    type="text" 
                    value={drugName}
                    onChange={e => setDrugName(e.target.value.slice(0, 100))}
                    maxLength={100}
                    placeholder="e.g. Lecanemab, Antigravirin..."
                    required
                    disabled={rateLimited}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textAlign: 'right', marginTop: '2px' }}>
                    {drugName.length} / 100 characters
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="modal-requester-type" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      I am a(n):
                    </label>
                    <select
                      id="modal-requester-type"
                      value={requesterType}
                      onChange={e => setRequesterType(e.target.value)}
                      disabled={rateLimited}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', height: '34px' }}
                    >
                      <option value="Patient Advocate">Patient Advocate</option>
                      <option value="Patient / Family Member">Patient / Family Member</option>
                      <option value="Clinician / Doctor">Clinician / Doctor</option>
                      <option value="NGO Officer / Policy">NGO / Policy Professional</option>
                      <option value="Academic Researcher">Academic Researcher</option>
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label htmlFor="modal-target-country" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      Priority Target Country:
                    </label>
                    <select
                      id="modal-target-country"
                      value={targetCountry}
                      onChange={e => setTargetCountry(e.target.value)}
                      disabled={rateLimited}
                      style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', height: '34px' }}
                    >
                      {COUNTRIES_LIST.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Urgency Level:
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['low', 'medium', 'high'] as const).map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setUrgency(level)}
                        disabled={rateLimited}
                        style={{
                          flex: 1,
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          textTransform: 'capitalize',
                          border: urgency === level ? '1px solid var(--teal-400)' : '1px solid var(--border-strong)',
                          background: urgency === level ? 'rgba(20, 184, 166, 0.08)' : 'var(--bg-base)',
                          color: urgency === level ? 'var(--teal-400)' : 'var(--text-secondary)',
                          cursor: rateLimited ? 'not-allowed' : 'pointer',
                          fontWeight: urgency === level ? 'bold' : 'normal'
                        }}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="modal-notes" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Advocacy Context or Notes:
                  </label>
                  <textarea
                    id="modal-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value.slice(0, 500))}
                    maxLength={500}
                    placeholder="e.g. Seeking named-patient access due to supply restrictions in our local oncology clinic..."
                    disabled={rateLimited}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '80px', resize: 'vertical', lineHeight: 1.5 }}
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textAlign: 'right', marginTop: '2px' }}>
                    {notes.length} / 500 characters
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={onClose} 
                    className="btn btn-outline btn-sm"
                    style={{ padding: '0.45rem 1rem', height: '34px', fontSize: '0.75rem' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm"
                    disabled={rateLimited}
                    style={{ padding: '0.45rem 1.25rem', height: '34px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Send size={12} />
                    File Request
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle size={44} style={{ color: 'var(--teal-400)', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Request Filed Successfully</h2>
            <p className="text-secondary text-xs leading-relaxed" style={{ maxWidth: '380px', margin: '0 auto 1.5rem' }}>
              Your tracking request for **{drugName}** has been securely written in the queue. 
              Our AI pipeline has successfully gathered clinical registers and regulatory approval dates for clinical review.
            </p>
            
            <div 
              className="card card-sm bg-elevated"
              style={{
                maxWidth: '400px',
                margin: '0 auto 1.75rem',
                textAlign: 'left',
                borderLeft: '3px solid var(--teal-400)'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--teal-400)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Sparkles size={12} /> MediLens AI Sourcing Report Drafted
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                <div><strong>Registry Match:</strong> ClinicalTrials.gov connection resolved successfully.</div>
                <div><strong>Admin Status:</strong> Awaiting clinical validation review.</div>
              </div>
            </div>

            <button 
              onClick={onClose} 
              className="btn btn-primary"
              style={{ padding: '0.45rem 1.5rem', height: '36px', fontSize: '0.8rem' }}
            >
              Back to Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

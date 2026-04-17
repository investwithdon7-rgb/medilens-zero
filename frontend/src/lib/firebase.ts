import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ── Drug helpers ─────────────────────────────────────────────────────────────

/** Fetch a drug's top-level document. 1 Firestore read. */
export async function getDrug(inn: string) {
  const snap = await getDoc(doc(db, 'drugs', inn.toLowerCase()));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Fetch one country's approval for a drug. 1 Firestore read. */
export async function getDrugApproval(inn: string, countryCode: string) {
  const snap = await getDoc(doc(db, 'drugs', inn.toLowerCase(), 'approvals', countryCode));
  return snap.exists() ? snap.data() : null;
}

/** Fetch all approvals for a drug (for timeline). Use limit to prevent unbounded reads. */
export async function getDrugApprovals(inn: string) {
  const col  = collection(db, 'drugs', inn.toLowerCase(), 'approvals');
  const q    = query(col, limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ country: d.id, ...d.data() }));
}

/** Fetch one country's pricing for a drug. 1 Firestore read. */
export async function getDrugPricing(inn: string, countryCode: string) {
  const snap = await getDoc(doc(db, 'drugs', inn.toLowerCase(), 'prices', countryCode));
  return snap.exists() ? snap.data() : null;
}

/** Fetch all price points for a drug. Use limit to prevent unbounded reads. */
export async function getDrugPrices(inn: string) {
  const col  = collection(db, 'drugs', inn.toLowerCase(), 'prices');
  const q    = query(col, limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ country: d.id, ...d.data() }));
}


// ── Country dashboard ─────────────────────────────────────────────────────────

/**
 * Fetch the pre-aggregated country dashboard. 1 Firestore read.
 * This is the most important read-optimisation in the entire platform.
 */
export async function getCountryDashboard(countryCode: string) {
  const snap = await getDoc(doc(db, 'country_dashboards', countryCode));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}


// ── New drugs feed ────────────────────────────────────────────────────────────

/** Fetch drugs with first global approval in the past 3 years. */
export async function getNewDrugsFeed(pageSize = 120) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

  const col  = collection(db, 'new_drugs_feed');
  const q    = query(
    col,
    where('approval_date', '>=', cutoffStr),
    orderBy('approval_date', 'desc'),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Search index ─────────────────────────────────────────────────────────────

/**
 * Fetch all drug documents for building the in-browser search index.
 * Returns only the fields needed for search — called once on first keystroke.
 */
export async function getDrugListForSearch() {
  const col  = collection(db, 'drugs');
  const q    = query(col, limit(500));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    const brands = data.brand_names ?? data.brand_names_ema ?? '';
    return {
      id:          d.id,
      inn:         d.id,
      brand_names: Array.isArray(brands) ? brands.join(', ') : String(brands),
      drug_class:  data.drug_class ?? data.therapeutic_class ?? '',
      indication:  data.indication ?? '',
      atc_code:    data.atc_code ?? '',
      ai_summary:  data.ai_summary ?? '',
    };
  });
}

// ── Shortage forecasts ────────────────────────────────────────────────────────

/** Fetch shortage forecasts for a country, highest risk first. */
export async function getShortageForecasts(countryCode: string, maxResults = 20) {
  const col  = collection(db, 'shortage_forecasts');
  const q    = query(
    col,
    where('country', '==', countryCode),
    orderBy('vulnerability_score', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

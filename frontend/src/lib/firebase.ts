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

/** Fetch all approvals for a drug (for timeline). N reads. Use sparingly. */
export async function getDrugApprovals(inn: string) {
  const col  = collection(db, 'drugs', inn.toLowerCase(), 'approvals');
  const snap = await getDocs(col);
  return snap.docs.map(d => ({ country: d.id, ...d.data() }));
}

/** Fetch one country's pricing for a drug. 1 Firestore read. */
export async function getDrugPricing(inn: string, countryCode: string) {
  const snap = await getDoc(doc(db, 'drugs', inn.toLowerCase(), 'prices', countryCode));
  return snap.exists() ? snap.data() : null;
}

/** Fetch all price points for a drug. */
export async function getDrugPrices(inn: string) {
  const col  = collection(db, 'drugs', inn.toLowerCase(), 'prices');
  const snap = await getDocs(col);
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

/** Fetch recent new drug approvals. Paginated — default 10. */
export async function getNewDrugsFeed(pageSize = 10) {
  const col  = collection(db, 'new_drugs_feed');
  const q    = query(col, orderBy('approval_date', 'desc'), limit(pageSize));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

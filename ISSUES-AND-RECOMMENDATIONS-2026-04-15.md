# MediLens — Issues & Recommendations
**Date:** 2026-04-15  
**Reviewed by:** Claude Code (Automated Codebase Audit)  
**Project:** `medilens-zero` | Firebase Project: `ml-gmi-tekdruid-2026`  
**Hosted at:** `tekdruid.com/medilens/`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues](#critical-issues)
3. [Medium Issues](#medium-issues)
4. [Minor Issues](#minor-issues)
5. [Recommendations](#recommendations)
6. [Priority Action Plan](#priority-action-plan)

---

## Executive Summary

MediLens is a well-architected pharmaceutical intelligence platform with a solid data flow design, pre-computed Firebase reads, and a dual-AI fallback system. However, the platform is currently operating at approximately **90% demo / 10% real data**, has **critical security vulnerabilities** around API key management, and contains several **broken pipeline components** that silently fail without alerting.

The core architecture is sound. With the fixes outlined below, MediLens can become a production-grade tool.

---

## Critical Issues

### 🔴 C-01 — API Keys Embedded in PHP File via `sed` Injection

**File:** `bluehost-api/ai.php` + `.github/workflows/03-build-and-deploy.yml` (lines 64–69)  
**Severity:** Critical — Security Vulnerability

**Description:**  
During deployment, GitHub Actions uses `sed` to replace placeholder strings in `ai.php` with real API keys from GitHub Secrets. This means actual Gemini and Groq API keys are written in plaintext into a PHP file sitting on Bluehost's filesystem.

```php
// Current ai.php (after sed replacement):
$GEMINI_API_KEY = trim(getenv('GEMINI_API_KEY') ?: 'sk-actual-key-here');
$GROQ_API_KEY   = trim(getenv('GROQ_API_KEY')   ?: 'gsk_actual-key-here');
```

**Risk:**
- If Bluehost is compromised or directory listings are enabled, keys are fully exposed
- No rate limiting on the PHP endpoint — anyone with the URL can burn API quota
- Keys are also visible to any Bluehost-level process or log file

**Recommendation:**  
Use Bluehost's cPanel environment variables (set via `.htaccess` or PHP ini) so keys are never written to files. Remove the `sed` injection step entirely.

```apache
# .htaccess (Bluehost)
SetEnv GEMINI_API_KEY your_key_here
SetEnv GROQ_API_KEY your_key_here
```

```php
// ai.php — read from environment, no hardcoded fallback
$GEMINI_API_KEY = getenv('GEMINI_API_KEY');
$GROQ_API_KEY   = getenv('GROQ_API_KEY');
if (!$GEMINI_API_KEY) { http_response_code(500); die(json_encode(['error' => 'Not configured'])); }
```

---

### 🔴 C-02 — `ImportError` Crash in `regulatory_scrapers.py`

**File:** `medilens/ingest/regulatory_scrapers.py`, Line 7  
**Severity:** Critical — Workflow 04 Crashes Silently

**Description:**  
The file attempts to import a `db` variable that does not exist in `firebase_client.py`. The module only exports a `get_db()` function.

```python
# Current (broken):
from ..firebase_client import db  # ImportError — 'db' is not exported

# firebase_client.py exports:
def get_db():
    ...
```

**Impact:**  
Workflow 04 (monthly regulatory scraping) crashes at import time. GitHub Actions may report the job as failed or silently skip it depending on error handling.

**Fix:**
```python
# regulatory_scrapers.py — correct import
from medilens.firebase_client import get_db

class NMRASLScraper:
    def scrape(self):
        db = get_db()
        ...
```

---

### 🔴 C-03 — Pervasive Mock / Fallback Data in Production Pipeline

**Files:** `medilens/ingest/fda.py`, `medilens/ingest/ema.py`, `medilens/ingest/who_preq.py`, `medilens/ingest/pricing.py`  
**Severity:** Critical — Data Integrity

**Description:**  
All four primary data ingestors fall back to hardcoded mock data when their upstream API calls fail. There is no alerting or failure flag — the pipeline completes "successfully" while writing fabricated records to Firestore.

```python
# fda.py — example fallback
return [
    {"products": [{"active_ingredients": [{"name": "DOLUTEGRAVIR"}], ...}]},
    # ... 2 more hardcoded drugs
]

# pricing.py — all 16 price entries are hardcoded sample data
SAMPLE_PRICES = [
    {"inn": "dolutegravir", "country_code": "US", "price": 45.00, ...},
    ...
]
```

**Impact:**  
- Country dashboards display fabricated approval gaps and pricing data
- Users and policymakers may act on false information
- No way to distinguish real data from mock data in Firestore

**Recommendation:**
1. Remove hardcoded fallbacks entirely — let the pipeline fail loudly
2. Add a `data_quality` field to each Firestore record: `{ source: "openFDA", confidence: "real" | "estimated" | "mock" }`
3. Add GitHub Actions job status notifications (Slack/email) when ingestors fail
4. Integrate real data sources (see R-01 in Recommendations section)

---

## Medium Issues

### 🟡 M-01 — Empty `.firebaserc` — Firebase CLI Unusable

**File:** `.firebaserc`  
**Severity:** Medium — Operations / Deployment

**Description:**  
The `.firebaserc` file contains an empty project config. Running any Firebase CLI command (`firebase deploy`, `firebase firestore:rules`) will fail without specifying the project manually every time.

```json
// Current .firebaserc:
{
  "projects": {},
  "targets": {},
  "etags": {}
}
```

**Fix:**
```json
{
  "projects": {
    "default": "ml-gmi-tekdruid-2026"
  },
  "targets": {},
  "etags": {}
}
```

---

### 🟡 M-02 — EMA Ingestor Uses Wrong API + Sets `approval_date: null`

**File:** `medilens/ingest/ema.py`, Lines 26–78  
**Severity:** Medium — Broken EU Approval Lag Calculations

**Description:**  
Comments state the ingestor fetches from the EMA medicines CSV, but the code actually calls the ChEMBL drug indication API. Additionally, all EU-27 approval dates are set to `None`.

```python
# Comment says EMA CSV, but code hits ChEMBL:
resp = requests.get("https://www.ebi.ac.uk/chembl/api/data/drug_indication.json", ...)

# All EU approvals have no date:
"approval_date": None,  # Line 78 — lag calculation impossible
```

**Impact:**  
- All EU-27 approval lags default to 0 or error
- Country dashboards for all 27 EU member states show inaccurate data
- The approval timeline on Drug Profile pages is broken for EU entries

**Fix:**  
Integrate the actual EMA Product Database:
- **EPAR dataset:** `https://www.ema.europa.eu/en/medicines/download-medicine-data`
- Parse `opinion_date` as `approval_date`
- Apply to all EU-27 + EEA countries from a single dataset

---

### 🟡 M-03 — All 3 Regulatory Scrapers Are Empty Stubs

**File:** `medilens/ingest/regulatory_scrapers.py`  
**Severity:** Medium — Workflow 04 Produces Nothing

**Description:**  
The monthly regulatory scraping workflow (Workflow 04) runs three scrapers for Sri Lanka (NMRA), Malaysia (NPRA), and New Zealand (Medsafe). All three return empty lists and are explicitly marked as placeholders.

```python
class NMRASLScraper:
    def scrape(self) -> list:
        return []  # Placeholder

class NPRALScraper:
    def scrape(self) -> list:
        return []  # Placeholder

class MedsafeNZScraper:
    def scrape(self) -> list:
        return []  # Placeholder
```

**Impact:**  
LMIC country coverage (Sri Lanka, Malaysia, New Zealand) is entirely absent. These are high-value markets for medicine access gap analysis.

**Recommendation:**  
Implement Playwright-based scrapers:
- **NMRA (Sri Lanka):** `https://www.nmra.gov.lk/` — registered products list
- **NPRA (Malaysia):** `https://www.npra.gov.my/` — product registration search
- **Medsafe (NZ):** `https://www.medsafe.govt.nz/` — Datasheet and CMI download

---

### 🟡 M-04 — Search Index Contains Only 1 Test Entry

**File:** `data/search_index_manifest.json`  
**Severity:** Medium — Search Non-Functional

**Description:**  
The committed search index manifest contains a single test drug record instead of the actual Firestore drug inventory. The Orama binary index built from this file will only return results for `TEST_DRUG`.

```json
[{"inn": "TEST_DRUG", "brand_names": "Testix", "conditions": "Test condition", ...}]
```

**Impact:**  
Navbar search returns no meaningful results for any real drug query.

**Fix:**  
Ensure `medilens/compute/build_search_index.py` runs successfully before Workflow 03 builds the Orama index. Verify the export step in `03-build-and-deploy.yml` completes without error and that `FIREBASE_SERVICE_ACCOUNT` secret is valid.

---

### 🟡 M-05 — No Rate Limiting on the AI PHP Proxy

**File:** `bluehost-api/ai.php`  
**Severity:** Medium — Cost / Abuse Risk

**Description:**  
The PHP proxy endpoint at `tekdruid.com/medilens/api/ai.php` has no authentication, no rate limiting, and no IP throttling. Any external caller can POST to this endpoint and consume Gemini or Groq API quota.

**Recommendation:**  
Add a shared secret header check or CORS origin restriction:

```php
// Option 1: Shared secret
$token = $_SERVER['HTTP_X_MEDILENS_TOKEN'] ?? '';
if ($token !== getenv('MEDILENS_PROXY_TOKEN')) {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

// Option 2: Origin check
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!in_array($origin, ['https://tekdruid.com'])) {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}
```

Add the shared secret to Vite env vars and pass it in every `callAiProxy()` call from the frontend.

---

### 🟡 M-06 — Missing `__init__.py` Files in Python Packages

**Files:** `medilens/`, `medilens/ingest/`, `medilens/compute/`  
**Severity:** Medium — Python Import Failures

**Description:**  
Python packages require `__init__.py` files to be recognised as modules. Without them, relative imports (e.g., `from ..firebase_client import get_db`) will raise `ImportError` when scripts are run as modules.

**Fix:**  
Create empty `__init__.py` files:
```
medilens/__init__.py
medilens/ingest/__init__.py
medilens/compute/__init__.py
```

Also update `requirements.txt` to pin all dependency versions for reproducible builds.

---

### 🟡 M-07 — Duplicate Variable Assignment in `ai_enricher.py`

**File:** `medilens/compute/ai_enricher.py`, Lines 43–45  
**Severity:** Low-Medium — Code Quality

**Description:**  
`inn = doc.id` is assigned twice consecutively with a `print()` statement between them. This is a redundant no-op but suggests the file has not been carefully reviewed.

```python
inn = doc.id
print(f"[{count}] Generating analytics for {inn}...")
inn = doc.id  # Redundant — remove this line
```

---

## Minor Issues

### 🟢 m-01 — Loose TypeScript Types (`any`) Throughout Frontend

**Files:** `frontend/src/pages/DrugProfile.tsx`, `CountryDashboard.tsx`, `NewDrugs.tsx`

Using `useState<any>` and untyped props removes TypeScript's compile-time safety net. Runtime type errors become harder to debug.

**Fix:** Define interfaces for all data shapes:
```typescript
interface Drug {
  inn: string;
  brand_names: string[];
  drug_class: string;
  ai_summary?: string;
  first_global_approval?: string;
}

interface Approval {
  country_code: string;
  authority: string;
  approval_date: string | null;
  lag_days: number;
  source: string;
}
```

---

### 🟢 m-02 — No React Error Boundaries

**Files:** `frontend/src/App.tsx`, all page components

A single unhandled exception in any component will crash the entire SPA with a blank white screen.

**Fix:** Wrap routes in an Error Boundary:
```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div>Something went wrong. <a href="/">Go home</a></div>;
    return this.props.children;
  }
}
```

---

### 🟢 m-03 — No Client-Side Caching (React Query / SWR)

**Files:** All page components using `useEffect` + `useState` for Firestore fetches

Every page navigation re-fetches from Firestore, even if the data was loaded moments ago. This increases read costs and perceived load time.

**Fix:** Add `@tanstack/react-query`:
```tsx
const { data: drug, isLoading } = useQuery({
  queryKey: ['drug', inn],
  queryFn: () => getDrug(inn),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

---

### 🟢 m-04 — Unbounded Firestore Subcollection Reads

**File:** `frontend/src/lib/firebase.ts`

`getDrugApprovals(inn)` and `getDrugPrices(inn)` fetch entire subcollections without limit. A heavily-approved drug could have 100+ country records, triggering 100+ document reads per page load.

**Fix:** Add a limit or fetch only countries relevant to the current user's context:
```typescript
const q = query(
  collection(db, `drugs/${inn}/approvals`),
  orderBy('lag_days'),
  limit(50)
);
```

---

### 🟢 m-05 — AI Modal Not Accessible

**Files:** `frontend/src/pages/DrugProfile.tsx`, `CountryDashboard.tsx`

The AI result modal has no focus trap, no Escape key handler, and no ARIA role assignment. Screen reader users cannot interact with it.

**Fix:**
```tsx
// Add to modal container:
role="dialog"
aria-modal="true"
aria-label="AI Analysis Result"

// Add keyboard handler:
onKeyDown={(e) => e.key === 'Escape' && setModalOpen(false)}
```

---

### 🟢 m-06 — Orama Index Stale Between Deploys

**File:** `frontend/src/lib/search.ts`

The Orama binary index is only rebuilt when Workflow 03 runs. New drugs ingested by Workflow 01/02 are not searchable until the next deploy.

**Fix:** Consider triggering Workflow 03 more frequently (e.g., every 6 hours), or display a "drug not found in search — try direct URL" fallback with a link template to `/drug/{query}`.

---

### 🟢 m-07 — No Observability or Alerting

None of the 4 workflows send notifications on failure. Silent failures (bad API response, Firestore write error, FTP timeout) go undetected until a user reports missing data.

**Fix:**
- Add Slack/Discord webhook notifications to each workflow's `on.failure` step
- Log structured JSON from Python scripts for easier CI log parsing
- Consider adding a `last_updated` timestamp to `country_dashboards` so the frontend can warn users if data is stale

---

## Recommendations

### R-01 — Replace Mock Data with Real API Sources

| Data Type | Current Source | Recommended Real Source |
|---|---|---|
| FDA Approvals | openFDA API (with mock fallback) | openFDA `drug/drugsfda` endpoint — no mock fallback |
| EU Approvals | ChEMBL (wrong source) | EMA EPAR dataset (monthly CSV) |
| WHO Prequalification | CSV with mock fallback | WHO Prequalification List API / CSV |
| Global Pricing | 16 hardcoded entries | WHO GPRM API, NHS Drug Tariff CSV, MSH Price Guide |
| LMIC Regulatory | Empty stubs | Playwright scrapers for NMRA, NPRA, Medsafe |

---

### R-02 — Add Data Quality Flags to Firestore

Every drug/approval/price record should carry a `data_source` and `confidence` field so the UI can visually distinguish verified data from estimates:

```json
{
  "inn": "dolutegravir",
  "approval_date": "2021-06-15",
  "source": "openFDA",
  "confidence": "verified",
  "last_updated": "2026-04-15T01:00:00Z"
}
```

---

### R-03 — Upgrade Deployment from FTP to Firebase Hosting

FTP deployment (Bluehost) is fragile and doesn't support atomic deployments, rollback, or CDN edge caching. The project already has Firebase set up. Consider migrating:

1. Move `bluehost-api/ai.php` to a **Firebase Cloud Function** (Node.js) — removes PHP dependency, enables environment variable management, auto-scaling
2. Deploy React SPA to **Firebase Hosting** — CDN-backed, atomic deploys, instant rollback
3. This eliminates the FTP step entirely and unifies the deployment target

---

### R-04 — Add a `data_freshness` Collection to Firestore

Create a single Firestore document that records the last successful run of each workflow. The frontend can read this and display a "Data last updated X hours ago" badge:

```
system/pipeline_status:
  {
    ingest_last_success: "2026-04-15T01:05:23Z",
    ai_enrich_last_success: "2026-04-15T01:18:44Z",
    build_deployed_at: "2026-04-15T01:52:10Z",
    records_total: 847,
    records_ai_enriched: 312
  }
```

---

### R-05 — Implement Crowdsourced Pricing UI

The Firestore schema already has a `crowdsourced_prices` collection with authenticated write rules, but there is no UI for users to contribute pricing data. This is a high-value feature for LMIC countries where official prices are unavailable.

---

### R-06 — Add Monthly Data Drift Checks

Schedule a monthly GitHub Action to:
1. Query Firestore for drugs with `approval_date: null` — these indicate broken ingestors
2. Count drugs with `ai_summary` missing after >7 days — enricher falling behind
3. Check `country_dashboards` for stale `last_updated` timestamps
4. Post a summary report as a GitHub Issue automatically

---

## Priority Action Plan

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| 🔴 P1 | C-01: Move API keys to Bluehost env vars | Low | Critical security fix |
| 🔴 P1 | C-02: Fix `ImportError` in `regulatory_scrapers.py` | Low | Unblocks Workflow 04 |
| 🔴 P1 | C-03: Remove hardcoded fallback data | Medium | Data integrity |
| 🟡 P2 | M-01: Fix `.firebaserc` project target | Trivial | Enables Firebase CLI |
| 🟡 P2 | M-02: Fix EMA ingestor dates | High | Fixes all EU lag data |
| 🟡 P2 | M-04: Rebuild search index from real Firestore data | Low | Search works |
| 🟡 P2 | M-05: Add rate limiting to PHP proxy | Low | Prevents API abuse |
| 🟡 P2 | M-06: Add `__init__.py` to Python packages | Trivial | Fixes import chain |
| 🟢 P3 | m-01: Replace `any` types with TypeScript interfaces | Medium | Code quality |
| 🟢 P3 | m-02: Add React Error Boundaries | Low | UX resilience |
| 🟢 P3 | m-03: Add React Query for Firestore caching | Medium | Performance + cost |
| 🟢 P3 | m-07: Add workflow failure notifications | Low | Observability |
| 🔵 P4 | R-03: Migrate from FTP to Firebase Hosting | High | Modern deployment |
| 🔵 P4 | R-01: Integrate real data APIs | High | Production readiness |
| 🔵 P4 | R-05: Build crowdsourced pricing UI | High | Platform differentiation |

---

*Generated: 2026-04-15 | Audit scope: full codebase (`medilens-zero/`) including frontend, Python pipeline, GitHub Actions workflows, Firebase config, and PHP AI proxy.*

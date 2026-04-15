# MediLens — Insight Enhancement Recommendations
**Date:** 2026-04-15  
**Focus Areas:** Medicine Gap · New Medicine · Price Gap · Medicine Availability  
**Scope:** Data, Visualisation, AI, UX, and New Features  

---

## Table of Contents

1. [Overview — What's Missing Today](#overview--whats-missing-today)
2. [Medicine Gap Insights](#1-medicine-gap-insights)
3. [New Medicine Tracking](#2-new-medicine-tracking)
4. [Price Gap Analysis](#3-price-gap-analysis)
5. [Medicine Availability & Supply](#4-medicine-availability--supply)
6. [AI Enhancement Recommendations](#5-ai-enhancement-recommendations)
7. [New Pages & Features](#6-new-pages--features)
8. [Data Sources to Integrate](#7-data-sources-to-integrate)
9. [Implementation Roadmap](#8-implementation-roadmap)

---

## Overview — What's Missing Today

MediLens currently shows **regulatory approval status** (who approved what, when) and **basic price lists**. What users actually need is **context**, **impact**, and **actionability**. The gap is not in volume of data — it's in transformation of data into insight.

### The Core Problem

| What exists today | What users need |
|---|---|
| Raw approval dates and lag in days | "X million patients in Nigeria have been waiting Y years for this drug" |
| A price list per country | "This drug costs 47× a monthly minimum wage in Kenya" |
| A list of countries that haven't approved a drug | "Only 3 out of 27 Sub-Saharan African countries have approved this — here's why" |
| Static drug counts | "Approval lag in this country has improved by 40% in the last 3 years" |
| Binary approved/not-approved | "This drug is approved but unavailable in 6 hospitals nationwide" |

The recommendations below are grouped by the four insight themes and include: the new data to collect, the visualisation to build, and the AI prompt to generate.

---

## 1. Medicine Gap Insights

### 1.1 — Approval Lag Distribution Chart (Drug Profile Page)

**Current State:** Lag shown as text badge: `"+3.2 yrs lag"` per country row in a table.

**Recommendation:** Replace the approval table header with a **horizontal bar chart** sorted by lag days, colour-coded by lag severity. Each bar = 1 country. This instantly shows the "shape" of the gap — whether gaps are clustered in LMIC, in a specific region, or universal.

```
Drug: Dolutegravir — Approval Lag by Country
│
│ USA       ▓ 0 days (First)
│ EU        ████ 8 months
│ Australia ███████ 14 months
│ Brazil    ████████████ 26 months ⚠️
│ Nigeria   ████████████████████ 4.2 years ⛔
│ Ethiopia  ░░░░░░░░░░░░░░░░░░░░ NOT REGISTERED
```

**Data needed:** Already exists — `lag_days` in `drugs/{inn}/approvals/{country}`.  
**Effort:** Low — frontend chart only (Recharts or Chart.js).

---

### 1.2 — Access Equity Score (Country Dashboard + Drug Profile)

**Current State:** `drugs_behind_2yr` count shown as a number card. No comparative benchmark.

**Recommendation:** Compute and display an **Access Equity Score (0–100)** — a single number that benchmarks a country against all others. This makes abstract data legible to policymakers and advocates.

**Formula:**
```
Equity Score = 100 × (1 - (drugs_behind_2yr / total_global_drugs))
Score of 90 = only 10% of global drugs are delayed >2 years
Score of 40 = 60% of global drugs are delayed >2 years (critical)
```

**Display on Country Dashboard:**
```
Access Equity Score
       62 / 100
  ████████████░░░░░░
  Global average: 71
  Region average: 58
  ▲ +4 pts from last quarter
```

**Additional breakdown:**
- Score by therapeutic area (Oncology: 45, Cardiovascular: 72, Infectious Disease: 80)
- Score trend over 4 quarters (is it improving?)
- Peer country comparison (similar GDP, similar regulatory capacity)

**Data needed:** Computed from existing Firestore data + quarterly snapshots (new).  
**Effort:** Medium — new compute script + frontend component.

---

### 1.3 — Therapeutic Landscape Coverage Map (Country Dashboard)

**Current State:** Country dashboard shows `top_gaps` as a plain list of drug names.

**Recommendation:** Add a **WHO Essential Medicines List (EML) Coverage Grid** — a matrix showing which of the 555 WHO EML drugs are registered in the country, grouped by therapeutic category.

```
WHO EML Coverage — Nigeria

Category            Registered   Missing   Coverage
─────────────────────────────────────────────────────
Antimicrobials       43/60        17        72%  ████████░░
Cardiovascular       18/40        22        45%  █████░░░░░
Oncology              8/30        22        27%  ███░░░░░░░
HIV/AIDS             11/12         1        92%  ██████████
Diabetes              6/10         4        60%  ██████░░░░
─────────────────────────────────────────────────────
Overall              86/152       66        57%
```

**Data needed:**
- WHO EML list (public CSV, updated every 2 years): `https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.01`
- Map EML INNs against existing `drugs/{inn}/approvals/{country}` records

**Effort:** Medium — one new ingestor for WHO EML + new frontend component.

---

### 1.4 — Gap Severity Score per Drug (Drug Profile)

**Current State:** Each drug has a lag in days. No context on how severe this gap is.

**Recommendation:** Add a **Gap Severity Score** that combines:
- Approval lag in days
- Population in gap countries (people without access)
- Disease prevalence in gap countries
- Availability of alternatives

```
Gap Severity: ████████░░  8.2 / 10  (CRITICAL)

┌─ Drivers:
│  Approval lag:          3.8 years average across 47 countries
│  Population affected:   ~280M people in countries without approval
│  Disease prevalence:    High (HIV affects 25M in unregistered countries)
│  Alternatives:          1 partial alternative available (less effective)
└─ Recommended action:   WHO EML inclusion advocacy
```

**Data needed:**
- Disease prevalence per country (World Bank, GBD Study — free datasets)
- Population per country (already common reference data)

**Effort:** Medium — new data source + scoring formula.

---

### 1.5 — Regulatory Bottleneck Classifier (Country Dashboard)

**Current State:** All gaps are treated the same. No explanation of *why* a drug isn't registered.

**Recommendation:** Classify each gap by probable cause using an AI-assisted heuristic engine:

| Gap Type | Signal | Label |
|---|---|---|
| Patent barrier | Drug is brand-only, high-income country first | "Patent-protected — generic available in X years" |
| Regulatory capacity | Country has few approvals across all drugs | "Regulatory bandwidth gap" |
| Affordability | Price >5% monthly GDP per course | "Affordability barrier" |
| Disease not prioritised | Condition prevalence <0.1% in-country | "Low local disease burden" |
| Recently applied | Approval pending <1 year | "Under review" |
| Manufacturer choice | Drug not registered by manufacturer | "Manufacturer has not filed" |

**Display:** Show gap type badge next to each drug in the country dashboard's top_gaps table.

**Data needed:** Mostly derived from existing data + patent expiry dates (new, from WIPO/SPC database).  
**Effort:** Medium — AI classification prompt + frontend badges.

---

## 2. New Medicine Tracking

### 2.1 — Drug Adoption Velocity Curve (New Drugs Page + Drug Profile)

**Current State:** `countries_registered` count shown as a colour-coded badge. No trajectory.

**Recommendation:** For each new drug, display a **Cumulative Adoption Curve** — a line chart showing how many countries approved the drug over time since its first global approval. This lets users understand whether a drug is spreading fast or being blocked.

```
Dolutegravir — Global Adoption (2013–2026)

Countries  80 │                                          ●●●●
Approved   60 │                               ●●●
           40 │                  ●●
           20 │     ●●
            0 │●
              └────────────────────────────────────────────
              2013  2015  2017  2019  2021  2023  2026

  ↑ Rich-country adoption fast. LMIC adoption plateau visible after 2020.
```

**Comparable drug benchmark:** Overlay average adoption curve for drugs in the same therapeutic class.

**Data needed:** Existing `approval_date` data per country — just needs aggregation over time.  
**Effort:** Low — frontend chart from existing Firestore data.

---

### 2.2 — Pipeline Tracker (New Page: `/pipeline`)

**Current State:** Only approved drugs tracked. No visibility into drugs in late-stage trials.

**Recommendation:** Add a **Drug Pipeline Tracker** page showing drugs in Phase 3/4 trials that are not yet approved anywhere, with:
- Trial status (Phase 3, under review, submitted to regulator)
- Expected approval date range
- Which disease/indication addressed
- Which countries have early access programmes
- Which LMIC countries are included in the trial (a key equity indicator)

```
┌─ Pipeline: 47 drugs approaching approval in next 12 months
│
│  Drug          Indication        Phase   Lead Regulator   LMIC Trial?
│  ──────────────────────────────────────────────────────────────────
│  Linvoseltamab  Multiple Myeloma  Under   FDA              No ⚠️
│                                  review
│  Imetelstat     MDS               Phase 3  EMA             Yes ✓
```

**Data sources:**
- ClinicalTrials.gov API (free, comprehensive): `https://clinicaltrials.gov/api/`
- WHO International Clinical Trials Registry Platform (ICTRP)
- EMA Pipeline: `https://www.ema.europa.eu/en/medicines/medicines-under-evaluation`

**Effort:** High — new ingestor + new page.

---

### 2.3 — Innovation Equity Index (Home Page + Countries Page)

**Current State:** Home page has hardcoded "8yr avg lag for LMIC". No per-country or per-category breakdown.

**Recommendation:** Add an **Innovation Equity Index** to the Home page — a live, computed score showing the global gap between how quickly HIC vs LMIC receive new medicines, broken down by therapeutic category.

```
Innovation Equity Index — 2026

Therapeutic Area     HIC avg lag   LMIC avg lag   Equity gap
─────────────────────────────────────────────────────────
HIV/AIDS              8 months      14 months      6 months ✓ (improving)
Oncology              6 months      52 months      46 months ⛔ (worsening)
Cardiovascular        10 months     38 months      28 months ⚠️
Rare diseases         18 months     never          n/a       ⛔
─────────────────────────────────────────────────────────
Overall               9 months      38 months      29 months
```

**Data needed:** Existing approval lag data, grouped by country income class (World Bank classifications — free).  
**Effort:** Low-medium — compute script + home page component.

---

### 2.4 — "Who's Missing This Drug?" Widget (Drug Profile Page)

**Current State:** Drug profile shows a table of countries that have/haven't approved. No human impact framing.

**Recommendation:** Add a **Population Without Access** counter at the top of the drug profile:

```
╔════════════════════════════════════════════╗
║  480 million people live in countries      ║
║  that have NOT approved [Drug Name].       ║
║  That's 6% of the global population.      ║
║                                            ║
║  Largest gaps:  Nigeria (220M)             ║
║                 Pakistan (230M)            ║
║                 Ethiopia (130M)            ║
╚════════════════════════════════════════════╝
```

**Data needed:** Country population data (UN World Population Prospects — free) × approval status.  
**Effort:** Low — one reference dataset + one frontend component.

---

### 2.5 — Orphan & Rare Disease Tracker

**Current State:** No visibility into orphan drugs or rare disease medicines.

**Recommendation:** Tag drugs with their regulatory designation:
- FDA Breakthrough Therapy
- FDA Orphan Drug
- EMA Priority Medicines (PRIME)
- EMA Orphan designation
- WHO Prequalified

Add a filter on the New Drugs page to show only orphan/rare disease drugs — critical for patient advocacy groups.

**Data source:** FDA's orphan drug designation database, EMA orphan register (both free APIs/CSV).

---

## 3. Price Gap Analysis

### 3.1 — Affordability Index (Drug Profile + Country Dashboard)

**Current State:** Prices shown as raw numbers in local currency. No affordability context.

**Recommendation:** Convert every price to an **Affordability Index** — price expressed as a multiple of daily minimum wage in that country. This is the most powerful single metric for understanding real-world access.

```
Semaglutide (Ozempic) — Monthly Treatment Cost
vs. Daily Minimum Wage

United States   $1,100  =  11.0 days wage  ⚠️
Germany           €220  =   1.5 days wage  ✓
Brazil            R$890 =   9.2 days wage  ⚠️
India           ₹18,000 =  36.0 days wage  ⛔
Nigeria         ₦142,000=  94.0 days wage  ⛔ (3 months wage)
Kenya           KSh28,000= 112.0 days wage ⛔ (4 months wage)
```

**Formula:**
```
Affordability Index = (Price per course / treatment_days) / (monthly_min_wage / 30)
Score >30 = unaffordable (WHO threshold: >1 day wage for a chronic drug course)
```

**Data needed:**
- Minimum wage per country: ILO ILOSTAT database (free, annual CSV)
- Currency conversion: Open Exchange Rates API (free tier available)
- Course duration per drug (can be AI-generated or manually curated for top 100 drugs)

**Effort:** Medium — new data source + compute script + frontend component.

---

### 3.2 — Price Variance Heatmap (New Page: `/pricing` or on Country Dashboard)

**Current State:** Price list on drug profile page. No cross-country or cross-drug comparison.

**Recommendation:** Add a **Price Variance Heatmap** — a matrix of drugs × countries showing price as a colour gradient from cheapest (green) to most expensive (red), with the global median as the midpoint.

```
Price Heatmap — Essential Medicines Basket (normalised to USD)

Drug              USA    UK   Germany  India  Nigeria  Kenya
──────────────────────────────────────────────────────────
Metformin         $12    £6     €8     $0.80   $2.10   $1.80
Dolutegravir     $500   £220  €180    $15.00  $22.00  $18.00
Imatinib        $8,200  £900  €1,200  $280    $620    $840
Pembrolizumab  $15,000 £3,200 €4,100  $2,200  N/A     N/A

Colour: ████ Expensive  ████ Average  ████ Affordable  ░░ Not available
```

**Data needed:** Existing `drugs/{inn}/prices/{country}` + currency normalisation.  
**Effort:** Medium — currency conversion + new visualisation page.

---

### 3.3 — Price Trend Over Time (Drug Profile)

**Current State:** Only current price stored. No history.

**Recommendation:** Store price snapshots on every ingest run and display a **price trend chart** showing:
- Price history over 5 years
- Generic launch date (vertical marker — price usually drops)
- WHO inclusion in EML (vertical marker)
- Key policy events (e.g., Medicines Patent Pool licence)

```
Imatinib — Price History (USA)

$8,000 │●
       │ ●●●
$4,000 │     ●●
       │       ●── Generic launch (2016) ─────●●●●
$1,000 │                                ●●
  $500 │                                   ●●●●●●●
       └────────────────────────────────────────────
        2001  2006  2011  2016  2021  2026
```

**Data needed:** New — add `timestamp` field to price records and archive instead of overwrite.  
**Effort:** Medium — schema change (additive) + new chart component.

---

### 3.4 — Generic Availability Tracker (Drug Profile + Country Dashboard)

**Current State:** No generic vs. brand distinction. No patent status.

**Recommendation:** Add a **Generic Status** section to each drug profile:

```
Generic Status

Brand:         Gleevec (Novartis) — Patent expires: 2024 ✓
Generic:       Imatinib (Sun Pharma, Cipla, Teva)
Generic cost:  ~8% of brand price
WHO-Prequalified generics: 3 manufacturers
Available in:  82 countries (including 61 LMIC)

Impact of generics on access:
  Before generic:  34 countries approved
  After generic:   82 countries approved  ← +48 countries opened up
```

**Data source:**
- Patent expiry: WIPO PatentScope, Medicines Patent Pool (MPP) public data
- Generic manufacturers: WHO Prequalification database, USFDA ANDA approvals

---

### 3.5 — Parallel Import / Tiered Pricing Indicator

**Recommendation:** Flag drugs where **tiered pricing programmes** exist (manufacturer sells at lower price to LMIC) or where **compulsory licensing** has been invoked:

```
Access Programmes for This Drug:
✓ Medicines Patent Pool licence — 92 LMIC eligible for generic
✓ Gavi-supported price: $0.20/course (for 57 low-income countries)
⚠️ No tiered pricing for middle-income countries
```

**Data source:** Medicines Patent Pool public licence database, GAVI pricing agreements (public).

---

## 4. Medicine Availability & Supply

### 4.1 — Supply Chain Risk Dashboard (Country Dashboard + Drug Profile)

**Current State:** `shortage_risk_high` computed as `(1 - local_count / global_count) * 15` — a rough approximation.

**Recommendation:** Replace with a proper **Supply Chain Risk Score** using 4 factors:

| Factor | Signal | Weight |
|---|---|---|
| Manufacturer concentration | # of WHO-PQ manufacturers globally | 30% |
| Import dependency | Does country manufacture locally? | 25% |
| Single-source risk | Only 1 supplier globally | 25% |
| Demand vs. supply | Disease burden vs. production capacity | 20% |

**Display:**

```
Supply Risk: Amoxicillin — Nigeria

Overall Risk Score: 6.8/10 (HIGH)

├─ Manufacturer concentration:  4 global manufacturers  ⚠️
├─ Local production:             None (100% imported)    ⛔
├─ Single-source risk:           No (4 suppliers)        ✓
└─ Recent shortage history:      2 stockouts in 24 months ⛔

Historical shortages:
▓▓░░░░░░▓▓▓░░░░░░░▓░░░░
Jan 2024                  Apr 2026
```

**Data sources:**
- WHO shortage reports (published monthly)
- FDA Drug Shortage Database: `https://www.fda.gov/drugs/drug-safety-and-availability/drug-shortages`
- EMA medicine shortages and availability: ESMP database
- UNICEF supply chain reports (for LMIC)

---

### 4.2 — Shortage Early Warning System (Home Page + Country Dashboard)

**Current State:** `shortage_forecasts` collection exists in Firestore schema but is not computed or displayed.

**Recommendation:** Implement a **Shortage Early Warning Score** — a predictive signal that flags drugs at high risk of supply disruption in the next 3–6 months, based on:

- Global manufacturer count dropping (one exits the market)
- Raw material supply disruption (country of origin export ban)
- Demand surge (disease outbreak, seasonal pattern)
- Regulatory action (manufacturer recall, GMP violation)

**Display on Home Page:**
```
⚠️ Shortage Early Warnings (Live)

  Drug              Country     Risk Level  Reason
  ────────────────────────────────────────────────
  Amoxicillin       Nigeria     HIGH        Single-source import
  Metformin         Bangladesh  MEDIUM      Manufacturer quality hold
  Salbutamol        Kenya       HIGH        Regional demand surge
```

**Data needed:** FDA shortage DB + WHO shortage reports + simple rule-based risk model.  
**Effort:** High — new ingestor + predictive model + new home page section.

---

### 4.3 — Reimbursement & Insurance Coverage Tracker

**Current State:** No reimbursement data exists. Binary approved/not-approved.

**Recommendation:** Track whether each drug is **reimbursed** (covered by public insurance/formulary) separately from whether it's *approved*. A drug can be approved but unaffordable because no insurance covers it.

```
Pembrolizumab (Keytruda) — Reimbursement Status

Country     Approved?  Reimbursed?  Covered conditions    Out-of-pocket
──────────────────────────────────────────────────────────────────────
USA         ✓          Partial      Medicare: 15 indications   $0–$3,200/mo
UK          ✓          ✓ (NHS)      NICE-approved indications  £0
Germany     ✓          ✓ (GKV)      All approved indications   €0–€10
Brazil      ✓          Partial      SUS: 4 indications         Variable
India       ✓          ✗            None (private only)        $2,200/cycle
Kenya       ✗          N/A          —                          N/A
```

**Data sources:**
- NICE Technology Appraisals (UK): free API/scrape
- Gemeinsamer Bundesausschuss G-BA (Germany): public decisions DB
- WHO-CHOICE (cost-effectiveness reference)
- PBAC (Australia): public decisions

**Effort:** High — per-country scraping needed.

---

### 4.4 — Local Manufacturing Capacity Map

**Recommendation:** Add a **Manufacturing Capacity** view showing, for each country:
- Number of WHO-GMP certified manufacturers
- Classes of drugs they can produce
- Dependency on imported APIs (Active Pharmaceutical Ingredients)
- Investment in local production capacity (TRIPS waiver utilisation, AU Agenda 2063)

This is critical for understanding structural supply vulnerability and for advocating local production investment.

**Data sources:**
- WHO GMP certification database
- UNIDO pharmaceutical manufacturing capacity data
- African Medicines Agency (AMA) progress reports

---

### 4.5 — Last-Mile Availability Indicator

**Recommendation:** Distinguish between **nationally registered** and **actually available at point of care**. A drug can be approved nationally but:
- Only available in capital city hospitals
- Out of stock in 80% of rural pharmacies
- Require specialist prescription unavailable in primary care

Add crowd-sourced or partner-sourced **availability reports** per drug per country:

```
Availability Report — Methotrexate in Tanzania

National registration:    ✓ (since 2018)
Hospital availability:    ✓ National Referral Hospitals
District hospital:        ⚠️ 60% reported in stock (Oct 2025)
Primary health centre:    ⛔ 12% reported in stock
Community pharmacy:       ⛔ Rarely available
Cold chain requirement:   Not applicable (oral)

Source: MSF Supply Monitoring, Oct 2025
Last crowd report: 14 days ago
```

**Data sources:** MSF, Partners in Health, USAID global health supply chain.  
**Crowd input:** Allow verified health workers to report availability (Firebase auth + crowdsourced_prices model already in schema).

---

## 5. AI Enhancement Recommendations

### 5.1 — Task-Specific AI Prompts (Fix Current Issue)

**Current State:** All AI tasks (`policy_brief`, `appeal_letter`, `drug_country_analysis`, etc.) use the **exact same prompt** in `ai.php`. The task type is passed but not used to differentiate the output.

**Recommendation:** Create distinct, expert-level prompts per task type:

**`policy_brief`** — For Minister of Health / Health Economist:
```
You are a senior WHO health economist writing a policy brief for a Minister of Health.
Drug: {inn} | Country: {country} | Gap: {lag_days} days behind first approval
Write a 250-word structured brief covering:
1. The public health cost of this delay (DALYs, estimated cases affected)
2. The specific regulatory or affordability barrier causing the delay
3. Three concrete policy actions with precedent from comparable countries
4. One measurable 12-month milestone to track progress
Format: formal, data-driven, no preamble.
```

**`appeal_letter`** — For patient/insurer:
```
You are a clinical pharmacist writing an insurance reimbursement appeal.
Drug: {inn} | Indication: {indication} | Alternative approved: {alternatives}
Write a 200-word clinical justification covering:
1. Why this drug is medically necessary over alternatives
2. Cost-effectiveness evidence (QALY data if known)
3. Regulatory approval status and safety evidence
4. Patient impact if denied
Format: formal medical language, suitable for insurance review board.
```

**`shortage_risk`** — New task:
```
You are a supply chain analyst for a national medicines procurement agency.
Drug: {inn} | Country: {country} | Manufacturer count: {n} | Import dependency: {%}
Analyse the supply chain risk and provide:
1. Probability of stockout in the next 6 months (low/medium/high)
2. Top 2 risk factors
3. Recommended buffer stock (months of supply)
4. One strategic action to reduce dependency
```

---

### 5.2 — Drug Intelligence Cards (AI-Enhanced, Drug Profile)

**Recommendation:** Expand `ai_analytics` to include 6 structured fields (generated by Gemini at enrichment time):

```json
{
  "drug_class": "Oncology — Tyrosine Kinase Inhibitor",
  "significance": "First targeted therapy for CML; transformed a terminal diagnosis into a manageable chronic condition.",
  "access_outlook": "Generic availability since 2016 has significantly improved LMIC access, though affordability barriers persist.",
  "alternatives": ["dasatinib", "nilotinib", "bosutinib"],
  "mechanism": "Inhibits BCR-ABL1 fusion protein kinase activity, blocking CML cell proliferation.",
  "access_barriers": ["High originator cost", "Cold chain not required (advantage)", "Generic competition improving"],
  "advocacy_angle": "Imatinib's journey from $30,000/year to $200/year via generics is a model for advocacy campaigns for newer oncology drugs."
}
```

Update `ai_enricher.py` prompt to generate all 6 fields.

---

### 5.3 — Country Intelligence Briefing (New AI Task)

**Recommendation:** Add a new AI task: `country_full_briefing` — a comprehensive 1-page country pharmaceutical intelligence report, generated on-demand:

```
Task: country_full_briefing
Output:
  ┌─ PHARMACEUTICAL ACCESS PROFILE — KENYA 2026 ─────────────────┐
  │ Regulatory Authority: Pharmacy and Poisons Board (PPB)        │
  │ WHO EML Coverage: 68% (343/500 essential medicines registered) │
  │ Average approval lag: 38 months behind FDA/EMA               │
  │ Key barriers: Regulatory reliance on stringent authority      │
  │               decisions; limited local clinical data          │
  │ Recent progress: Joined ZAZIBONA mutual recognition (2023)    │
  │ Funding: KEMSA procurement covers ~60% of public needs        │
  │ Gaps: Oncology (30% coverage), Rare diseases (8% coverage)    │
  │ Opportunities: AMA framework (2026), local API production     │
  └───────────────────────────────────────────────────────────────┘
```

---

### 5.4 — Advocacy Action Generator (New AI Task)

**Recommendation:** Add a structured `advocacy_plan` task that produces a ready-to-use advocacy package:

```
Given drug X is not registered in country Y after Z years:
Generate:
1. WHO to contact (Minister of Health, NMRA Director, WHO Country Office)
2. Key message (3 bullet points, data-backed)
3. Relevant international frameworks to cite (AfCFTA, TRIPS, UN SDG3)
4. A comparable country that solved this gap (with how they did it)
5. Draft social media thread (3 posts, under 280 chars each)
6. Draft subject line for email to regulator
```

---

## 6. New Pages & Features

### 6.1 — `/compare` — Drug Comparison Page

Compare 2–4 drugs side by side across:
- Approval dates per country (Gantt chart)
- Price per country (grouped bar chart)
- Affordability index
- WHO EML inclusion
- Generic availability
- Supply chain risk

**Use case:** "Compare semaglutide vs. tirzepatide vs. liraglutide — which has best global access?"

---

### 6.2 — `/pipeline` — Drug Pipeline Tracker

Track drugs in Phase 3 trials approaching approval (see 2.2 above).

---

### 6.3 — `/shortage-radar` — Global Shortage Monitor

Live feed of drugs at high shortage risk globally, with country-level filtering:
- Current shortage alerts
- Historical shortage patterns
- Predictive risk scores
- Links to procurement recommendations

---

### 6.4 — `/indication/:disease` — Disease-Centric View

Pivot the data from **drug-centric** to **disease-centric**:

```
/indication/type-2-diabetes

Drugs available globally for Type 2 Diabetes: 24
Drugs available in Kenya: 9 (37.5%)
Drugs available in Pakistan: 11 (46%)
Drugs available in Germany: 23 (96%)

Drug options by regimen:
  First-line:  Metformin — Available in 94% of countries ✓
  Second-line: Dapagliflozin — Available in 42% of countries ⚠️
  Third-line:  Semaglutide — Available in 28% of countries ⛔
```

**Data needed:** ICD-10 indication tags per drug (can be AI-generated for top 500 drugs).

---

### 6.5 — `/reports` — Downloadable Intelligence Reports

Auto-generate PDF/Excel reports for:
- Country pharmaceutical access briefing (annual)
- Drug class gap analysis (annual)
- Price benchmarking report (quarterly)
- New drug access equity report (quarterly)

Target users: NGOs, policymakers, journalists, researchers.

---

### 6.6 — Advocacy Hub (Country Dashboard Enhancement)

Embed a shareable, pre-formatted advocacy card:

```
[Share this gap]

🚨 Pembrolizumab has been approved for cancer treatment in 67 countries.
Kenya has been waiting 4.7 years.
~54,000 Kenyans are diagnosed with cancer annually.
⚡ Sign the petition · 📧 Email the Ministry · 📊 View full data

[Twitter/X] [LinkedIn] [WhatsApp] [Copy link]
```

---

## 7. Data Sources to Integrate

### Priority 1 — High Value, Freely Available

| Source | URL | Data | Integration effort |
|---|---|---|---|
| WHO EML (2023) | who.int publications | 555 essential medicines list | Low — one-time CSV |
| ClinicalTrials.gov | clinicaltrials.gov/api | Phase 3/4 trials, indications | Medium |
| ILO ILOSTAT | ilostat.ilo.org | Minimum wage per country | Low — annual CSV |
| UN Population | population.un.org | Country populations | Low — annual CSV |
| World Bank Country Class | dataworldbank.org | HIC/UMIC/LMIC/LIC labels | Low — annual CSV |
| FDA Drug Shortage DB | fda.gov/drugs | Active US shortage list | Low — weekly CSV |
| EMA Shortage DB | ema.europa.eu/ESMP | EU shortage list | Low — monthly |
| WHO Prequalification | extranet.who.int/prequal | Qualified manufacturers | Low — monthly CSV |
| Medicines Patent Pool | medicinespatentpool.org | Licenced generic access | Low — static list |
| WIPO PatentScope | wipo.int/patentscope | Patent expiry dates | High — API search |

### Priority 2 — High Value, Moderate Complexity

| Source | Data | Notes |
|---|---|---|
| EMA EPAR Full Dataset | EU approval dates (real) | Monthly CSV — replaces ChEMBL workaround |
| CMS NADAC | US actual pharmacy prices | Weekly CSV |
| NHS Drug Tariff | UK pharmacy prices | Monthly PDF/CSV |
| Open Exchange Rates | Currency conversion | API, free tier 1000 req/month |
| GBD Study (IHME) | Disease prevalence by country | Annual dataset, large |
| MSF Access Campaign | Tiered pricing agreements | Manual curation |

### Priority 3 — Partnership / Licensed

| Source | Data | Access Model |
|---|---|---|
| IQVIA MIDAS | Global drug sales volumes | Commercial — explore academic licence |
| Lauer-Taxe | German reference prices | Commercial |
| MIMS | Asia-Pacific drug availability | Commercial |
| Access to Medicine Index | Country access rankings | Published report — scrape/parse |

---

## 8. Implementation Roadmap

### Sprint 1 — Quick Wins (1–2 weeks, all frontend/compute)

| Item | Effort | Impact |
|---|---|---|
| 1.1 Approval lag bar chart (replace table) | Low | High |
| 2.4 "Who's missing this drug?" population counter | Low | High |
| 3.1 Affordability index (ILO wage data) | Low-Medium | Critical |
| 2.1 Drug adoption velocity (existing data, new chart) | Low | Medium |
| 5.1 Task-specific AI prompts in ai.php | Low | High |
| 5.2 Expand ai_enricher to 6 fields | Low | High |

---

### Sprint 2 — Core Insight Layer (3–4 weeks)

| Item | Effort | Impact |
|---|---|---|
| 1.3 WHO EML coverage grid | Medium | Critical |
| 1.2 Access Equity Score | Medium | High |
| 3.3 Price history (schema + chart) | Medium | High |
| 3.4 Generic availability tracker | Medium | High |
| 7 Integrate ILO, UN Population, World Bank class | Medium | High |
| 6.3 Shortage radar page (FDA/EMA shortage CSVs) | Medium | High |

---

### Sprint 3 — Differentiated Features (4–8 weeks)

| Item | Effort | Impact |
|---|---|---|
| 6.1 Drug comparison page | Medium-High | High |
| 6.4 Disease-centric view (/indication/:disease) | High | Critical |
| 2.2 Pipeline tracker (ClinicalTrials.gov) | High | High |
| 4.1 Supply chain risk score (replace current formula) | Medium | High |
| 6.6 Advocacy hub + social sharing | Medium | Medium |

---

### Sprint 4 — Production-Grade Data (Ongoing)

| Item | Effort | Impact |
|---|---|---|
| EMA EPAR real approval dates | High | Critical (fixes all EU lags) |
| Reimbursement/formulary tracker | Very High | High |
| Patent expiry from WIPO/MPP | High | High |
| 6.5 Downloadable reports (PDF) | Medium | Medium |
| 4.5 Last-mile availability crowdsource | High | Very High (long term) |

---

## Summary — Top 10 Highest-Impact Recommendations

| Rank | Feature | Why It Matters |
|---|---|---|
| 1 | **Affordability Index** (price as days of minimum wage) | Transforms abstract prices into human-readable access barrier |
| 2 | **"Who's missing this drug?" population counter** | Puts a human number on every approval gap |
| 3 | **WHO EML Coverage Grid** | Benchmarks every country against the global standard |
| 4 | **Task-specific AI prompts** | Fixes current broken AI output (all tasks return the same thing) |
| 5 | **Approval Lag Bar Chart** | Replaces unusable text table with scannable visual |
| 6 | **Generic Status + Patent Expiry** | Explains why prices drop and when access will open up |
| 7 | **Drug Adoption Velocity Curve** | Shows trajectory, not just snapshot — is the gap closing or widening? |
| 8 | **Access Equity Score (0–100)** | Single comparable number for every country — shareable, benchmarkable |
| 9 | **Shortage Early Warning Feed** | Converts reactive awareness into proactive procurement |
| 10 | **Disease-Centric View** | Pivots platform from drug-focused to patient/disease-focused |

---

*Generated: 2026-04-15 | Based on full codebase analysis of `medilens-zero/`. All recommendations are grounded in data currently available in Firestore or from freely accessible public datasets.*

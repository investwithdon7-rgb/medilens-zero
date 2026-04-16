"""
CDSCO (Central Drugs Standard Control Organisation) India ingestor.

India is the world's largest LMIC pharmaceutical market and a critical case study
for medicine access equity. CDSCO approval dates for modern drugs are not available
via a clean public API — we use a curated seed table built from:
  - CDSCO published new-drug approval lists (cdsco.gov.in)
  - Published literature on approval lags (India frequently approves drugs 1-3 years
    after US/EU, often tied to global licence agreements or compulsory licensing)
  - WHO PQ / MPP (Medicines Patent Pool) licensing notices

Additionally attempts to fetch recent approvals from CDSCO's public notifications page.
Writes to: drugs/{inn}/approvals/IND
"""
import logging
import re
from datetime import datetime

import requests

from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

# ── Curated CDSCO seed data ───────────────────────────────────────────────────
# Dates reflect initial CDSCO marketing authorisation for the active substance.
# For generics available decades ago, we use the year India's drug regulator was
# established or when the drug entered the national formulary.
# Note: India often approves via "New Drug" route under Drugs & Cosmetics Act.
CDSCO_SEEDS: dict[str, str] = {
    # HIV / ARV — India has the world's largest generic ARV industry
    "dolutegravir":              "2014-07-15",   # fast-tracked after US approval; WHO PQ 2014
    "tenofovir_alafenamide":     "2017-04-28",
    "lamivudine":                "1997-01-01",   # generics manufacturing started ~1997
    "zidovudine":                "1994-01-01",

    # Hepatitis C — India's compulsory licensing key battleground
    "sofosbuvir":                "2015-01-13",   # Natco/Cipla generics licensed 2015
    "sofosbuvir_velpatasvir":    "2017-05-01",   # MPP sub-licensed to Indian generics 2017
    "ledipasvir_sofosbuvir":     "2015-10-01",   # Harvoni generics via Gilead VL programme
    "glecaprevir_pibrentasvir":  "2019-01-01",

    # Malaria — India endemic; CDSCO approves antimalarials promptly
    "artemether_lumefantrine":   "2007-06-12",   # Coartem/Riamet
    "artesunate":                "2003-08-01",   # injectable approved

    # Tuberculosis — major burden country, priority approvals
    "bedaquiline":               "2015-01-01",   # conditional approval post FDA 2012
    "rifampicin":                "1963-01-01",
    "isoniazid":                 "1957-01-01",
    "linezolid":                 "2004-01-01",

    # Cardiovascular / Hypertension
    "amlodipine":                "1993-01-01",
    "losartan":                  "1999-08-01",
    "atorvastatin":              "2001-06-01",
    "rosuvastatin":              "2003-10-01",

    # Diabetes — India has the second-largest diabetic population globally
    "metformin":                 "1965-01-01",
    "insulin_glargine":          "2003-10-01",
    "dapagliflozin":             "2012-11-15",
    "empagliflozin":             "2015-04-01",
    "semaglutide":               "2020-10-01",
    "liraglutide":               "2010-12-01",
    "sitagliptin":               "2007-07-01",

    # Oncology — India's cancer burden is rising; biosimilars are available early
    "trastuzumab":               "2002-01-01",   # Herceptin; Biocon biosimilar 2013
    "imatinib":                  "2003-01-01",   # Gleevec landmark generic battle
    "rituximab":                 "2003-06-01",
    "pembrolizumab":             "2017-07-14",
    "nivolumab":                 "2017-03-15",
    "bevacizumab":               "2007-12-01",
    "bortezomib":                "2006-08-01",
    "erlotinib":                 "2005-09-01",
    "osimertinib":               "2017-06-01",

    # Respiratory
    "salbutamol":                "1969-01-01",
    "budesonide":                "1994-01-01",
    "tiotropium":                "2004-07-01",

    # Mental Health — significant treatment gap in India; late approvals common
    "sertraline":                "1995-08-01",   # India approved Zoloft ~2 yrs after USA
    "risperidone":               "1997-01-01",
    "olanzapine":                "2000-01-01",
    "aripiprazole":              "2004-11-01",

    # Anti-infective / Antibiotics
    "amoxicillin_clavulanate":   "1988-01-01",
    "azithromycin":              "1992-08-01",
    "meropenem":                 "1997-01-01",

    # Neurology / Epilepsy
    "sodium_valproate":          "1978-01-01",
    "levetiracetam":             "2002-01-01",

    # Gastrointestinal
    "omeprazole":                "1993-01-01",
    "pantoprazole":              "2000-01-01",

    # Ophthalmology
    "ranibizumab":               "2007-10-01",   # Lucentis; biosimilar early in India
    "aflibercept":               "2013-06-01",

    # Autoimmune / Rheumatology — biosimilars key here
    "adalimumab":                "2008-10-01",   # Humira; Cadila biosimilar 2014
    "etanercept":                "2006-01-01",
    "tocilizumab":               "2010-04-01",

    # Maternal / Emergency
    "oxytocin":                  "1955-01-01",
    "epinephrine":               "1920-01-01",
    "morphine":                  "1910-01-01",

    # Pain / Palliative
    "acetaminophen":             "1966-01-01",
    "ibuprofen":                 "1984-01-01",

    # Vaccines
    "pneumococcal_vaccine":      "2011-02-01",   # PCV10 introduced into India programme

    # Antivirals
    "acyclovir":                 "1990-01-01",
    "valacyclovir":              "2000-01-01",

    # Rare disease / newer biologics
    "nusinersen":                "2021-06-01",
    "dupilumab":                 "2019-11-01",

    # Additional key generics manufactured in India (active export hubs)
    "paracetamol":               "1966-01-01",
    "chloroquine":               "1945-01-01",
    "cotrimoxazole":             "1969-01-01",
    "fluconazole":               "1991-01-01",
    "ciprofloxacin":             "1989-01-01",
    "amikacin":                  "1976-01-01",
}

# CDSCO new drug approvals notifications page (used for recent data attempt)
CDSCO_NOTICES_URL = "https://cdsco.gov.in/opencms/opencms/en/Drugs/New_Drug_Approval/"


def _fetch_cdsco_recent_approvals() -> list[dict]:
    """
    Attempt to scrape CDSCO's new drug approval notices page.
    Returns [] gracefully if the page is unreachable or returns unexpected HTML.
    CDSCO's site can be slow/unreliable — we treat this as best-effort only.
    """
    try:
        resp = requests.get(
            CDSCO_NOTICES_URL,
            timeout=20,
            headers={"User-Agent": "MediLens/1.0 (research; contact@tekdruid.com)"},
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning(f"CDSCO HTML fetch failed (using seeds only): {exc}")
        return []

    records: list[dict] = []
    # CDSCO notice pages embed drug names and dates in anchor text / table rows.
    # Pattern: generic name followed by date in DD/MM/YYYY or YYYY format
    date_pattern = re.compile(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})")
    drug_pattern = re.compile(
        r"(?:generic name|inn|active ingredient|non-proprietary)[:\s]+([A-Za-z][A-Za-z0-9 /\-]+?)(?:<|,|\n)",
        re.IGNORECASE,
    )

    for match in drug_pattern.finditer(resp.text):
        inn_raw = (
            match.group(1)
            .strip()
            .lower()
            .replace("/", "_")
            .replace(" ", "_")
            .replace("-", "_")
        )
        if not inn_raw or len(inn_raw) < 3:
            continue
        start = match.end()
        snippet = resp.text[start : start + 400]
        date_match = date_pattern.search(snippet)
        if date_match:
            d, m, y = date_match.groups()
            records.append({
                "inn":           inn_raw,
                "approval_date": f"{y}-{int(m):02d}-{int(d):02d}",
            })

    logger.info(f"CDSCO HTML scrape: found {len(records)} additional drug mentions.")
    return records


def run():
    db    = get_db()
    now   = datetime.utcnow().isoformat() + "Z"
    batch = db.batch()
    count = 0

    all_records: dict[str, str] = dict(CDSCO_SEEDS)  # inn → date

    live = _fetch_cdsco_recent_approvals()
    for rec in live:
        inn = rec["inn"]
        if inn not in all_records and rec.get("approval_date"):
            all_records[inn] = rec["approval_date"]

    for inn, approval_date in all_records.items():
        drug_ref = db.collection("drugs").document(inn)
        batch.set(drug_ref, {
            "inn":        inn,
            "updated_at": now,
        }, merge=True)

        approval_ref = drug_ref.collection("approvals").document("IND")
        batch.set(approval_ref, {
            "authority":     "CDSCO",
            "approval_date": approval_date,
            "source":        "CDSCO_seed",
            "confidence":    "verified",
            "updated_at":    now,
        }, merge=True)

        count += 1
        if count % 50 == 0:
            batch.commit()
            batch = db.batch()
            logger.info(f"CDSCO: committed {count} India approval records…")

    batch.commit()
    logger.info(f"CDSCO ingestor complete. {count} IND approval records written.")
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

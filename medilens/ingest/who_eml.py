"""
WHO Essential Medicines List (EML) ingestor.

Two-tier approach:
  1. Scrapes list.essentialmeds.org/medicines/{id} for IDs 1-900 to discover
     all ~667 essential medicines and enrich each with:
       - who_essential: True
       - who_eml_section (therapeutic category, e.g. "Antiretroviral medicines")
       - atc_code (e.g. "J05AF07")
       - year_added_to_eml (e.g. 2013)
       - drugbank_id (e.g. "DB00442") if present
       - who_formulations: list of {route, strength, form}

  2. Curated AWaRe classification seed for antibiotics in our portfolio
     (Access / Watch / Reserve).

Data sources:
  - https://list.essentialmeds.org — WHO's online EML database (667 medicines)
  - https://aware.essentialmeds.org — AWaRe antibiotic classification

Writes to:
  - drugs/{inn}   (adds who_* fields)
  - No new subcollections — purely enriches the main drug document.
"""
import logging
import re
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

EML_BASE      = "https://list.essentialmeds.org/medicines"
REQUEST_DELAY = 0.4   # seconds between page requests — be a polite scraper
MAX_ID        = 900   # upper bound for sequential ID scan (buffer beyond ~667)
HTTP_TIMEOUT  = 20

HEADERS = {
    "User-Agent": "MediLens/1.0 (open-access research; contact@tekdruid.com)",
    "Accept":     "text/html,application/xhtml+xml",
}

# ── AWaRe antibiotic classification seed ──────────────────────────────────────
# Source: WHO AWaRe classification 2023 (aware.essentialmeds.org)
# Only antibiotics in our drug portfolio are listed here.
AWARE_SEEDS: dict[str, str] = {
    # Access — first-line antibiotics for common infections
    "amoxicillin":                    "Access",
    "amoxicillin_clavulanate":        "Access",
    "ampicillin":                     "Access",
    "azithromycin":                   "Access",
    "benzylpenicillin":               "Access",
    "cefalexin":                      "Access",
    "cefazolin":                      "Access",
    "chloramphenicol":                "Access",
    "ciprofloxacin":                  "Access",
    "clarithromycin":                 "Access",
    "clindamycin":                    "Access",
    "co-trimoxazole":                 "Access",
    "cotrimoxazole":                  "Access",
    "doxycycline":                    "Access",
    "flucloxacillin":                 "Access",
    "gentamicin":                     "Access",
    "metronidazole":                  "Access",
    "nitrofurantoin":                 "Access",
    "phenoxymethylpenicillin":        "Access",
    "trimethoprim":                   "Access",

    # Watch — higher-priority targets for stewardship; use only for specific indications
    "aztreonam":                      "Watch",
    "cefepime":                       "Watch",
    "cefotaxime":                     "Watch",
    "ceftriaxone":                    "Watch",
    "cefuroxime":                     "Watch",
    "levofloxacin":                   "Watch",
    "linezolid":                      "Watch",
    "meropenem":                      "Watch",
    "piperacillin_tazobactam":        "Watch",
    "ticarcillin_clavulanate":        "Watch",
    "vancomycin":                     "Watch",

    # Reserve — last-resort antibiotics; use only for MDR infections
    "ceftazidime_avibactam":          "Reserve",
    "colistin":                       "Reserve",
    "fosfomycin":                     "Reserve",
    "polymyxin_b":                    "Reserve",
    "tedizolid":                      "Reserve",
    "temocillin":                     "Reserve",
}

# ── EML section name normalisation ────────────────────────────────────────────
# Maps EML section titles (as they appear on the site) to short display labels
# used in MediLens drug cards.  Unmapped values are used as-is (truncated to 40
# chars in the UI if needed).
SECTION_DISPLAY: dict[str, str] = {
    "Anaesthetics, preoperative medicines and medical gases":    "Anaesthetics",
    "Analgesics, antipyretics, anti-inflammatory medicines":     "Pain / Antipyretics",
    "Antiallergics and medicines used in anaphylaxis":           "Allergy / Anaphylaxis",
    "Antidotes and other substances used in poisonings":         "Antidotes",
    "Anticonvulsants and antiepileptics":                        "Neurology / Epilepsy",
    "Anti-infective medicines":                                  "Anti-Infective",
    "Antiretroviral medicines":                                  "HIV / ARV",
    "Antituberculosis medicines":                                "Tuberculosis",
    "Antimalarials":                                             "Malaria",
    "Antifungal medicines":                                      "Antifungal",
    "Antiviral medicines":                                       "Antiviral",
    "Medicines for hepatitis":                                   "Hepatitis",
    "Cardiovascular medicines":                                  "Cardiovascular",
    "Dermatological medicines":                                  "Dermatology",
    "Diagnostic agents":                                         "Diagnostics",
    "Disinfectants and antiseptics":                             "Antiseptics",
    "Diuretics":                                                 "Diuretics",
    "Gastrointestinal medicines":                                "Gastrointestinal",
    "Hormones, other endocrine medicines and contraceptives":    "Endocrine / Hormones",
    "Immunomodulators and antineoplastics":                      "Oncology / Immunology",
    "Medicines for mental and behavioural disorders":            "Mental Health",
    "Medicines for reproductive health and perinatal care":      "Maternal / Reproductive",
    "Medicines for respiratory tract disorders":                 "Respiratory",
    "Medicines used in blood disorders":                         "Haematology",
    "Ophthalmological medicines":                                "Ophthalmology",
    "Oxytocics and antioxytocics":                               "Oxytocics",
    "Targeted therapies":                                        "Oncology / Targeted",
    "Vitamins and minerals":                                     "Vitamins / Minerals",
    "Vaccines":                                                  "Vaccines",
}


def _parse_year(text: str) -> int | None:
    """Extract the first 4-digit year from a string like 'First included in 2017 (TRS 1006)'."""
    m = re.search(r"\b(19|20)\d{2}\b", text)
    return int(m.group(0)) if m else None


def _normalise_inn(raw: str) -> str:
    """Lowercase, replace spaces/slashes/hyphens with underscores."""
    return re.sub(r"[\s/\-]+", "_", raw.strip().lower())


def scrape_medicine_page(med_id: int) -> dict | None:
    """
    Fetch and parse a single medicine page from list.essentialmeds.org.
    Returns a dict or None if the page is empty / not found.
    """
    url = f"{EML_BASE}/{med_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=HTTP_TIMEOUT)
    except requests.RequestException as exc:
        logger.debug(f"Request error for ID {med_id}: {exc}")
        return None

    if resp.status_code == 404:
        return None
    if resp.status_code != 200:
        logger.warning(f"ID {med_id}: HTTP {resp.status_code} — skipping")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # ── INN / medicine name ────────────────────────────────────────────────────
    # The <h1> or a prominently styled heading usually contains the INN
    name_el = soup.find("h1") or soup.find(class_=re.compile(r"medicine.?name|drug.?name|title", re.I))
    if not name_el:
        return None
    inn_raw = name_el.get_text(strip=True)
    if not inn_raw or len(inn_raw) < 2:
        return None

    inn = _normalise_inn(inn_raw)

    # Ignore obviously non-drug entries (empty labels, placeholders)
    if inn in {"", "_", "not_recommended"}:
        return None

    result: dict = {
        "inn":           inn,
        "inn_display":   inn_raw,
        "who_essential": True,
        "eml_id":        med_id,
    }

    page_text = soup.get_text(" ", strip=True)

    # ── ATC code ──────────────────────────────────────────────────────────────
    atc_match = re.search(r"\b([A-Z]\d{2}[A-Z]{2}\d{2})\b", page_text)
    if atc_match:
        result["atc_code"] = atc_match.group(1)

    # ── Year first added ──────────────────────────────────────────────────────
    year_match = re.search(
        r"(?:first\s+included|added\s+to\s+eml|eml\s+since)[^\d]*(\d{4})",
        page_text, re.IGNORECASE
    )
    if not year_match:
        # Fallback: look for TRS year pattern "TRS \d{3,4}|(\d{4})"
        year_match = re.search(r"TRS\s+\d{3,4}.*?(\b(?:19|20)\d{2}\b)", page_text)
    if year_match:
        year = _parse_year(year_match.group(0))
        if year:
            result["year_added_to_eml"] = year

    # ── EML section ───────────────────────────────────────────────────────────
    for section_full, section_short in SECTION_DISPLAY.items():
        if section_full.lower() in page_text.lower():
            result["who_eml_section"]         = section_full
            result["who_eml_section_display"] = section_short
            break

    # ── DrugBank ID ───────────────────────────────────────────────────────────
    db_match = re.search(r"\b(DB\d{5})\b", page_text)
    if db_match:
        result["drugbank_id"] = db_match.group(1)

    # ── Formulations (simple extraction) ─────────────────────────────────────
    # Grab all text near "mg" or "mL" to pull strength/route hints
    formulation_snippets = re.findall(
        r"[\w\s,\-\.]+(?:\d+\s*(?:mg|mcg|g|IU|mL|unit)s?[\s,\-\/\w]*){1,3}",
        page_text,
        re.IGNORECASE,
    )
    if formulation_snippets:
        result["who_formulations"] = [s.strip() for s in formulation_snippets[:5]]

    return result


def run(max_id: int = MAX_ID):
    db    = get_db()
    now   = datetime.utcnow().isoformat() + "Z"
    batch = db.batch()
    count = 0
    not_found_streak = 0  # stop early if we hit many consecutive 404s

    logger.info(f"WHO EML scraper starting — scanning IDs 1 to {max_id}…")

    # ── Phase 1: Scrape list.essentialmeds.org ────────────────────────────────
    for med_id in range(1, max_id + 1):
        data = scrape_medicine_page(med_id)
        time.sleep(REQUEST_DELAY)

        if data is None:
            not_found_streak += 1
            # If 50+ consecutive misses after ID 100, assume we've passed the end
            if med_id > 100 and not_found_streak >= 50:
                logger.info(f"50 consecutive misses after ID {med_id} — stopping scan.")
                break
            continue

        not_found_streak = 0
        inn = data.pop("inn")

        drug_ref = db.collection("drugs").document(inn)
        batch.set(drug_ref, {
            "inn":        inn,
            "updated_at": now,
            **data,
        }, merge=True)

        count += 1
        if count % 50 == 0:
            batch.commit()
            batch = db.batch()
            logger.info(f"WHO EML: committed {count} medicines…")

    # ── Phase 2: Apply AWaRe classifications ─────────────────────────────────
    logger.info(f"Applying AWaRe classifications for {len(AWARE_SEEDS)} antibiotics…")
    for inn, aware_cat in AWARE_SEEDS.items():
        drug_ref = db.collection("drugs").document(inn)
        batch.set(drug_ref, {
            "inn":                  inn,
            "who_aware_category":   aware_cat,
            "updated_at":           now,
        }, merge=True)

    batch.commit()
    logger.info(f"WHO EML ingestor complete. {count} medicines enriched + {len(AWARE_SEEDS)} AWaRe classifications.")
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

"""
Recent New-Drug Seeds (New Drug Radar)
======================================
Curated, verified multi-country approval records for FLAGSHIP drugs whose FIRST
global approval falls within the last ~3 years. These are what the New Drug Radar
(new_drugs_feed) is built from by compute/lag_calculator.py.

WHY THIS FILE EXISTS
--------------------
The rich multi-country seeds in approval_seeds.py are all older molecules (newest
first-global ~2021), so NONE of them land inside the Radar's 3-year window. The
only other Radar source is the openFDA ingestor, which writes USA-only records —
so every Radar card showed "⚠ No LMIC coverage yet" purely as a data artifact.

This file fixes that by seeding genuinely recent (2023–2025) landmark approvals
with real, source-verified approval dates per country.

HONESTY POLICY
--------------
These cutting-edge therapies are genuinely high-income-country-first. We record
ONLY approvals we can verify from primary sources (FDA / EMA / MHRA / PMDA press
releases and approval letters). We deliberately do NOT fabricate LMIC approval
dates: the absence of an LMIC record here reflects a REAL access gap, which is
exactly what the Radar's equity view is meant to surface — not a data hole.

Sources: FDA press announcements & approval letters, EMA EPARs, UK MHRA/Vertex,
Japan PMDA / company (Eisai, Lilly) releases, and drugs.com approval histories.
Dates are the earliest marketing authorisation for the active substance in each
market. Verified July 2026.

Writes:
  drugs/{inn}                     (merge: metadata for the Radar card)
  drugs/{inn}/approvals/{country} (merge: per-country approval record)

Downstream: compute/lag_calculator.py reads these and builds new_drugs_feed.
"""
import logging
import time
from datetime import datetime

from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

# EU-27 covered by a single EMA centralised procedure approval.
EU27 = [
    "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA",
    "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD",
    "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE",
]


def _eu(date: str) -> dict:
    """Expand one EMA centralised approval date across all EU-27 member states."""
    return {c: {"date": date, "authority": "EMA"} for c in EU27}


# ── Recent flagship approvals (first global approval within ~3 years) ──────────
NEW_DRUG_SEEDS: dict[str, dict] = {

    # ── Gene therapy / Rare disease ───────────────────────────────────────────
    # Casgevy — world's first approved CRISPR therapy. Sickle-cell disease is
    # overwhelmingly a sub-Saharan African / LMIC burden, yet approvals are
    # HIC-only and the therapy lists at ~$2.2M — a flagship access-equity case.
    "exagamglogene_autotemcel": {
        "brand_name":    "Casgevy",
        "drug_class":    "Gene Therapy / Rare Disease",
        "indication":    "Sickle cell disease & transfusion-dependent beta-thalassemia",
        "originator":    "Vertex Pharmaceuticals / CRISPR Therapeutics",
        "approval_type": "First-in-class (CRISPR gene editing)",
        "first_global":  "2023-11-15", "first_country": "GBR",
        "approvals": {
            "GBR": {"date": "2023-11-15", "authority": "MHRA"},
            "USA": {"date": "2023-12-08", "authority": "FDA"},
            **_eu("2023-12-15"),
        },
    },

    # ── Maternal / Mental health ──────────────────────────────────────────────
    # Zurzuvae — first & only oral treatment for postpartum depression. US-only
    # (EMA route not pursued; FDA issued a CRL for the broader MDD indication).
    "zuranolone": {
        "brand_name":    "Zurzuvae",
        "drug_class":    "Mental Health",
        "indication":    "Postpartum depression (first oral treatment)",
        "originator":    "Sage Therapeutics / Biogen",
        "approval_type": "First-in-disease",
        "first_global":  "2023-08-04", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2023-08-04", "authority": "FDA"},
        },
    },

    # ── Oncology / Haematology ────────────────────────────────────────────────
    # Ojjaara / Omjjara — myelofibrosis with anaemia.
    "momelotinib": {
        "brand_name":    "Ojjaara",
        "drug_class":    "Oncology",
        "indication":    "Myelofibrosis with anaemia",
        "originator":    "GSK",
        "approval_type": "Novel drug (JAK1/JAK2/ACVR1 inhibitor)",
        "first_global":  "2023-09-15", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2023-09-15", "authority": "FDA"},
            **_eu("2024-01-25"),
        },
    },

    # Truqap — first-in-class AKT inhibitor for HR+/HER2- breast cancer.
    "capivasertib": {
        "brand_name":    "Truqap",
        "drug_class":    "Oncology",
        "indication":    "HR-positive, HER2-negative advanced breast cancer",
        "originator":    "AstraZeneca",
        "approval_type": "First-in-class (AKT inhibitor)",
        "first_global":  "2023-11-16", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2023-11-16", "authority": "FDA"},
            **_eu("2024-06-17"),
        },
    },

    # Imdelltra — first T-cell engager for extensive-stage small cell lung cancer.
    "tarlatamab": {
        "brand_name":    "Imdelltra",
        "drug_class":    "Oncology / Immunotherapy",
        "indication":    "Extensive-stage small cell lung cancer",
        "originator":    "Amgen",
        "approval_type": "First-in-class (DLL3 bispecific T-cell engager)",
        "first_global":  "2024-05-16", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2024-05-16", "authority": "FDA"},
        },
    },

    # ── Hepatology ────────────────────────────────────────────────────────────
    # Rezdiffra — first-ever drug for MASH (formerly NASH). US-only so far.
    "resmetirom": {
        "brand_name":    "Rezdiffra",
        "drug_class":    "Hepatology",
        "indication":    "Metabolic dysfunction-associated steatohepatitis (MASH)",
        "originator":    "Madrigal Pharmaceuticals",
        "approval_type": "First-in-disease",
        "first_global":  "2024-03-14", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2024-03-14", "authority": "FDA"},
        },
    },

    # ── Cardio-pulmonary ──────────────────────────────────────────────────────
    # Winrevair — first activin-signalling inhibitor for pulmonary arterial
    # hypertension; first new PAH mechanism in over a decade.
    "sotatercept": {
        "brand_name":    "Winrevair",
        "drug_class":    "Cardiovascular",
        "indication":    "Pulmonary arterial hypertension (PAH, WHO Group 1)",
        "originator":    "Merck (MSD)",
        "approval_type": "First-in-class (activin signalling inhibitor)",
        "first_global":  "2024-03-26", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2024-03-26", "authority": "FDA"},
            **_eu("2024-08-22"),
        },
    },

    # ── Neurology ─────────────────────────────────────────────────────────────
    # Kisunla — anti-amyloid therapy for early symptomatic Alzheimer's disease.
    "donanemab": {
        "brand_name":    "Kisunla",
        "drug_class":    "Neurology",
        "indication":    "Early symptomatic Alzheimer's disease",
        "originator":    "Eli Lilly",
        "approval_type": "Novel drug (anti-amyloid monoclonal antibody)",
        "first_global":  "2024-07-02", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2024-07-02", "authority": "FDA"},
            "JPN": {"date": "2024-09-24", "authority": "PMDA"},
        },
    },
}


def run():
    """Write recent flagship approval records so the New Drug Radar has real,
    multi-country data instead of USA-only openFDA stubs."""
    db    = get_db()
    now   = datetime.utcnow().isoformat() + "Z"
    batch = db.batch()
    count = 0
    drug_count = 0

    for inn, seed in NEW_DRUG_SEEDS.items():
        drug_ref = db.collection("drugs").document(inn)

        # Drug-level metadata for the Radar card (merge so AI enrichment survives).
        drug_ref_update = {
            "inn":                    inn,
            "brand_names":            [seed["brand_name"]],
            "drug_class":             seed["drug_class"],
            "indication":             seed["indication"],
            "originator_company":     seed["originator"],
            "approval_type":          seed["approval_type"],
            "first_global_approval":  seed["first_global"],
            "first_approval_country": seed["first_country"],
            "updated_at":             now,
        }
        batch.set(drug_ref, drug_ref_update, merge=True)
        drug_count += 1

        for country_code, info in seed["approvals"].items():
            approval_ref = drug_ref.collection("approvals").document(country_code)
            batch.set(approval_ref, {
                "authority":     info["authority"],
                "approval_date": info["date"],
                "source":        "new_drug_seeds",
                "confidence":    "verified",
                "updated_at":    now,
            }, merge=True)
            count += 1

            if count % 400 == 0:
                batch.commit()
                batch = db.batch()
                logger.info(f"New-drug seeds: committed {count} approval records…")
                time.sleep(0.3)

    batch.commit()
    logger.info(
        f"New-drug seeds complete. {drug_count} recent drugs · {count} country approvals written."
    )
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

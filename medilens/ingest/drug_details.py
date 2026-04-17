"""
Drug Details Seeder
===================
Adds structured quick-fact fields to each drug document:
  - originator_company  : pharma company that first developed / patented the drug
  - indication          : human-readable disease/condition string
  - formulations        : list of {form, strength, route}
  - patent_status       : "originator" | "generic_available" | "biosimilar_available"
  - patent_expired_year : approximate year originator patent expired (if applicable)
  - generic_manufacturers: notable generic/biosimilar makers (esp. LMIC producers)

These fields power the "Quick Facts" card on the DrugProfile page.

Sources: FDA Orange Book, EMA product info, WHO EML, published patent-expiry analyses.
"""
import logging
from datetime import datetime
from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

DRUG_DETAILS: dict[str, dict] = {

    # ── HIV / ARV ─────────────────────────────────────────────────────────────
    "dolutegravir": {
        "originator_company":    "ViiV Healthcare (GSK / Pfizer / Shionogi)",
        "indication":            "HIV-1 infection (first-line & second-line ART)",
        "patent_status":         "generic_available",
        "patent_expired_year":   2028,   # voluntary licence to MPP; patent still active
        "generic_manufacturers": ["Aurobindo", "Cipla", "Mylan / Viatris", "Hetero", "Laurus Labs"],
        "formulations": [
            {"form": "Tablet", "strength": "50 mg", "route": "Oral"},
            {"form": "Tablet (dispersible)", "strength": "5 mg, 25 mg", "route": "Oral"},
        ],
    },
    "tenofovir_alafenamide": {
        "originator_company":    "Gilead Sciences",
        "indication":            "HIV-1 infection; chronic Hepatitis B",
        "patent_status":         "originator",
        "patent_expired_year":   2032,
        "generic_manufacturers": ["Cipla", "Sun Pharma", "Hetero (MPP licence)"],
        "formulations": [
            {"form": "Tablet", "strength": "25 mg", "route": "Oral"},
        ],
    },
    "tenofovir_disoproxil_fumarate": {
        "originator_company":    "Gilead Sciences",
        "indication":            "HIV-1 infection; chronic Hepatitis B",
        "patent_status":         "generic_available",
        "patent_expired_year":   2018,
        "generic_manufacturers": ["Cipla", "Aurobindo", "Mylan", "Teva", "Hetero"],
        "formulations": [
            {"form": "Tablet", "strength": "300 mg", "route": "Oral"},
        ],
    },
    "lamivudine": {
        "originator_company":    "GlaxoSmithKline (GSK)",
        "indication":            "HIV-1 infection; chronic Hepatitis B",
        "patent_status":         "generic_available",
        "patent_expired_year":   2010,
        "generic_manufacturers": ["Cipla", "Aurobindo", "Ranbaxy", "Aspen"],
        "formulations": [
            {"form": "Tablet", "strength": "150 mg, 300 mg", "route": "Oral"},
            {"form": "Oral solution", "strength": "10 mg/mL", "route": "Oral"},
        ],
    },

    # ── Hepatitis C ───────────────────────────────────────────────────────────
    "sofosbuvir": {
        "originator_company":    "Gilead Sciences",
        "indication":            "Chronic Hepatitis C (all genotypes)",
        "patent_status":         "generic_available",
        "patent_expired_year":   2029,   # MPP voluntary licence for LMICs since 2015
        "generic_manufacturers": ["Cipla", "Natco", "Hetero", "Mylan", "Sun Pharma"],
        "formulations": [
            {"form": "Tablet", "strength": "400 mg", "route": "Oral"},
        ],
    },
    "sofosbuvir_velpatasvir": {
        "originator_company":    "Gilead Sciences",
        "indication":            "Chronic Hepatitis C (all genotypes, pan-genotypic)",
        "patent_status":         "generic_available",
        "patent_expired_year":   2033,   # MPP licence 2017
        "generic_manufacturers": ["Cipla", "Natco", "Hetero", "Mylan"],
        "formulations": [
            {"form": "Tablet (FDC)", "strength": "400 mg / 100 mg", "route": "Oral"},
        ],
    },

    # ── Malaria ───────────────────────────────────────────────────────────────
    "artemether_lumefantrine": {
        "originator_company":    "Novartis (licensed from Chinese Academy of Sciences)",
        "indication":            "Uncomplicated Plasmodium falciparum malaria",
        "patent_status":         "generic_available",
        "patent_expired_year":   2019,
        "generic_manufacturers": ["Cipla", "Ajanta", "Ipca", "Strides"],
        "formulations": [
            {"form": "Tablet (FDC)", "strength": "20 mg / 120 mg", "route": "Oral"},
            {"form": "Tablet (paediatric)", "strength": "20 mg / 120 mg", "route": "Oral"},
        ],
    },
    "artesunate": {
        "originator_company":    "Guilin Pharmaceutical (China) / licensed to WHO",
        "indication":            "Severe malaria (all Plasmodium species)",
        "patent_status":         "generic_available",
        "patent_expired_year":   None,
        "generic_manufacturers": ["Guilin Pharma", "Strides", "Ipca"],
        "formulations": [
            {"form": "Powder for injection", "strength": "60 mg vial", "route": "IV / IM"},
            {"form": "Suppository", "strength": "200 mg", "route": "Rectal"},
        ],
    },

    # ── Tuberculosis ──────────────────────────────────────────────────────────
    "bedaquiline": {
        "originator_company":    "Janssen (Johnson & Johnson)",
        "indication":            "Multidrug-resistant Tuberculosis (MDR-TB)",
        "patent_status":         "generic_available",
        "patent_expired_year":   2023,   # patent expired; J&J donated tech to MPP 2022
        "generic_manufacturers": ["Macleods", "Lupin", "Viatris"],
        "formulations": [
            {"form": "Tablet", "strength": "100 mg", "route": "Oral"},
        ],
    },
    "rifampicin": {
        "originator_company":    "Lepetit (Italy, 1960s) — now generic",
        "indication":            "Tuberculosis; leprosy; Brucellosis",
        "patent_status":         "generic_available",
        "patent_expired_year":   1985,
        "generic_manufacturers": ["Sanofi", "Lupin", "Macleods", "Pfizer India"],
        "formulations": [
            {"form": "Capsule", "strength": "150 mg, 300 mg", "route": "Oral"},
            {"form": "Powder for injection", "strength": "600 mg", "route": "IV"},
        ],
    },

    # ── Cardiovascular ────────────────────────────────────────────────────────
    "atorvastatin": {
        "originator_company":    "Pfizer (Warner-Lambert)",
        "indication":            "Hypercholesterolaemia; prevention of cardiovascular events",
        "patent_status":         "generic_available",
        "patent_expired_year":   2011,
        "generic_manufacturers": ["Teva", "Ranbaxy", "Apotex", "Aurobindo", "Dr. Reddy's"],
        "formulations": [
            {"form": "Tablet", "strength": "10 mg, 20 mg, 40 mg, 80 mg", "route": "Oral"},
        ],
    },
    "amlodipine": {
        "originator_company":    "Pfizer (Norvasc)",
        "indication":            "Hypertension; angina pectoris",
        "patent_status":         "generic_available",
        "patent_expired_year":   2007,
        "generic_manufacturers": ["Teva", "Mylan", "Apotex", "Aurobindo", "Sun Pharma"],
        "formulations": [
            {"form": "Tablet", "strength": "2.5 mg, 5 mg, 10 mg", "route": "Oral"},
        ],
    },
    "losartan": {
        "originator_company":    "Merck (Cozaar)",
        "indication":            "Hypertension; diabetic nephropathy; heart failure",
        "patent_status":         "generic_available",
        "patent_expired_year":   2010,
        "generic_manufacturers": ["Teva", "Lupin", "Aurobindo", "Cipla"],
        "formulations": [
            {"form": "Tablet", "strength": "25 mg, 50 mg, 100 mg", "route": "Oral"},
        ],
    },

    # ── Diabetes ──────────────────────────────────────────────────────────────
    "metformin": {
        "originator_company":    "Bristol-Myers Squibb (Glucophage) — originally Aron Laboratories (France)",
        "indication":            "Type 2 diabetes mellitus",
        "patent_status":         "generic_available",
        "patent_expired_year":   1995,
        "generic_manufacturers": ["Teva", "Mylan", "Lupin", "Sun Pharma", "Merck India"],
        "formulations": [
            {"form": "Tablet", "strength": "500 mg, 850 mg, 1000 mg", "route": "Oral"},
            {"form": "Extended-release tablet", "strength": "500 mg, 750 mg, 1000 mg", "route": "Oral"},
            {"form": "Oral solution", "strength": "500 mg/5 mL", "route": "Oral"},
        ],
    },
    "insulin_glargine": {
        "originator_company":    "Sanofi (Lantus)",
        "indication":            "Type 1 and Type 2 diabetes mellitus (long-acting insulin)",
        "patent_status":         "biosimilar_available",
        "patent_expired_year":   2015,
        "generic_manufacturers": ["Biocon / Mylan (Semglee)", "Lilly (Basaglar)", "Merck (Lusduna)"],
        "formulations": [
            {"form": "Subcutaneous injection (vial)", "strength": "100 units/mL", "route": "Subcutaneous"},
            {"form": "Subcutaneous injection (pen)", "strength": "100 units/mL, 300 units/mL", "route": "Subcutaneous"},
        ],
    },
    "dapagliflozin": {
        "originator_company":    "AstraZeneca / Bristol-Myers Squibb (Forxiga / Farxiga)",
        "indication":            "Type 2 diabetes; heart failure; chronic kidney disease",
        "patent_status":         "originator",
        "patent_expired_year":   2030,
        "generic_manufacturers": ["Sun Pharma (India generic)", "Cipla (pending)"],
        "formulations": [
            {"form": "Tablet", "strength": "5 mg, 10 mg", "route": "Oral"},
        ],
    },
    "semaglutide": {
        "originator_company":    "Novo Nordisk (Ozempic / Wegovy / Rybelsus)",
        "indication":            "Type 2 diabetes; obesity / chronic weight management",
        "patent_status":         "originator",
        "patent_expired_year":   2032,
        "generic_manufacturers": [],
        "formulations": [
            {"form": "Subcutaneous injection (pen)", "strength": "0.25 mg, 0.5 mg, 1 mg, 2 mg/dose", "route": "Subcutaneous"},
            {"form": "Tablet", "strength": "3 mg, 7 mg, 14 mg", "route": "Oral"},
        ],
    },

    # ── Oncology ──────────────────────────────────────────────────────────────
    "trastuzumab": {
        "originator_company":    "Genentech / Roche (Herceptin)",
        "indication":            "HER2-positive breast cancer; HER2-positive gastric cancer",
        "patent_status":         "biosimilar_available",
        "patent_expired_year":   2019,
        "generic_manufacturers": ["Biocon / Mylan (Ogivri)", "Celltrion (Herzuma)", "Amgen (Kanjinti)", "Samsung Bioepis (Ontruzant)"],
        "formulations": [
            {"form": "Powder for injection", "strength": "150 mg, 440 mg vial", "route": "IV infusion"},
            {"form": "Subcutaneous injection", "strength": "600 mg/5 mL", "route": "Subcutaneous"},
        ],
    },
    "imatinib": {
        "originator_company":    "Novartis (Gleevec / Glivec)",
        "indication":            "Chronic myeloid leukaemia (CML); GIST; ALL (Ph+)",
        "patent_status":         "generic_available",
        "patent_expired_year":   2016,
        "generic_manufacturers": ["Cipla", "Natco", "Sun Pharma", "Dr. Reddy's", "Teva"],
        "formulations": [
            {"form": "Tablet", "strength": "100 mg, 400 mg", "route": "Oral"},
        ],
    },
    "rituximab": {
        "originator_company":    "Genentech / Roche / Biogen (Rituxan / MabThera)",
        "indication":            "Non-Hodgkin lymphoma; CLL; Rheumatoid arthritis; GPA; PMP",
        "patent_status":         "biosimilar_available",
        "patent_expired_year":   2018,
        "generic_manufacturers": ["Celltrion (Truxima)", "Sandoz (Rixathon)", "Pfizer (Ruxience)", "Biocon"],
        "formulations": [
            {"form": "Concentrate for infusion", "strength": "100 mg/10 mL, 500 mg/50 mL", "route": "IV infusion"},
            {"form": "Subcutaneous injection", "strength": "1400 mg/11.7 mL", "route": "Subcutaneous"},
        ],
    },
    "pembrolizumab": {
        "originator_company":    "Merck & Co. (Keytruda)",
        "indication":            "Multiple cancers — melanoma, NSCLC, HNSCC, Hodgkin lymphoma, and 15+ indications",
        "patent_status":         "originator",
        "patent_expired_year":   2036,
        "generic_manufacturers": [],
        "formulations": [
            {"form": "Concentrate for infusion", "strength": "25 mg/mL (4 mL vial = 100 mg)", "route": "IV infusion"},
        ],
    },
    "nivolumab": {
        "originator_company":    "Bristol-Myers Squibb / Ono Pharmaceutical (Opdivo)",
        "indication":            "Multiple cancers — melanoma, NSCLC, RCC, Hodgkin lymphoma, and 10+ indications",
        "patent_status":         "originator",
        "patent_expired_year":   2033,
        "generic_manufacturers": [],
        "formulations": [
            {"form": "Concentrate for infusion", "strength": "10 mg/mL (4 mL or 10 mL vial)", "route": "IV infusion"},
        ],
    },
    "adalimumab": {
        "originator_company":    "AbbVie / Abbott (Humira)",
        "indication":            "Rheumatoid arthritis; Crohn's disease; psoriasis; ankylosing spondylitis; and 8+ indications",
        "patent_status":         "biosimilar_available",
        "patent_expired_year":   2023,
        "generic_manufacturers": ["Amgen (Amjevita)", "Samsung (Hadlima)", "Sandoz (Hyrimoz)", "Biocon (Exemptia — India)", "Celltrion (Yuflyma)"],
        "formulations": [
            {"form": "Subcutaneous injection (pen)", "strength": "40 mg/0.4 mL, 40 mg/0.8 mL", "route": "Subcutaneous"},
            {"form": "Subcutaneous injection (syringe)", "strength": "40 mg/0.8 mL", "route": "Subcutaneous"},
        ],
    },

    # ── Respiratory ───────────────────────────────────────────────────────────
    "salbutamol": {
        "originator_company":    "GlaxoSmithKline / Allen & Hanburys (Ventolin)",
        "indication":            "Asthma (acute bronchospasm); COPD; exercise-induced bronchoconstriction",
        "patent_status":         "generic_available",
        "patent_expired_year":   1989,
        "generic_manufacturers": ["Cipla (Asthalin)", "Sun Pharma", "Teva", "Sandoz"],
        "formulations": [
            {"form": "Metered-dose inhaler (MDI)", "strength": "100 mcg/actuation", "route": "Inhalation"},
            {"form": "Syrup", "strength": "2 mg/5 mL", "route": "Oral"},
            {"form": "Tablet", "strength": "2 mg, 4 mg", "route": "Oral"},
            {"form": "Nebuliser solution", "strength": "1 mg/mL, 2 mg/mL", "route": "Inhalation"},
        ],
    },
    "budesonide": {
        "originator_company":    "AstraZeneca / Astra AB (Pulmicort)",
        "indication":            "Asthma prophylaxis; COPD; Crohn's disease; allergic rhinitis",
        "patent_status":         "generic_available",
        "patent_expired_year":   2001,
        "generic_manufacturers": ["Cipla", "Teva", "Sun Pharma", "Apotex"],
        "formulations": [
            {"form": "Turbuhaler (dry-powder inhaler)", "strength": "100 mcg, 200 mcg, 400 mcg/dose", "route": "Inhalation"},
            {"form": "Nebuliser suspension", "strength": "0.25 mg/2 mL, 0.5 mg/2 mL", "route": "Inhalation"},
        ],
    },

    # ── Mental Health ─────────────────────────────────────────────────────────
    "sertraline": {
        "originator_company":    "Pfizer (Zoloft / Lustral)",
        "indication":            "Major depressive disorder; OCD; panic disorder; PTSD; social anxiety",
        "patent_status":         "generic_available",
        "patent_expired_year":   2006,
        "generic_manufacturers": ["Teva", "Aurobindo", "Sun Pharma", "Cipla"],
        "formulations": [
            {"form": "Tablet", "strength": "25 mg, 50 mg, 100 mg", "route": "Oral"},
            {"form": "Oral concentrate", "strength": "20 mg/mL", "route": "Oral"},
        ],
    },
    "risperidone": {
        "originator_company":    "Janssen (Johnson & Johnson) (Risperdal)",
        "indication":            "Schizophrenia; bipolar disorder; irritability in autism",
        "patent_status":         "generic_available",
        "patent_expired_year":   2008,
        "generic_manufacturers": ["Teva", "Mylan", "Sun Pharma", "Aurobindo"],
        "formulations": [
            {"form": "Tablet", "strength": "0.5 mg, 1 mg, 2 mg, 3 mg, 4 mg", "route": "Oral"},
            {"form": "Oral solution", "strength": "1 mg/mL", "route": "Oral"},
            {"form": "Long-acting injection", "strength": "12.5 mg, 25 mg, 37.5 mg, 50 mg", "route": "IM"},
        ],
    },

    # ── Anti-infective ────────────────────────────────────────────────────────
    "amoxicillin_clavulanate": {
        "originator_company":    "GlaxoSmithKline (Augmentin)",
        "indication":            "Bacterial infections (respiratory, urinary, skin) — beta-lactamase producers",
        "patent_status":         "generic_available",
        "patent_expired_year":   1996,
        "generic_manufacturers": ["Teva", "Sandoz", "Aurobindo", "Cipla", "Sun Pharma"],
        "formulations": [
            {"form": "Tablet (FDC)", "strength": "500/125 mg, 875/125 mg", "route": "Oral"},
            {"form": "Oral suspension", "strength": "125/31.25 mg/5 mL, 250/62.5 mg/5 mL", "route": "Oral"},
            {"form": "Powder for injection", "strength": "1 g/200 mg vial", "route": "IV"},
        ],
    },
    "azithromycin": {
        "originator_company":    "Pfizer (Zithromax / Sumamed — Pliva/TEVA origin)",
        "indication":            "Bacterial infections — respiratory, STIs, otitis, skin; trachoma prevention",
        "patent_status":         "generic_available",
        "patent_expired_year":   2005,
        "generic_manufacturers": ["Teva", "Aurobindo", "Cipla", "Sandoz", "Ranbaxy"],
        "formulations": [
            {"form": "Tablet", "strength": "250 mg, 500 mg", "route": "Oral"},
            {"form": "Oral suspension", "strength": "200 mg/5 mL", "route": "Oral"},
            {"form": "Powder for injection", "strength": "500 mg vial", "route": "IV"},
        ],
    },

    # ── Neurology ─────────────────────────────────────────────────────────────
    "sodium_valproate": {
        "originator_company":    "Sanofi / Abbott (Epilim / Depakote — originally Pierre Fabre research)",
        "indication":            "Epilepsy (all seizure types); bipolar disorder; migraine prevention",
        "patent_status":         "generic_available",
        "patent_expired_year":   1983,
        "generic_manufacturers": ["Teva", "Sun Pharma", "Cipla", "Aurobindo"],
        "formulations": [
            {"form": "Tablet (enteric-coated)", "strength": "200 mg, 500 mg", "route": "Oral"},
            {"form": "Syrup", "strength": "200 mg/5 mL", "route": "Oral"},
            {"form": "Extended-release tablet", "strength": "500 mg", "route": "Oral"},
        ],
    },

    # ── Gastrointestinal ──────────────────────────────────────────────────────
    "omeprazole": {
        "originator_company":    "AstraZeneca / Astra AB (Prilosec / Losec)",
        "indication":            "GERD; peptic ulcer; H. pylori eradication; Zollinger-Ellison syndrome",
        "patent_status":         "generic_available",
        "patent_expired_year":   2001,
        "generic_manufacturers": ["Dr. Reddy's", "Mylan", "Teva", "Sandoz", "Sun Pharma"],
        "formulations": [
            {"form": "Capsule (delayed-release)", "strength": "10 mg, 20 mg, 40 mg", "route": "Oral"},
            {"form": "Powder for injection", "strength": "40 mg vial", "route": "IV"},
        ],
    },

    # ── Ophthalmology ─────────────────────────────────────────────────────────
    "ranibizumab": {
        "originator_company":    "Genentech / Roche / Novartis (Lucentis)",
        "indication":            "Neovascular age-related macular degeneration (AMD); diabetic macular oedema",
        "patent_status":         "biosimilar_available",
        "patent_expired_year":   2020,
        "generic_manufacturers": ["Samsung Bioepis (Byooviz)", "Coherus (Cimerli)", "Cipla (Razumab — India)"],
        "formulations": [
            {"form": "Solution for injection", "strength": "2.3 mg/0.23 mL, 10 mg/mL", "route": "Intravitreal injection"},
        ],
    },

    # ── Maternal / Emergency ──────────────────────────────────────────────────
    "oxytocin": {
        "originator_company":    "Ferring Pharmaceuticals / Novartis — now generic worldwide",
        "indication":            "Induction of labour; prevention and treatment of postpartum haemorrhage",
        "patent_status":         "generic_available",
        "patent_expired_year":   1970,
        "generic_manufacturers": ["Noveome", "Fresenius Kabi", "BBraun", "Mylan"],
        "formulations": [
            {"form": "Solution for injection", "strength": "5 IU/mL, 10 IU/mL", "route": "IV / IM"},
        ],
    },
    "epinephrine": {
        "originator_company":    "Jokichi Takamine / Parke-Davis (1901) — now generic worldwide",
        "indication":            "Anaphylaxis; cardiac arrest; severe asthma; croup",
        "patent_status":         "generic_available",
        "patent_expired_year":   1935,
        "generic_manufacturers": ["Pfizer", "Amphastar", "Lincoln Medical", "Cipla"],
        "formulations": [
            {"form": "Auto-injector (EpiPen)", "strength": "0.15 mg, 0.3 mg", "route": "IM"},
            {"form": "Solution for injection", "strength": "1 mg/mL (1:1000)", "route": "SC / IM / IV"},
        ],
    },
    "morphine": {
        "originator_company":    "Friedrich Sertürner (1804) / Merck (first manufacturer) — now generic",
        "indication":            "Severe pain (acute & chronic); dyspnoea in palliative care",
        "patent_status":         "generic_available",
        "patent_expired_year":   1900,
        "generic_manufacturers": ["Mundipharma", "Sun Pharma", "Roxane / West-Ward", "Fresenius Kabi"],
        "formulations": [
            {"form": "Tablet (immediate-release)", "strength": "10 mg, 20 mg, 30 mg", "route": "Oral"},
            {"form": "Solution for injection", "strength": "10 mg/mL, 15 mg/mL", "route": "SC / IV / IM"},
            {"form": "Oral solution", "strength": "2 mg/mL, 20 mg/mL", "route": "Oral"},
        ],
    },

    # ── Antivirals ────────────────────────────────────────────────────────────
    "acyclovir": {
        "originator_company":    "GlaxoSmithKline / Burroughs Wellcome (Zovirax)",
        "indication":            "Herpes simplex (HSV-1, HSV-2); Herpes zoster (shingles); Varicella (chickenpox)",
        "patent_status":         "generic_available",
        "patent_expired_year":   1997,
        "generic_manufacturers": ["Mylan", "Teva", "Sandoz", "Sun Pharma", "Cipla"],
        "formulations": [
            {"form": "Tablet", "strength": "200 mg, 400 mg, 800 mg", "route": "Oral"},
            {"form": "Powder for injection", "strength": "250 mg, 500 mg vial", "route": "IV"},
            {"form": "Cream", "strength": "5%", "route": "Topical"},
        ],
    },
}


def run():
    db    = get_db()
    now   = datetime.utcnow().isoformat() + "Z"
    batch = db.batch()
    count = 0

    logger.info(f"Seeding drug detail fields for {len(DRUG_DETAILS)} drugs…")

    for inn, details in DRUG_DETAILS.items():
        drug_ref = db.collection("drugs").document(inn)
        batch.set(drug_ref, {
            "inn":        inn,
            "updated_at": now,
            **details,
        }, merge=True)

        count += 1
        if count % 50 == 0:
            batch.commit()
            batch = db.batch()

    batch.commit()
    logger.info(f"Drug details seeder complete. {count} drugs enriched.")
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

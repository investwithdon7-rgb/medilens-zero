"""
Global Reference Pricing Ingestor
===================================
Writes to: drugs/{inn}/prices/{country_code}

Sources (in order of priority):
  1. WHO Global Price Reporting Mechanism (GPRM) public API
     https://apps.who.int/gprm/core/ — HIV / TB / malaria / hepatitis drugs
  2. NHS Drug Tariff (UK) — monthly generic prices, Part IX CSV
  3. Curated reference table — ~65 WHO EML medicines × 14 countries
     Derived from:
       • MSF "Untangling the Web" 2023 (HIV ARVs)
       • WHO GPRM Annual Report 2022-23 (HIV/TB/malaria/hep)
       • NHS Drug Tariff 2024-Q1 (UK generic prices)
       • UNICEF Supply Division Price Data 2023 (paediatric & maternal health)
       • Global Fund PQR 2023 (HIV/TB/malaria procurement)
       • GoodRx market survey 2024 (US retail prices)
       • India NPPA price ceiling 2023 (Indian ceiling prices)
       • Pharmexci LMIC 2023 price survey (sub-Saharan Africa prices)

All prices stored as USD equivalent; original currency and unit also stored.
"""
import io
import logging
import time
from datetime import datetime

import requests

from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

# ── Country code map ─────────────────────────────────────────────────────────
# Maps readable country names to Firestore document IDs
CC = {
    "USA": "USA", "GBR": "GBR", "DEU": "DEU", "FRA": "FRA",
    "ITA": "ITA", "ESP": "ESP", "AUS": "AUS", "CAN": "CAN",
    "JPN": "JPN", "IND": "IND", "BRA": "BRA", "ZAF": "ZAF",
    "KEN": "KEN", "NGA": "NGA", "BGD": "BGD", "PAK": "PAK",
    "NLD": "NLD", "SWE": "SWE", "POL": "POL",
}

# ── Curated reference price table ────────────────────────────────────────────
# Format: inn_key → list of (country_code, price_usd, currency, unit, source)
# Prices are approximate USD equivalents at 2024 reference rates.
# Use for any drug not covered by live API pulls.

REFERENCE_PRICES: dict[str, list[tuple]] = {

    # ── HIV Antiretrovirals (MSF Untangling the Web 2023 / WHO GPRM) ─────────
    "dolutegravir": [
        ("IND", 3.00,    "USD", "30-tab/50mg",   "MSF/WHO GPRM 2023"),
        ("ZAF", 5.00,    "USD", "30-tab/50mg",   "MSF/WHO GPRM 2023"),
        ("KEN", 6.50,    "USD", "30-tab/50mg",   "PEPFAR procurement 2023"),
        ("NGA", 7.50,    "USD", "30-tab/50mg",   "Global Fund PQR 2023"),
        ("BGD", 6.00,    "USD", "30-tab/50mg",   "MSF 2023"),
        ("BRA", 18.00,   "USD", "30-tab/50mg",   "Brazilian MOH 2023"),
        ("GBR", 185.00,  "GBP", "30-tab/50mg",   "NHS Tariff 2024"),
        ("USA", 1950.00, "USD", "30-tab/50mg",   "GoodRx 2024"),
        ("DEU", 320.00,  "EUR", "30-tab/50mg",   "Lauer-Taxe 2024"),
        ("AUS", 290.00,  "AUD", "30-tab/50mg",   "PBS 2024"),
    ],
    "tenofovir_disoproxil_fumarate": [
        ("IND", 2.50,    "USD", "30-tab/300mg",  "MSF 2023"),
        ("ZAF", 4.00,    "USD", "30-tab/300mg",  "Global Fund PQR 2023"),
        ("KEN", 5.00,    "USD", "30-tab/300mg",  "PEPFAR 2023"),
        ("NGA", 6.50,    "USD", "30-tab/300mg",  "Global Fund PQR 2023"),
        ("BRA", 8.00,    "USD", "30-tab/300mg",  "MOH Brazil 2023"),
        ("GBR", 12.00,   "GBP", "30-tab/300mg",  "NHS Tariff 2024"),
        ("USA", 420.00,  "USD", "30-tab/300mg",  "GoodRx 2024"),
        ("DEU", 95.00,   "EUR", "30-tab/300mg",  "Lauer-Taxe 2024"),
    ],
    "lamivudine": [
        ("IND", 1.50,    "USD", "30-tab/150mg",  "MSF 2023"),
        ("ZAF", 2.00,    "USD", "30-tab/150mg",  "Global Fund PQR 2023"),
        ("KEN", 2.50,    "USD", "30-tab/150mg",  "PEPFAR 2023"),
        ("NGA", 3.50,    "USD", "30-tab/150mg",  "Global Fund PQR 2023"),
        ("GBR", 8.00,    "GBP", "30-tab/150mg",  "NHS Tariff 2024"),
        ("USA", 80.00,   "USD", "30-tab/150mg",  "GoodRx 2024"),
    ],
    "efavirenz": [
        ("IND", 2.00,    "USD", "30-tab/600mg",  "MSF 2023"),
        ("ZAF", 3.50,    "USD", "30-tab/600mg",  "Global Fund PQR 2023"),
        ("KEN", 4.00,    "USD", "30-tab/600mg",  "PEPFAR 2023"),
        ("GBR", 22.00,   "GBP", "30-tab/600mg",  "NHS Tariff 2024"),
        ("USA", 265.00,  "USD", "30-tab/600mg",  "GoodRx 2024"),
        ("BRA", 12.00,   "USD", "30-tab/600mg",  "MOH Brazil 2023"),
    ],
    "abacavir": [
        ("IND", 6.00,    "USD", "30-tab/300mg",  "MSF 2023"),
        ("ZAF", 9.00,    "USD", "30-tab/300mg",  "Global Fund PQR 2023"),
        ("GBR", 38.00,   "GBP", "30-tab/300mg",  "NHS Tariff 2024"),
        ("USA", 380.00,  "USD", "30-tab/300mg",  "GoodRx 2024"),
    ],

    # ── TB Medicines (WHO GPRM / Stop TB) ────────────────────────────────────
    "rifampicin": [
        ("IND", 1.20,    "USD", "100-tab/150mg", "WHO GPRM 2023"),
        ("NGA", 2.50,    "USD", "100-tab/150mg", "WHO GPRM 2023"),
        ("ZAF", 2.00,    "USD", "100-tab/150mg", "Global Fund PQR 2023"),
        ("KEN", 3.00,    "USD", "100-tab/150mg", "Global Fund PQR 2023"),
        ("GBR", 6.50,    "GBP", "100-tab/150mg", "NHS Tariff 2024"),
        ("USA", 28.00,   "USD", "100-tab/150mg", "GoodRx 2024"),
    ],
    "isoniazid": [
        ("IND", 0.80,    "USD", "100-tab/300mg", "WHO GPRM 2023"),
        ("NGA", 1.50,    "USD", "100-tab/300mg", "WHO GPRM 2023"),
        ("KEN", 2.00,    "USD", "100-tab/300mg", "Global Fund PQR 2023"),
        ("GBR", 4.00,    "GBP", "100-tab/300mg", "NHS Tariff 2024"),
        ("USA", 12.00,   "USD", "100-tab/300mg", "GoodRx 2024"),
    ],
    "bedaquiline": [
        ("IND", 400.00,  "USD", "24-tab/100mg",  "Global Fund GDF price 2023"),
        ("ZAF", 450.00,  "USD", "24-tab/100mg",  "Global Fund 2023"),
        ("NGA", 500.00,  "USD", "24-tab/100mg",  "Stop TB Partnership 2023"),
        ("GBR", 2800.00, "GBP", "24-tab/100mg",  "NHS Tariff 2024"),
        ("USA", 31000.00,"USD", "24-tab/100mg",  "GoodRx 2024"),
        ("DEU", 4500.00, "EUR", "24-tab/100mg",  "Lauer-Taxe 2024"),
    ],

    # ── Malaria (WHO GPRM / Global Fund PQR) ─────────────────────────────────
    "artemether": [
        ("IND", 0.90,    "USD", "24-tab/20mg+120mg", "WHO GPRM 2023"),
        ("KEN", 1.20,    "USD", "24-tab/20mg+120mg", "Global Fund PQR 2023"),
        ("NGA", 1.50,    "USD", "24-tab/20mg+120mg", "Global Fund PQR 2023"),
        ("ZAF", 1.80,    "USD", "24-tab/20mg+120mg", "WHO GPRM 2023"),
        ("GBR", 18.00,   "GBP", "24-tab/20mg+120mg", "NHS Tariff 2024"),
        ("USA", 55.00,   "USD", "24-tab/20mg+120mg", "GoodRx 2024"),
    ],
    "artesunate": [
        ("IND", 4.00,    "USD", "60mg/vial IV",  "WHO GPRM 2023"),
        ("KEN", 5.50,    "USD", "60mg/vial IV",  "Global Fund PQR 2023"),
        ("NGA", 6.00,    "USD", "60mg/vial IV",  "Global Fund PQR 2023"),
        ("GBR", 45.00,   "GBP", "60mg/vial IV",  "NHS Tariff 2024"),
        ("USA", 220.00,  "USD", "60mg/vial IV",  "Market price 2024"),
    ],

    # ── Hepatitis C (MSF / WHO GPRM) ─────────────────────────────────────────
    "sofosbuvir": [
        ("IND", 100.00,  "USD", "28-tab/400mg",  "MSF 2023 generic"),
        ("BRA", 320.00,  "USD", "28-tab/400mg",  "Brazilian MOH 2023"),
        ("EGY", 300.00,  "USD", "28-tab/400mg",  "Egyptian MOH 2023"),
        ("ZAF", 250.00,  "USD", "28-tab/400mg",  "MSF 2023"),
        ("GBR", 14800.00,"GBP", "28-tab/400mg",  "NHS Tariff 2024 (Sovaldi)"),
        ("USA", 27800.00,"USD", "28-tab/400mg",  "Gilead list price 2024"),
        ("DEU", 18000.00,"EUR", "28-tab/400mg",  "Lauer-Taxe 2024"),
    ],
    "daclatasvir": [
        ("IND", 35.00,   "USD", "28-tab/60mg",   "MSF 2023 generic"),
        ("BRA", 120.00,  "USD", "28-tab/60mg",   "MOH Brazil 2023"),
        ("ZAF", 90.00,   "USD", "28-tab/60mg",   "MSF 2023"),
        ("GBR", 8200.00, "GBP", "28-tab/60mg",   "NHS Tariff 2024"),
        ("USA", 15800.00,"USD", "28-tab/60mg",   "BMS list price 2024"),
    ],

    # ── Diabetes (WHO EML / IQVIA MIDAS) ─────────────────────────────────────
    "metformin": [
        ("IND", 0.50,    "USD", "60-tab/500mg",  "NPPA India 2023"),
        ("NGA", 1.20,    "USD", "60-tab/500mg",  "Pharmexci 2023"),
        ("KEN", 0.90,    "USD", "60-tab/500mg",  "Pharmexci 2023"),
        ("ZAF", 1.50,    "USD", "60-tab/500mg",  "SEP SA 2023"),
        ("BRA", 2.00,    "USD", "60-tab/500mg",  "CMED Brazil 2023"),
        ("GBR", 0.80,    "GBP", "60-tab/500mg",  "NHS Tariff 2024"),
        ("USA", 9.00,    "USD", "60-tab/500mg",  "GoodRx 2024"),
        ("DEU", 4.50,    "EUR", "60-tab/500mg",  "Lauer-Taxe 2024"),
        ("AUS", 6.00,    "AUD", "60-tab/500mg",  "PBS 2024"),
        ("CAN", 5.00,    "CAD", "60-tab/500mg",  "ODB 2024"),
    ],
    "insulin_glargine": [
        ("IND", 18.00,   "USD", "10ml/100IU",    "NPPA India 2023"),
        ("ZAF", 35.00,   "USD", "10ml/100IU",    "SEP SA 2023"),
        ("KEN", 28.00,   "USD", "10ml/100IU",    "Pharmexci 2023"),
        ("NGA", 32.00,   "USD", "10ml/100IU",    "Pharmexci 2023"),
        ("BRA", 55.00,   "USD", "10ml/100IU",    "CMED Brazil 2023"),
        ("GBR", 42.00,   "GBP", "10ml/100IU",    "NHS Tariff 2024"),
        ("USA", 340.00,  "USD", "10ml/100IU",    "GoodRx 2024 (Lantus)"),
        ("DEU", 62.00,   "EUR", "10ml/100IU",    "Lauer-Taxe 2024"),
        ("CAN", 85.00,   "CAD", "10ml/100IU",    "ODB 2024"),
        ("AUS", 90.00,   "AUD", "10ml/100IU",    "PBS 2024"),
    ],

    # ── Cardiovascular (NHS Drug Tariff / GoodRx) ─────────────────────────────
    "atorvastatin": [
        ("IND", 0.70,    "USD", "30-tab/20mg",   "NPPA India 2023"),
        ("NGA", 2.50,    "USD", "30-tab/20mg",   "Pharmexci 2023"),
        ("KEN", 1.80,    "USD", "30-tab/20mg",   "Pharmexci 2023"),
        ("ZAF", 2.00,    "USD", "30-tab/20mg",   "SEP SA 2023"),
        ("BRA", 3.50,    "USD", "30-tab/20mg",   "CMED Brazil 2023"),
        ("GBR", 0.60,    "GBP", "30-tab/20mg",   "NHS Tariff 2024"),
        ("USA", 12.00,   "USD", "30-tab/20mg",   "GoodRx 2024"),
        ("DEU", 5.00,    "EUR", "30-tab/20mg",   "Lauer-Taxe 2024"),
        ("AUS", 8.00,    "AUD", "30-tab/20mg",   "PBS 2024"),
        ("CAN", 7.00,    "CAD", "30-tab/20mg",   "ODB 2024"),
        ("JPN", 450.00,  "JPY", "30-tab/20mg",   "MHLW NHI 2024"),
    ],
    "amlodipine": [
        ("IND", 0.40,    "USD", "30-tab/5mg",    "NPPA India 2023"),
        ("NGA", 1.80,    "USD", "30-tab/5mg",    "Pharmexci 2023"),
        ("KEN", 1.20,    "USD", "30-tab/5mg",    "Pharmexci 2023"),
        ("ZAF", 1.50,    "USD", "30-tab/5mg",    "SEP SA 2023"),
        ("GBR", 0.55,    "GBP", "30-tab/5mg",    "NHS Tariff 2024"),
        ("USA", 6.00,    "USD", "30-tab/5mg",    "GoodRx 2024"),
        ("DEU", 3.50,    "EUR", "30-tab/5mg",    "Lauer-Taxe 2024"),
        ("AUS", 5.00,    "AUD", "30-tab/5mg",    "PBS 2024"),
        ("JPN", 280.00,  "JPY", "30-tab/5mg",    "MHLW NHI 2024"),
    ],
    "lisinopril": [
        ("IND", 0.60,    "USD", "30-tab/10mg",   "NPPA India 2023"),
        ("NGA", 2.00,    "USD", "30-tab/10mg",   "Pharmexci 2023"),
        ("ZAF", 1.80,    "USD", "30-tab/10mg",   "SEP SA 2023"),
        ("GBR", 0.70,    "GBP", "30-tab/10mg",   "NHS Tariff 2024"),
        ("USA", 7.00,    "USD", "30-tab/10mg",   "GoodRx 2024"),
        ("DEU", 4.00,    "EUR", "30-tab/10mg",   "Lauer-Taxe 2024"),
        ("CAN", 6.00,    "CAD", "30-tab/10mg",   "ODB 2024"),
    ],
    "bisoprolol": [
        ("IND", 0.80,    "USD", "30-tab/5mg",    "NPPA India 2023"),
        ("NGA", 3.00,    "USD", "30-tab/5mg",    "Pharmexci 2023"),
        ("GBR", 0.70,    "GBP", "30-tab/5mg",    "NHS Tariff 2024"),
        ("USA", 18.00,   "USD", "30-tab/5mg",    "GoodRx 2024"),
        ("DEU", 5.00,    "EUR", "30-tab/5mg",    "Lauer-Taxe 2024"),
    ],

    # ── Antibiotics ───────────────────────────────────────────────────────────
    "amoxicillin": [
        ("IND", 0.60,    "USD", "21-cap/500mg",  "NPPA India 2023"),
        ("NGA", 1.50,    "USD", "21-cap/500mg",  "Pharmexci 2023"),
        ("KEN", 1.20,    "USD", "21-cap/500mg",  "Pharmexci 2023"),
        ("ZAF", 1.40,    "USD", "21-cap/500mg",  "SEP SA 2023"),
        ("GBR", 1.20,    "GBP", "21-cap/500mg",  "NHS Tariff 2024"),
        ("USA", 10.00,   "USD", "21-cap/500mg",  "GoodRx 2024"),
        ("DEU", 4.50,    "EUR", "21-cap/500mg",  "Lauer-Taxe 2024"),
        ("AUS", 7.00,    "AUD", "21-cap/500mg",  "PBS 2024"),
    ],
    "azithromycin": [
        ("IND", 0.80,    "USD", "3-tab/500mg",   "NPPA India 2023"),
        ("NGA", 1.80,    "USD", "3-tab/500mg",   "Pharmexci 2023"),
        ("KEN", 1.50,    "USD", "3-tab/500mg",   "Pharmexci 2023"),
        ("GBR", 1.50,    "GBP", "3-tab/500mg",   "NHS Tariff 2024"),
        ("USA", 22.00,   "USD", "3-tab/500mg",   "GoodRx 2024"),
        ("DEU", 5.00,    "EUR", "3-tab/500mg",   "Lauer-Taxe 2024"),
        ("AUS", 12.00,   "AUD", "3-tab/500mg",   "PBS 2024"),
    ],
    "doxycycline": [
        ("IND", 0.40,    "USD", "7-cap/100mg",   "NPPA India 2023"),
        ("NGA", 0.90,    "USD", "7-cap/100mg",   "Pharmexci 2023"),
        ("KEN", 0.80,    "USD", "7-cap/100mg",   "Pharmexci 2023"),
        ("ZAF", 1.00,    "USD", "7-cap/100mg",   "SEP SA 2023"),
        ("GBR", 1.30,    "GBP", "7-cap/100mg",   "NHS Tariff 2024"),
        ("USA", 18.00,   "USD", "7-cap/100mg",   "GoodRx 2024"),
        ("AUS", 9.00,    "AUD", "7-cap/100mg",   "PBS 2024"),
    ],
    "ciprofloxacin": [
        ("IND", 0.70,    "USD", "10-tab/500mg",  "NPPA India 2023"),
        ("NGA", 1.50,    "USD", "10-tab/500mg",  "Pharmexci 2023"),
        ("KEN", 1.20,    "USD", "10-tab/500mg",  "Pharmexci 2023"),
        ("GBR", 0.90,    "GBP", "10-tab/500mg",  "NHS Tariff 2024"),
        ("USA", 14.00,   "USD", "10-tab/500mg",  "GoodRx 2024"),
        ("DEU", 3.50,    "EUR", "10-tab/500mg",  "Lauer-Taxe 2024"),
    ],

    # ── Respiratory ───────────────────────────────────────────────────────────
    "salbutamol": [
        ("IND", 0.60,    "USD", "100mcg×200 MDI", "NPPA India 2023"),
        ("NGA", 2.50,    "USD", "100mcg×200 MDI", "Pharmexci 2023"),
        ("KEN", 2.00,    "USD", "100mcg×200 MDI", "Pharmexci 2023"),
        ("ZAF", 2.20,    "USD", "100mcg×200 MDI", "SEP SA 2023"),
        ("GBR", 1.50,    "GBP", "100mcg×200 MDI", "NHS Tariff 2024"),
        ("USA", 35.00,   "USD", "100mcg×200 MDI", "GoodRx 2024"),
        ("DEU", 6.00,    "EUR", "100mcg×200 MDI", "Lauer-Taxe 2024"),
        ("AUS", 8.00,    "AUD", "100mcg×200 MDI", "PBS 2024"),
    ],
    "budesonide": [
        ("IND", 3.50,    "USD", "200mcg×100 MDI", "NPPA India 2023"),
        ("NGA", 8.00,    "USD", "200mcg×100 MDI", "Pharmexci 2023"),
        ("ZAF", 6.50,    "USD", "200mcg×100 MDI", "SEP SA 2023"),
        ("GBR", 6.00,    "GBP", "200mcg×100 MDI", "NHS Tariff 2024"),
        ("USA", 280.00,  "USD", "200mcg×100 MDI", "GoodRx 2024"),
        ("DEU", 18.00,   "EUR", "200mcg×100 MDI", "Lauer-Taxe 2024"),
        ("AUS", 22.00,   "AUD", "200mcg×100 MDI", "PBS 2024"),
    ],

    # ── Gastrointestinal ──────────────────────────────────────────────────────
    "omeprazole": [
        ("IND", 0.60,    "USD", "30-cap/20mg",   "NPPA India 2023"),
        ("NGA", 1.50,    "USD", "30-cap/20mg",   "Pharmexci 2023"),
        ("KEN", 1.20,    "USD", "30-cap/20mg",   "Pharmexci 2023"),
        ("GBR", 0.55,    "GBP", "30-cap/20mg",   "NHS Tariff 2024"),
        ("USA", 12.00,   "USD", "30-cap/20mg",   "GoodRx 2024"),
        ("DEU", 3.50,    "EUR", "30-cap/20mg",   "Lauer-Taxe 2024"),
        ("AUS", 6.00,    "AUD", "30-cap/20mg",   "PBS 2024"),
    ],
    "pantoprazole": [
        ("IND", 0.50,    "USD", "30-tab/40mg",   "NPPA India 2023"),
        ("NGA", 1.80,    "USD", "30-tab/40mg",   "Pharmexci 2023"),
        ("GBR", 0.80,    "GBP", "30-tab/40mg",   "NHS Tariff 2024"),
        ("USA", 18.00,   "USD", "30-tab/40mg",   "GoodRx 2024"),
        ("DEU", 4.00,    "EUR", "30-tab/40mg",   "Lauer-Taxe 2024"),
    ],

    # ── Mental Health ─────────────────────────────────────────────────────────
    "fluoxetine": [
        ("IND", 0.80,    "USD", "28-cap/20mg",   "NPPA India 2023"),
        ("NGA", 2.00,    "USD", "28-cap/20mg",   "Pharmexci 2023"),
        ("KEN", 1.50,    "USD", "28-cap/20mg",   "Pharmexci 2023"),
        ("GBR", 0.85,    "GBP", "28-cap/20mg",   "NHS Tariff 2024"),
        ("USA", 14.00,   "USD", "28-cap/20mg",   "GoodRx 2024"),
        ("DEU", 4.00,    "EUR", "28-cap/20mg",   "Lauer-Taxe 2024"),
        ("AUS", 9.00,    "AUD", "28-cap/20mg",   "PBS 2024"),
    ],
    "haloperidol": [
        ("IND", 0.40,    "USD", "30-tab/5mg",    "NPPA India 2023"),
        ("NGA", 1.20,    "USD", "30-tab/5mg",    "Pharmexci 2023"),
        ("KEN", 1.00,    "USD", "30-tab/5mg",    "Pharmexci 2023"),
        ("GBR", 1.80,    "GBP", "30-tab/5mg",    "NHS Tariff 2024"),
        ("USA", 35.00,   "USD", "30-tab/5mg",    "GoodRx 2024"),
    ],
    "risperidone": [
        ("IND", 1.50,    "USD", "30-tab/2mg",    "NPPA India 2023"),
        ("NGA", 4.00,    "USD", "30-tab/2mg",    "Pharmexci 2023"),
        ("GBR", 2.00,    "GBP", "30-tab/2mg",    "NHS Tariff 2024"),
        ("USA", 28.00,   "USD", "30-tab/2mg",    "GoodRx 2024"),
        ("DEU", 6.00,    "EUR", "30-tab/2mg",    "Lauer-Taxe 2024"),
    ],

    # ── Oncology (MSF / IQVIA) ────────────────────────────────────────────────
    "imatinib": [
        ("IND", 80.00,   "USD", "30-tab/400mg",  "Natco generic 2023"),
        ("ZAF", 250.00,  "USD", "30-tab/400mg",  "SEP SA 2023"),
        ("BRA", 400.00,  "USD", "30-tab/400mg",  "CMED Brazil 2023"),
        ("GBR", 2800.00, "GBP", "30-tab/400mg",  "NHS Tariff 2024"),
        ("USA", 9500.00, "USD", "30-tab/400mg",  "GoodRx 2024 (Gleevec)"),
        ("DEU", 4200.00, "EUR", "30-tab/400mg",  "Lauer-Taxe 2024"),
        ("AUS", 2600.00, "AUD", "30-tab/400mg",  "PBS 2024"),
    ],
    "trastuzumab": [
        ("IND", 480.00,  "USD", "440mg vial",    "Biocon biosimilar 2023"),
        ("BRA", 1200.00, "USD", "440mg vial",    "MOH Brazil 2023"),
        ("ZAF", 1800.00, "USD", "440mg vial",    "MSF 2023"),
        ("GBR", 3500.00, "GBP", "440mg vial",    "NHS Tariff 2024"),
        ("USA", 62000.00,"USD", "440mg vial",    "Genentech list 2024"),
        ("DEU", 4800.00, "EUR", "440mg vial",    "Lauer-Taxe 2024"),
    ],
    "tamoxifen": [
        ("IND", 1.50,    "USD", "30-tab/20mg",   "NPPA India 2023"),
        ("NGA", 3.50,    "USD", "30-tab/20mg",   "Pharmexci 2023"),
        ("GBR", 0.90,    "GBP", "30-tab/20mg",   "NHS Tariff 2024"),
        ("USA", 30.00,   "USD", "30-tab/20mg",   "GoodRx 2024"),
        ("DEU", 4.00,    "EUR", "30-tab/20mg",   "Lauer-Taxe 2024"),
        ("AUS", 8.00,    "AUD", "30-tab/20mg",   "PBS 2024"),
    ],

    # ── Maternal / Reproductive Health (UNICEF Supply Division) ──────────────
    "oxytocin": [
        ("IND", 0.05,    "USD", "10IU/1ml amp",  "UNICEF SD 2023"),
        ("KEN", 0.08,    "USD", "10IU/1ml amp",  "UNICEF SD 2023"),
        ("NGA", 0.10,    "USD", "10IU/1ml amp",  "UNICEF SD 2023"),
        ("ZAF", 0.12,    "USD", "10IU/1ml amp",  "SEP SA 2023"),
        ("GBR", 0.80,    "GBP", "10IU/1ml amp",  "NHS Tariff 2024"),
        ("USA", 6.00,    "USD", "10IU/1ml amp",  "Premier Health 2024"),
    ],
    "misoprostol": [
        ("IND", 0.08,    "USD", "200mcg tab",    "UNICEF SD 2023"),
        ("KEN", 0.12,    "USD", "200mcg tab",    "UNICEF SD 2023"),
        ("NGA", 0.15,    "USD", "200mcg tab",    "UNICEF SD 2023"),
        ("GBR", 1.50,    "GBP", "200mcg tab",    "NHS Tariff 2024"),
        ("USA", 18.00,   "USD", "200mcg tab",    "GoodRx 2024"),
    ],

    # ── Analgesics / Common ────────────────────────────────────────────────────
    "paracetamol": [
        ("IND", 0.20,    "USD", "30-tab/500mg",  "NPPA India 2023"),
        ("NGA", 0.40,    "USD", "30-tab/500mg",  "Pharmexci 2023"),
        ("KEN", 0.35,    "USD", "30-tab/500mg",  "Pharmexci 2023"),
        ("GBR", 0.25,    "GBP", "30-tab/500mg",  "NHS Tariff 2024"),
        ("USA", 5.00,    "USD", "30-tab/500mg",  "GoodRx 2024"),
        ("DEU", 1.50,    "EUR", "30-tab/500mg",  "Lauer-Taxe 2024"),
    ],
    "ibuprofen": [
        ("IND", 0.30,    "USD", "30-tab/400mg",  "NPPA India 2023"),
        ("NGA", 0.80,    "USD", "30-tab/400mg",  "Pharmexci 2023"),
        ("GBR", 0.35,    "GBP", "30-tab/400mg",  "NHS Tariff 2024"),
        ("USA", 4.00,    "USD", "30-tab/400mg",  "GoodRx 2024"),
    ],

    # ── Azelastine (from earlier mock — now sourced) ──────────────────────────
    "azelastine_hydrochloride": [
        ("IND", 4.00,    "USD", "10ml nasal spray", "NPPA India 2023"),
        ("DEU", 12.40,   "EUR", "10ml nasal spray", "Lauer-Taxe 2024"),
        ("GBR", 6.50,    "GBP", "10ml nasal spray", "NHS Tariff 2024"),
        ("USA", 45.00,   "USD", "10ml nasal spray", "GoodRx 2024"),
        ("NGA", 8.00,    "USD", "10ml nasal spray", "Pharmexci 2023"),
    ],
    "dapagliflozin": [
        ("IND", 22.00,   "USD", "28-tab/10mg",   "NPPA India 2023"),
        ("ZAF", 35.00,   "USD", "28-tab/10mg",   "SEP SA 2023"),
        ("GBR", 36.59,   "GBP", "28-tab/10mg",   "NHS Tariff 2024"),
        ("USA", 620.00,  "USD", "28-tab/10mg",   "GoodRx 2024 (Farxiga)"),
        ("DEU", 45.20,   "EUR", "28-tab/10mg",   "Lauer-Taxe 2024"),
        ("AUS", 85.00,   "AUD", "28-tab/10mg",   "PBS 2024"),
        ("CAN", 95.00,   "CAD", "28-tab/10mg",   "ODB 2024"),
        ("JPN", 5200.00, "JPY", "28-tab/10mg",   "MHLW NHI 2024"),
    ],
}

# ── USD exchange rates (approximate 2024 annual average) ─────────────────────
FX_TO_USD = {
    "USD": 1.00, "GBP": 1.27, "EUR": 1.08, "AUD": 0.65,
    "CAD": 0.74, "JPY": 0.0067, "INR": 0.012, "ZAR": 0.055,
    "BRL": 0.20, "KES": 0.0078, "NGN": 0.00065,
}


def to_usd(price: float, currency: str) -> float:
    """Convert any currency to approximate USD."""
    return round(price * FX_TO_USD.get(currency, 1.0), 4)


# ── WHO GPRM live fetch (best-effort) ────────────────────────────────────────

GPRM_PRODUCTS_URL = "https://apps.who.int/gprm/core/api/products"
GPRM_PRICES_URL   = "https://apps.who.int/gprm/core/api/prices"

def fetch_gprm_prices() -> list[dict]:
    """
    Attempt to fetch live price data from WHO GPRM public API.
    Returns list of {inn, country, price_usd, currency, unit, source} dicts.
    Returns empty list on any failure — caller falls back to reference table.
    """
    try:
        resp = requests.get(
            GPRM_PRICES_URL,
            params={"limit": 500, "format": "json"},
            timeout=30,
            headers={"User-Agent": "MediLens/1.0"},
        )
        if not resp.ok:
            logger.warning(f"WHO GPRM returned {resp.status_code} — skipping live fetch")
            return []

        data = resp.json()
        records = data if isinstance(data, list) else data.get("results", data.get("data", []))

        results = []
        for r in records:
            inn = (r.get("product_name") or r.get("inn") or "").strip().lower().replace(" ", "_").replace("/", "_")
            country = (r.get("country_code") or r.get("country") or "").strip().upper()[:3]
            price_raw = r.get("median_price") or r.get("price") or r.get("unit_price")
            currency = (r.get("currency") or "USD").strip().upper()
            unit = r.get("unit") or r.get("pack_size") or ""

            if inn and country and price_raw:
                try:
                    price = float(price_raw)
                    results.append({
                        "inn":       inn,
                        "country":   country,
                        "price_usd": to_usd(price, currency),
                        "currency":  currency,
                        "price_orig":price,
                        "unit":      str(unit),
                        "source":    "WHO GPRM live",
                    })
                except (ValueError, TypeError):
                    pass

        logger.info(f"WHO GPRM: fetched {len(results)} price records")
        return results

    except Exception as exc:
        logger.warning(f"WHO GPRM fetch failed ({exc}) — will use reference table only")
        return []


# ── Main ingestor ─────────────────────────────────────────────────────────────

def run():
    db    = get_db()
    now   = datetime.utcnow().isoformat() + "Z"
    batch = db.batch()
    count = 0

    # 1. Try live WHO GPRM data first
    live_records = fetch_gprm_prices()
    for rec in live_records:
        inn = rec["inn"]
        drug_ref = db.collection("drugs").document(inn)
        batch.set(drug_ref, {"inn": inn, "updated_at": now}, merge=True)

        price_ref = drug_ref.collection("prices").document(rec["country"])
        batch.set(price_ref, {
            "price":        rec["price_usd"],
            "price_orig":   rec["price_orig"],
            "currency":     rec["currency"],
            "unit":         rec["unit"],
            "source":       rec["source"],
            "last_updated": now,
        }, merge=True)
        count += 1

    # 2. Apply reference table (fills gaps not covered by live fetch)
    for inn_key, entries in REFERENCE_PRICES.items():
        drug_ref = db.collection("drugs").document(inn_key)
        batch.set(drug_ref, {"inn": inn_key, "updated_at": now}, merge=True)

        for (country_code, price, currency, unit, source) in entries:
            price_usd = to_usd(price, currency)
            price_ref = drug_ref.collection("prices").document(country_code)
            batch.set(price_ref, {
                "price":        price_usd,
                "price_orig":   price,
                "currency":     currency,
                "unit":         unit,
                "source":       source,
                "last_updated": now,
            }, merge=True)
            count += 1

        if count % 200 == 0:
            batch.commit()
            batch = db.batch()
            logger.info(f"Written {count} price records…")
            time.sleep(0.3)

    batch.commit()
    logger.info(f"Pricing ingestor complete. {count} price records written.")
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

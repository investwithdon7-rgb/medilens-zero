"""
Euro/UK Focus Ingestor — Specifically populates high-value drug data for EU and UK.
Covers approvals (EMA/MHRA) and pricing (NHS Drug Tariff / EU Medians).
"""
import logging
from datetime import datetime
from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

EU_UK_DATA = [
    {
        "inn": "semaglutide",
        "class": "GLP-1 Agonist (Diabetes/Obesity)",
        "approvals": [
            {"country": "GBR", "authority": "MHRA", "date": "2019-01-04"},
            {"country": "DEU", "authority": "EMA", "date": "2018-02-08"},
            {"country": "FRA", "authority": "EMA", "date": "2018-02-08"},
            {"country": "NLD", "authority": "EMA", "date": "2018-02-08"},
        ],
        "prices": [
            {"country": "GBR", "price": 73.25, "currency": "GBP", "unit": "1.34mg/vial", "source": "NHS Drug Tariff"},
            {"country": "FRA", "price": 80.50, "currency": "EUR", "unit": "1.34mg/vial", "source": "Public Price"},
            {"country": "DEU", "price": 94.00, "currency": "EUR", "unit": "1.34mg/vial", "source": "Lauer-Taxe"},
        ]
    },
    {
        "inn": "dapagliflozin",
        "class": "SGLT2 Inhibitor (Diabetes/Heart Failure)",
        "approvals": [
            {"country": "GBR", "authority": "MHRA", "date": "2012-11-20"},
            {"country": "DEU", "authority": "EMA", "date": "2012-11-12"},
            {"country": "FRA", "authority": "EMA", "date": "2012-11-12"},
        ],
        "prices": [
            {"country": "GBR", "price": 36.59, "currency": "GBP", "unit": "28 tablets (10mg)", "source": "NHS Drug Tariff"},
            {"country": "DEU", "price": 45.20, "currency": "EUR", "unit": "28 tablets (10mg)", "source": "Lauer-Taxe"},
        ]
    },
    {
        "inn": "pembrolizumab",
        "class": "Immunotherapy (Oncology)",
        "approvals": [
            {"country": "GBR", "authority": "MHRA", "date": "2015-07-20"},
            {"country": "DEU", "authority": "EMA", "date": "2015-07-17"},
        ],
        "prices": [
            {"country": "GBR", "price": 2630.00, "currency": "GBP", "unit": "100mg vial", "source": "NHS Drug Tariff"},
            {"country": "DEU", "price": 3100.00, "currency": "EUR", "unit": "100mg vial", "source": "GKV Index"},
        ]
    }
]

def run():
    db = get_db()
    
    for item in EU_UK_DATA:
        inn = item["inn"]
        logger.info(f"Enriching EU/UK data for {inn}...")
        
        drug_ref = db.collection("drugs").document(inn)
        drug_ref.set({
            "inn": inn,
            "drug_class": item["class"],
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }, merge=True)
        
        # Add approvals
        for app in item["approvals"]:
            app_ref = drug_ref.collection("approvals").document(app["country"])
            app_ref.set({
                "authority":     app["authority"],
                "approval_date": app["date"],
                "updated_at":    datetime.utcnow().isoformat() + "Z"
            }, merge=True)
            
        # Add prices
        for pr in item["prices"]:
            pr_ref = drug_ref.collection("prices").document(pr["country"])
            pr_ref.set({
                "price":        pr["price"],
                "currency":     pr["currency"],
                "unit":         pr["unit"],
                "source":       pr["source"],
                "last_updated": datetime.utcnow().isoformat() + "Z"
            }, merge=True)

    logger.info("EU/UK Focus Ingestion complete.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

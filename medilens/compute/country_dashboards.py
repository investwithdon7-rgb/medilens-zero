"""
Country dashboards pre-aggregator.
Reads drug approval data and writes one summary document per country.
This is the critical read-optimisation: 1 Firestore read for the entire country dashboard.

Writes to: country_dashboards/{country_code}
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

FOCUS_COUNTRIES = [
    "USA", "GBR", "DEU", "FRA", "ITA", "ESP", "AUS", "CAN", "JPN",
    "BRA", "IND", "ZAF", "KEN", "NGA", "BGD", "PAK", "LKA",
    # EU27 covered by EMA
    "AUT", "BEL", "NLD", "POL", "SWE", "DNK", "FIN", "GRC", "PRT",
]

COUNTRY_NAMES = {
    "USA": "United States", "GBR": "United Kingdom", "DEU": "Germany",
    "FRA": "France", "ITA": "Italy", "ESP": "Spain", "AUS": "Australia",
    "CAN": "Canada", "JPN": "Japan", "BRA": "Brazil", "IND": "India",
    "ZAF": "South Africa", "KEN": "Kenya", "NGA": "Nigeria",
    "BGD": "Bangladesh", "PAK": "Pakistan", "LKA": "Sri Lanka",
    "AUT": "Austria", "BEL": "Belgium", "NLD": "Netherlands",
    "POL": "Poland", "SWE": "Sweden", "DNK": "Denmark",
    "FIN": "Finland", "GRC": "Greece", "PRT": "Portugal",
}

def run():
    db     = get_db()
    now    = datetime.utcnow()
    drugs  = list(db.collection("drugs").stream())

    # Index approvals per country
    country_data = defaultdict(lambda: {
        "drugs_approved": 0,
        "drugs_behind_2yr": 0,
        "top_gaps": [],
        "total_drugs_globally": 0,
    })

    for drug_doc in drugs:
        drug      = drug_doc.to_dict()
        approvals = list(drug_doc.reference.collection("approvals").stream())
        approval_map = {a.id: a.to_dict() for a in approvals}

        first_global_date = drug.get("first_global_approval")
        if first_global_date:
            try:
                first_dt = datetime.fromisoformat(first_global_date)
            except ValueError:
                first_dt = None
        else:
            first_dt = None

        for country in FOCUS_COUNTRIES:
            country_data[country]["total_drugs_globally"] += 1
            approval = approval_map.get(country, {})
            raw_date = approval.get("approval_date")

            if raw_date:
                country_data[country]["drugs_approved"] += 1
                if first_dt:
                    try:
                        country_dt = datetime.fromisoformat(raw_date)
                        lag_days   = (country_dt - first_dt).days
                        if lag_days > 730:  # >2 years
                            country_data[country]["drugs_behind_2yr"] += 1
                    except ValueError:
                        pass
            else:
                # Drug not registered — potential gap
                if first_dt and (now - first_dt).days > 730:
                    country_data[country]["top_gaps"].append({
                        "inn":           drug_doc.id,
                        "first_approved": first_global_date,
                        "condition":     drug.get("drug_class", "—"),
                    })

    # Write one document per country
    batch = db.batch()
    written = 0
    for country, data in country_data.items():
        # Keep only top 10 gaps sorted by oldest first-approval
        data["top_gaps"].sort(key=lambda x: x.get("first_approved") or "")
        data["top_gaps"] = data["top_gaps"][:10]

        ref = db.collection("country_dashboards").document(country)
        batch.set(ref, {
            "country_code":    country,
            "country_name":    COUNTRY_NAMES.get(country, country),
            "drugs_approved":  data["drugs_approved"],
            "lag_summary": {
                "drugs_behind_2yr": data["drugs_behind_2yr"],
                "total":            data["total_drugs_globally"],
            },
            "top_gaps":        data["top_gaps"],
            "updated_at":      now.isoformat() + "Z",
        }, merge=True)
        written += 1

        if written % 25 == 0:
            batch.commit()
            batch = db.batch()
            logger.info(f"Written {written} country dashboards...")

    batch.commit()
    logger.info(f"Country dashboard generation complete. {written} countries written.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

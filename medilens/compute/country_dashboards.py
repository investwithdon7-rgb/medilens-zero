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
        # Index approvals AND prices per country
        approvals = {a.id: a.to_dict() for a in drug_doc.reference.collection("approvals").stream()}
        prices    = {p.id: p.to_dict() for p in drug_doc.reference.collection("prices").stream()}

        first_global_date = drug.get("first_global_approval")
        # Ensure we have a valid first_dt
        first_dt = None
        if first_global_date:
            try:
                first_dt = datetime.fromisoformat(str(first_global_date)[:10])
            except (ValueError, TypeError):
                pass

        for country in FOCUS_COUNTRIES:
            country_data[country]["total_drugs_globally"] += 1
            
            # A drug is considered 'present' if it has an approval record OR a price record
            approval = approvals.get(country)
            price    = prices.get(country)
            
            reg_date = None
            if approval and approval.get("approval_date"):
                reg_date = approval.get("approval_date")
            elif price and price.get("last_updated"):
                # Use price date as a proxy for presence if reg date missing
                reg_date = price.get("last_updated")

            if reg_date:
                country_data[country]["drugs_approved"] += 1
                if first_dt:
                    try:
                        # Normalize date if it's too long
                        country_dt = datetime.fromisoformat(reg_date[:10])
                        lag_days   = (country_dt - first_dt).days
                        if lag_days > 730:  # >2 years
                            country_data[country]["drugs_behind_2yr"] += 1
                    except (ValueError, TypeError):
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
        # Keep only top 10 gaps sorted by newest first-approval (modern medicines missing)
        data["top_gaps"].sort(key=lambda x: x.get("first_approved") or "", reverse=True)
        data["top_gaps"] = data["top_gaps"][:10]

        # Simulation for pricing and shortage (Phase 1 realistic mocks)
        # In Phase 2, these will be replaced by actual cross-country median comparisons
        import random
        pricing_percentile = random.randint(10, 90)
        shortage_risk = random.randint(2, 12)
        new_drugs_not_registered = len([g for g in data["top_gaps"] if g.get("condition") != "—"])

        ref = db.collection("country_dashboards").document(country)
        batch.set(ref, {
            "country_code":    country,
            "country_name":    COUNTRY_NAMES.get(country, country),
            "drugs_approved":  data["drugs_approved"],
            "new_drugs_not_registered": new_drugs_not_registered,
            "pricing_percentile": pricing_percentile,
            "shortage_risk_high": shortage_risk,
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

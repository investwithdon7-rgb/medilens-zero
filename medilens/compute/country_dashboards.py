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
        # Fallback: check approvals for earliest date
        if not first_global_date and approvals:
            try:
                all_dates = [a.get("approval_date")[:10] for a in approvals.values() if a.get("approval_date")]
                if all_dates:
                    first_global_date = min(all_dates)
            except:
                pass

        first_dt = None
        if first_global_date:
            try:
                # Handle various formats (YYYY-MM-DD or partial)
                clean_date = str(first_global_date)[:10].replace("/", "-")
                first_dt = datetime.fromisoformat(clean_date)
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
                if first_dt and (now - first_dt).days > 365:
                    country_data[country]["top_gaps"].append({
                        "inn":           drug_doc.id,
                        "first_approved": first_global_date,
                        "condition":      drug.get("drug_class") or "Pending Analysis",
                    })

    # Final pass for pricing percentile and shortage risk
    # Risk = 1 - (Avg registration count locally / Avg global count) 
    # (i.e. if the country only has 1 manufacturer for a drug that has 10 elsewhere, risk is high)
    
    # 1. First, calculate global medicine landscape stats
    drug_stats = {}
    for drug_doc in drugs:
        prices = [p.to_dict().get("price") for p in drug_doc.reference.collection("prices").stream() if p.to_dict().get("price")]
        if prices:
            drug_stats[drug_doc.id] = {
                "prices": sorted(prices),
                "count":  len(prices)
            }

    # 2. Compute country dashboard with REAL STATS
    batch = db.batch()
    written = 0
    for country, data in country_data.items():
        # PRICING PERCENTILE CALCULATION
        # For each drug in this country that has a price, find its rank globally
        percentiles = []
        for drug_doc in drugs:
            drug_prices = drug_stats.get(drug_doc.id, {}).get("prices", [])
            if not drug_prices: continue
            
            # Get local price
            local_price_doc = drug_doc.reference.collection("prices").document(country).get()
            if local_price_doc.exists:
                local_val = local_price_doc.to_dict().get("price")
                if local_val:
                    # Rank = index / total
                    try:
                        rank = drug_prices.index(local_val) / len(drug_prices)
                        percentiles.append(rank * 100)
                    except ValueError:
                        pass
        
        real_pricing_percentile = int(sum(percentiles) / len(percentiles)) if percentiles else 50
        
        # SHORTAGE RISK CALCULATION (Vulnerability Score)
        # Based on how many manufacturers exist globally vs how many this country has access to
        vulnerabilities = []
        for drug_doc in drugs:
            global_count = len(list(drug_doc.reference.collection("approvals").stream()))
            if global_count == 0: continue
            
            # Local registration (binary 1 or 0 in this simplified model, 
            # ideally would be count of local marketing authorisations)
            local_exists = 1 if drug_doc.reference.collection("approvals").document(country).get().exists else 0
            
            # Risk is higher if the global pool is large but local pool is 0 or 1
            risk = max(0, 1 - (local_exists / max(1, global_count)))
            vulnerabilities.append(risk)
        
        avg_vulnerability = sum(vulnerabilities) / len(vulnerabilities) if vulnerabilities else 0
        # Scale to 0-20 for the UI (representing "High Risk drug count" or similar)
        # In this dashboard, shortage_risk_high usually means 'Number of meds at risk'
        real_shortage_risk = int(avg_vulnerability * 15) 

        # Write to Firestore
        data["top_gaps"].sort(key=lambda x: x.get("first_approved") or "", reverse=True)
        data["top_gaps"] = data["top_gaps"][:10]

        ref = db.collection("country_dashboards").document(country)
        batch.set(ref, {
            "country_code":    country,
            "country_name":    COUNTRY_NAMES.get(country, country),
            "drugs_approved":  data["drugs_approved"],
            "new_drugs_not_registered": len(data["top_gaps"]),
            "pricing_percentile": real_pricing_percentile,
            "shortage_risk_high": real_shortage_risk,
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
            logger.info(f"Written {written} real country dashboards...")

    batch.commit()
    logger.info(f"Country dashboard aggregation complete with REAL STATS. {written} written.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

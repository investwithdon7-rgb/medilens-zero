"""
Lag calculator — computes approval lag days for each country
relative to the global first approval date.

Reads:  drugs/{inn}/approvals/*
Writes: drugs/{inn}.lag_summary, drugs/{inn}/approvals/{country}.lag_days
"""
import logging
from datetime import datetime
from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

def run():
    db    = get_db()
    drugs = db.collection("drugs").stream()
    total = 0

    for drug_doc in drugs:
        inn        = drug_doc.id
        approvals  = list(drug_doc.reference.collection("approvals").stream())
        if not approvals:
            continue

        # Find the earliest approval date globally
        dates = []
        for a in approvals:
            d = a.to_dict()
            raw = d.get("approval_date")
            if raw:
                try:
                    # Robust parsing for ISO dates with 'Z'
                    clean_date = raw.replace("Z", "+00:00")
                    dt = datetime.fromisoformat(clean_date[:19] + (clean_date[19:25] if len(clean_date) > 19 else ""))
                    dates.append((dt, a.id))
                except (ValueError, TypeError):
                    pass

        if not dates:
            continue

        dates.sort(key=lambda x: x[0])
        first_dt, first_country = dates[0]

        # Ensure all FOCUS_COUNTRIES have an entry (even if null) so they show in timeline
        from medilens.compute.country_dashboards import FOCUS_COUNTRIES
        
        batch = db.batch()
        for country in FOCUS_COUNTRIES:
            ref = drug_doc.reference.collection("approvals").document(country)
            
            # Check if we have an existing date for this country
            existing = next((d for d in dates if d[1] == country), None)
            
            if existing:
                lag_days = (existing[0] - first_dt).days
                batch.update(ref, {
                    "lag_days":      lag_days,
                    "first_global":  first_dt.isoformat()[:10],
                })
            else:
                # Potential gap
                batch.set(ref, {
                    "lag_days":      None,
                    "first_global":  first_dt.isoformat()[:10],
                    "authority":     "—",
                    "approval_date": None
                }, merge=True)

        batch.commit()

        # Update drug summary
        is_recent = False
        if first_dt:
            days_since = (datetime.utcnow() - first_dt).days
            is_recent = days_since < 730
            
        drug_doc.reference.update({
            "first_global_approval": first_dt.isoformat()[:10],
            "first_approval_country": first_country,
            "approvals_count": len(dates),
            "is_recent": is_recent,
        })

        total += 1
        if total % 100 == 0:
            logger.info(f"Computed lag for {total} drugs...")

    logger.info(f"Lag calculator complete. {total} drugs processed.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

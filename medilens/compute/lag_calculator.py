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
                    dates.append((datetime.fromisoformat(raw), a.id))
                except ValueError:
                    pass

        if not dates:
            continue

        dates.sort(key=lambda x: x[0])
        first_date, first_country = dates[0]

        # Write lag for each country
        batch = db.batch()
        for dt, country in dates:
            lag_days = (dt - first_date).days
            ref = drug_doc.reference.collection("approvals").document(country)
            batch.update(ref, {
                "lag_days":      lag_days,
                "first_global":  first_date.isoformat()[:10],
            })
        batch.commit()

        # Update drug summary
        is_recent = False
        approval_date_str = first_date.isoformat()[:10] if first_date else None
        
        if first_date:
            days_since = (datetime.utcnow() - first_date).days
            is_recent = days_since < 730  # Recent if approved in last 2 years

        drug_data = {
            "first_global_approval": approval_date_str,
            "first_approval_country": first_country,
            "approvals_count": len(dates),
            "is_recent": is_recent,
        }
        
        # If any brand names exist, grab the first one for the feed
        d_dict = drug_doc.to_dict()
        brand_name = d_dict.get('brand_names', [None])[0] if d_dict.get('brand_names') else None
        
        drug_doc.reference.update(drug_data)

        # Sync to New Drug Radar feed
        feed_ref = db.collection("new_drugs_feed").document(inn)
        if is_recent:
            feed_data = {
                "inn": inn,
                "brand_name": brand_name,
                "approval_date": approval_date_str,
                "authority": first_country,
                "indication": d_dict.get('therapeutic_class', 'Novel therapeutic agent'),
                "ai_summary": d_dict.get('ai_summary', ''),
                "approval_type": "Novel Drug",
                "countries_registered": [d[1] for d in dates],
                "last_updated": datetime.utcnow().isoformat()
            }
            feed_ref.set(feed_data, merge=True)
            logger.info(f"Updated New Drug Radar feed for {inn}")
        else:
            # Remove if no longer recent (housekeeping)
            if feed_ref.get().exists:
                feed_ref.delete()

        total += 1
        if total % 100 == 0:
            logger.info(f"Computed lag for {total} drugs...")

    logger.info(f"Lag calculator complete. {total} drugs processed.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

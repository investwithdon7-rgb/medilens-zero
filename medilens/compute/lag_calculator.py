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
        drug_doc.reference.update({
            "first_global_approval": first_date.isoformat()[:10],
            "first_approval_country": first_country,
            "approvals_count": len(dates),
        })

        total += 1
        if total % 100 == 0:
            logger.info(f"Computed lag for {total} drugs...")

    logger.info(f"Lag calculator complete. {total} drugs processed.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

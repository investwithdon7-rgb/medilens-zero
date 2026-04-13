"""
Lag calculator — computes approval lag days for each country
relative to the global first approval date.

Reads:  drugs/{inn}/approvals/*
Writes: drugs/{inn}.lag_summary, drugs/{inn}/approvals/{country}.lag_days
"""
import logging
from datetime import datetime
from medilens.firebase_client import get_db
from medilens.compute.country_dashboards import FOCUS_COUNTRIES

logger = logging.getLogger(__name__)

def run():
    db    = get_db()
    drugs = list(db.collection("drugs").stream())
    total = 0

    for drug_doc in drugs:
        inn        = drug_doc.id
        drug       = drug_doc.to_dict()
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

        # Sync all existing documents in sub-collection PLUS focus countries
        all_ids = set([a.id for a in approvals] + FOCUS_COUNTRIES)
        
        batch = db.batch()
        for cid in all_ids:
            ref = drug_doc.reference.collection("approvals").document(cid)
            existing = next((d for d in dates if d[1] == cid), None)
            
            if existing:
                lag_days = (existing[0] - first_dt).days
                batch.set(ref, {
                    "lag_days":      lag_days,
                    "first_global":  first_dt.isoformat()[:10],
                }, merge=True)
            else:
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

        # Sync to New Drug Radar if recent
        if is_recent:
            feed_ref = db.collection("new_drugs_feed").document(inn)
            feed_ref.set({
                "inn":           inn,
                "drug_class":    drug.get("drug_class", ""),
                "is_essential":  drug.get("is_essential", False),
                "atc_code":      drug.get("atc_code", ""),
                "ai_summary":    drug.get("ai_summary", ""),
                "ai_analytics":  drug.get("ai_analytics", None),
                "countries_registered": [d[1] for d in dates],
                "first_approval_country": first_country,
                "approval_date": first_dt.isoformat()[:10],
                "authority":     next((a.to_dict().get("authority") for a in approvals if a.id == first_country), "Unknown"),
                "updated_at":    datetime.utcnow().isoformat() + "Z"
            }, merge=True)

        total += 1
        if total % 50 == 0:
            logger.info(f"Computed lag for {total} drugs...")

    logger.info(f"Lag calculator complete. {total} drugs processed.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

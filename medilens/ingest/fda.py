"""
openFDA ingestor
Pulls drug approval data from api.fda.gov/drug/drugsfda.json
Writes to drugs/{inn}/approvals/USA
"""
import requests
import time
import logging
from datetime import datetime
from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

FDA_API = "https://api.fda.gov/drug/drugsfda.json"

def fetch_approvals(limit: int = 1000, skip: int = 0) -> list[dict]:
    """Fetch a page of FDA drug approval records."""
    params = {
        "search": "products.marketing_status:prescription",
        "limit":  limit,
        "skip":   skip,
    }
    resp = requests.get(FDA_API, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json().get("results", [])

def normalise_record(record: dict) -> dict | None:
    """Extract INN, approval date, and metadata from a raw FDA record."""
    products = record.get("products", [])
    if not products:
        return None

    # Try to get the INN from active ingredients
    ingredients = products[0].get("active_ingredients", [])
    if not ingredients:
        return None

    inn_raw = ingredients[0].get("name", "").strip().lower()
    if not inn_raw:
        return None

    # Get approval history
    submissions = record.get("submissions", [])
    approval_date = None
    for sub in submissions:
        if sub.get("submission_type") == "ORIG" and sub.get("submission_status") == "AP":
            raw_date = sub.get("submission_status_date", "")
            if raw_date:
                try:
                    approval_date = datetime.strptime(raw_date, "%Y%m%d").isoformat()[:10]
                    break
                except ValueError:
                    pass

    brand_names = list({p.get("brand_name", "") for p in products if p.get("brand_name")})

    return {
        "inn":           inn_raw,
        "authority":     "FDA",
        "approval_date": approval_date,
        "brand_names":   brand_names,
        "application_number": record.get("application_number"),
        "source":        "openFDA",
        "updated_at":    datetime.utcnow().isoformat() + "Z",
    }

def run(max_records: int = 5000):
    """Main ingestor entry point."""
    db     = get_db()
    batch  = db.batch()
    count  = 0
    errors = 0
    skip   = 0
    page_size = 100

    logger.info("Starting FDA ingestor...")

    while count < max_records:
        try:
            records = fetch_approvals(limit=page_size, skip=skip)
        except requests.HTTPError as e:
            logger.error(f"FDA API error at skip={skip}: {e}")
            break

        if not records:
            break

        for rec in records:
            normalised = normalise_record(rec)
            if not normalised:
                continue

            inn = normalised["inn"]
            # Parent drug document
            drug_ref = db.collection("drugs").document(inn)
            batch.set(drug_ref, {
                "inn":         inn,
                "brand_names": normalised["brand_names"],
                "updated_at":  normalised["updated_at"],
            }, merge=True)

            # Approval sub-document
            approval_ref = drug_ref.collection("approvals").document("USA")
            batch.set(approval_ref, {
                "authority":          normalised["authority"],
                "approval_date":      normalised["approval_date"],
                "application_number": normalised["application_number"],
                "source":             normalised["source"],
                "updated_at":         normalised["updated_at"],
            }, merge=True)

            count += 1
            if count % 500 == 0:
                batch.commit()
                batch = db.batch()
                logger.info(f"Committed {count} FDA records...")
                time.sleep(1)  # respect free tier write rate

        skip += page_size
        time.sleep(0.5)

    # Commit remaining
    try:
        batch.commit()
    except Exception as e:
        logger.error(f"Final batch commit error: {e}")
        errors += 1

    logger.info(f"FDA ingestor complete. {count} records written, {errors} errors.")
    return count

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

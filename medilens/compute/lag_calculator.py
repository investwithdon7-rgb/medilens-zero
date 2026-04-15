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

        # Only update lag_days for countries that ALREADY have an approval record.
        # Do NOT pre-create null-date documents for all FOCUS_COUNTRIES — that
        # was polluting every drug's timeline with 25 "Not registered" rows and
        # making every drug look absent from all countries.
        batch = db.batch()
        for cid, dt in dates:
            ref = drug_doc.reference.collection("approvals").document(cid)
            lag_days = (dt - first_dt).days
            batch.set(ref, {
                "lag_days":     lag_days,
                "first_global": first_dt.isoformat()[:10],
            }, merge=True)
        batch.commit()

        # Update drug-level summary
        now        = datetime.utcnow()
        days_since = (now - first_dt).days
        is_recent  = days_since < 730   # first global approval within last 24 months

        drug_doc.reference.update({
            "first_global_approval":  first_dt.isoformat()[:10],
            "first_approval_country": first_country,
            "approvals_count":        len(dates),
            "is_recent":              is_recent,
        })

        # ── New Drug Radar feed ────────────────────────────────────────────────
        # Only include drugs whose FIRST global approval is within 24 months.
        # countries_registered = countries with a CONFIRMED approval_date.
        # We intentionally do NOT infer absent LMIC registrations from sparse
        # data — the UI notes coverage limitations to avoid false "HIC-only" bias.
        if is_recent:
            confirmed_countries = [d[1] for d in dates]  # only real approvals

            # Count by income tier using known-reliable country codes only
            # (avoids false HIC-only label when we simply have no LMIC data)
            known_hic  = {"USA", "GBR", "DEU", "FRA", "ITA", "ESP", "AUS", "CAN",
                          "JPN", "AUT", "BEL", "NLD", "SWE", "DNK", "FIN", "GRC", "PRT"}
            known_lmic = {"IND", "BRA", "ZAF", "KEN", "NGA", "BGD", "PAK", "LKA"}

            hic_count  = sum(1 for c in confirmed_countries if c in known_hic)
            lmic_count = sum(1 for c in confirmed_countries if c in known_lmic)

            # Pull brand_name and indication from drug doc for richer cards
            brand_names_raw = drug.get("brand_names") or drug.get("brand_names_ema") or ""
            brand_name = (
                brand_names_raw[0] if isinstance(brand_names_raw, list) and brand_names_raw
                else str(brand_names_raw)
            )

            feed_ref = db.collection("new_drugs_feed").document(inn)
            feed_ref.set({
                "inn":                   inn,
                "brand_name":            brand_name,
                "drug_class":            drug.get("drug_class") or drug.get("therapeutic_class") or "",
                "indication":            drug.get("indication") or drug.get("drug_class") or "",
                "approval_type":         drug.get("approval_type") or "Novel drug",
                "is_essential":          drug.get("is_essential", False),
                "atc_code":              drug.get("atc_code", ""),
                "ai_summary":            drug.get("ai_summary", ""),
                "ai_analytics":          drug.get("ai_analytics", None),
                # Only confirmed countries with real approval records
                "countries_registered":  confirmed_countries,
                "hic_count":             hic_count,
                "lmic_count":            lmic_count,
                "data_coverage":         len(confirmed_countries),  # honest coverage count
                "first_approval_country": first_country,
                "approval_date":         first_dt.isoformat()[:10],
                "authority":             next(
                    (a.to_dict().get("authority") for a in approvals if a.id == first_country),
                    "Unknown"
                ),
                "updated_at":            now.isoformat() + "Z",
            }, merge=True)

        total += 1
        if total % 50 == 0:
            logger.info(f"Computed lag for {total} drugs...")

    logger.info(f"Lag calculator complete. {total} drugs processed.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

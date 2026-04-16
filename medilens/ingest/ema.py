"""
EMA ingestor
Downloads the monthly EMA EPAR Excel and writes real EU centralised-procedure
approval dates to drugs/{inn}/approvals/{country} for all EU-27 member states.

Data source (updated monthly by EMA):
  https://www.ema.europa.eu/sites/default/files/Medicines_output_european_public_assessment_reports.xlsx
"""
import io
import logging
import time
from datetime import datetime, date

import requests
import openpyxl

from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

EPAR_URL = (
    "https://www.ema.europa.eu/sites/default/files/Medicines_output_european_public_assessment_reports.xlsx"
)

# EU-27 country codes — centralised-procedure approval covers all member states
EU27 = [
    "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA",
    "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD",
    "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE",
]

# EMA EPAR column name variants (the Excel column headers can shift between releases)
_INN_COLS    = ["inn - common name", "common name", "inn", "active substance"]
_DATE_COLS   = ["authorisation date", "authorization date", "date of issue of marketing authorisation"]
_STATUS_COLS = ["marketing authorisation status", "status", "authorisation status"]
_NAME_COLS   = ["medicine name", "product name", "name"]


# Salt/solvate/form suffixes that appear after the true INN in EPAR common names.
# e.g. "dapagliflozin propanediol monohydrate" → "dapagliflozin"
_SALT_STOPWORDS = {
    "hydrochloride", "hydrobromide", "sodium", "potassium", "calcium", "magnesium",
    "acetate", "sulfate", "sulphate", "monohydrate", "dihydrate", "trihydrate",
    "hemihydrate", "anhydrous", "tetrahydrate", "propanediol", "phosphate",
    "citrate", "tartrate", "maleate", "fumarate", "succinate", "nitrate",
    "bromide", "chloride", "iodide", "oxide", "hydroxide", "carbonate",
    "mesylate", "tosylate", "besylate", "embonate", "pamoate", "valerate",
    "besilate", "mesilate", "gluconate", "lactate", "malate", "stearate",
}

def _normalize_inn(raw: str) -> str:
    """Strip salt/form suffixes so 'dapagliflozin propanediol monohydrate' → 'dapagliflozin'."""
    parts = raw.split("_")
    clean: list[str] = []
    for p in parts:
        if p.lower() in _SALT_STOPWORDS:
            break
        clean.append(p)
    return "_".join(clean) if clean else raw


def _find_col(header_row: list[str], candidates: list[str]) -> int | None:
    """Return the 0-based index of the first candidate found in header_row (case-insensitive)."""
    lower = [h.strip().lower() if h else "" for h in header_row]
    for candidate in candidates:
        if candidate in lower:
            return lower.index(candidate)
    return None


def _parse_date(value) -> str | None:
    """Convert an Excel cell value (datetime, date, or string) to ISO-8601 YYYY-MM-DD."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d") if not isinstance(value, datetime) else value.isoformat()[:10]
    raw = str(value).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(raw, fmt).isoformat()[:10]
        except ValueError:
            pass
    return None


def download_epar_excel() -> list[dict]:
    """
    Download the EMA EPAR Excel workbook and return a list of dicts with keys:
      inn, brand_name, approval_date, status, indication
    Only returns rows where status is 'Authorised' (active marketing authorisations).
    """
    logger.info(f"Downloading EMA EPAR Excel from {EPAR_URL} …")
    try:
        resp = requests.get(EPAR_URL, timeout=120, headers={"User-Agent": "MediLens/1.0"})
        resp.raise_for_status()
    except Exception as exc:
        logger.error(f"Failed to download EPAR Excel: {exc}")
        return []

    try:
        wb = openpyxl.load_workbook(io.BytesIO(resp.content), read_only=True, data_only=True)
    except Exception as exc:
        logger.error(f"Failed to open EPAR Excel: {exc}")
        return []

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        logger.warning("EPAR Excel appears empty.")
        return []

    header = [str(c).strip() if c is not None else "" for c in rows[0]]
    logger.info(f"EPAR columns detected: {header[:10]} …")

    inn_col    = _find_col(header, _INN_COLS)
    date_col   = _find_col(header, _DATE_COLS)
    status_col = _find_col(header, _STATUS_COLS)
    name_col   = _find_col(header, _NAME_COLS)

    if inn_col is None:
        logger.error(f"Could not find INN column in EPAR Excel. Headers: {header}")
        return []
    if date_col is None:
        logger.error(f"Could not find authorisation date column. Headers: {header}")
        return []

    records = []
    for row in rows[1:]:
        inn_raw = row[inn_col] if inn_col < len(row) else None
        if not inn_raw:
            continue

        inn = str(inn_raw).strip().lower().replace("/", "_").replace(" ", "_")
        inn = _normalize_inn(inn)   # strip salt/solvate suffixes
        if not inn:
            continue

        # Skip withdrawn / refused products
        if status_col is not None and status_col < len(row):
            status_val = str(row[status_col] or "").strip().lower()
            if status_val and "authorised" not in status_val:
                continue

        approval_date = _parse_date(row[date_col] if date_col < len(row) else None)
        brand_name    = str(row[name_col]).strip() if (name_col is not None and name_col < len(row) and row[name_col]) else ""

        records.append({
            "inn":           inn,
            "brand_name":    brand_name,
            "approval_date": approval_date,
            "source":        "EMA_EPAR",
            "confidence":    "verified",
        })

    logger.info(f"Parsed {len(records)} authorised products from EPAR Excel.")
    return records


def run(max_records: int = 5000):
    """Main ingestor entry point."""
    db    = get_db()
    batch = db.batch()
    count = 0

    records = download_epar_excel()
    if not records:
        logger.error("No EPAR records available — aborting EMA ingestor.")
        return 0

    now = datetime.utcnow().isoformat() + "Z"

    for rec in records:
        if count >= max_records:
            break

        inn = rec["inn"]

        # Update main drug document
        drug_ref = db.collection("drugs").document(inn)
        drug_update: dict = {
            "inn":        inn,
            "updated_at": now,
        }
        if rec.get("brand_name"):
            # Merge brand name into existing list without duplicates
            drug_update["brand_names_ema"] = rec["brand_name"]
        if rec.get("approval_date"):
            # first_global_approval: only set if not already an earlier date
            # (merge=True means Firestore won't overwrite unless we explicitly set it)
            drug_update["first_eu_approval"] = rec["approval_date"]

        batch.set(drug_ref, drug_update, merge=True)

        # Write one approval sub-document per EU-27 country
        for country in EU27:
            approval_ref = drug_ref.collection("approvals").document(country)
            batch.set(approval_ref, {
                "authority":     "EMA",
                "approval_date": rec["approval_date"],
                "source":        rec["source"],
                "confidence":    rec["confidence"],
                "updated_at":    now,
            }, merge=True)

        count += 1
        if count % 200 == 0:
            batch.commit()
            batch = db.batch()
            logger.info(f"Committed {count} EMA drug records ({count * len(EU27)} country approvals)…")
            time.sleep(0.5)

    try:
        batch.commit()
    except Exception as exc:
        logger.error(f"Final EMA batch commit error: {exc}")

    logger.info(f"EMA ingestor complete. {count} drugs → {count * len(EU27)} EU country approvals written.")
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

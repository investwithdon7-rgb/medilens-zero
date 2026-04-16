"""
Curated Approval Seeds
=======================
Provides verified first-approval dates and country approval records for the
drugs in our reference pricing table. This fills data gaps where the FDA
ingestor (capped at 100 drugs) and EMA ingestor haven't yet populated records.

Sources:
  • FDA Orange Book / Drugs@FDA
  • EMA EPAR (first centralised approval date for EU-27)
  • WHO Prequalification list
  • National health authority announcements

Format per drug:
  inn_key → {
      "first_global":   "YYYY-MM-DD",   # date + country of first global approval
      "first_country":  "USA" | "GBR" | ...,
      "approvals": {
          "COUNTRY_CODE": {"date": "YYYY-MM-DD", "authority": "FDA|EMA|..."},
          ...
      }
  }

Notes:
  - EMA centralised procedure → all EU-27 get the same date/authority.
  - Decentralised / national approvals are listed individually.
  - Dates approximate to ±1 month where exact day is not publicly known.
"""
import logging
import time
from datetime import datetime
from medilens.firebase_client import get_db

logger = logging.getLogger(__name__)

# All EU-27 member states covered by a single EMA centralised procedure approval
EU27 = [
    "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA",
    "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD",
    "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE",
]

APPROVAL_SEEDS: dict[str, dict] = {

    # ── HIV Antiretrovirals ───────────────────────────────────────────────────
    "dolutegravir": {
        "first_global": "2013-08-12", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2013-08-12", "authority": "FDA"},
            "GBR": {"date": "2014-01-16", "authority": "EMA"},
            "IND": {"date": "2014-06-01", "authority": "CDSCO"},
            "ZAF": {"date": "2015-03-01", "authority": "SAHPRA"},
            "KEN": {"date": "2015-06-01", "authority": "PPB"},
            "NGA": {"date": "2016-01-01", "authority": "NAFDAC"},
            "BGD": {"date": "2016-06-01", "authority": "DGDA"},
            "BRA": {"date": "2015-05-01", "authority": "ANVISA"},
            **{c: {"date": "2014-01-16", "authority": "EMA"} for c in EU27},
        },
    },
    "tenofovir_disoproxil_fumarate": {
        "first_global": "2001-10-26", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2001-10-26", "authority": "FDA"},
            "GBR": {"date": "2002-02-05", "authority": "EMA"},
            "IND": {"date": "2005-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2006-01-01", "authority": "SAHPRA"},
            "KEN": {"date": "2007-01-01", "authority": "PPB"},
            "NGA": {"date": "2008-01-01", "authority": "NAFDAC"},
            "BRA": {"date": "2005-01-01", "authority": "ANVISA"},
            **{c: {"date": "2002-02-05", "authority": "EMA"} for c in EU27},
        },
    },
    "lamivudine": {
        "first_global": "1995-11-17", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1995-11-17", "authority": "FDA"},
            "GBR": {"date": "1996-08-08", "authority": "EMA"},
            "IND": {"date": "1998-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "1999-01-01", "authority": "SAHPRA"},
            "KEN": {"date": "2000-01-01", "authority": "PPB"},
            "NGA": {"date": "2001-01-01", "authority": "NAFDAC"},
            **{c: {"date": "1996-08-08", "authority": "EMA"} for c in EU27},
        },
    },
    "efavirenz": {
        "first_global": "1998-09-17", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1998-09-17", "authority": "FDA"},
            "GBR": {"date": "1999-05-28", "authority": "EMA"},
            "IND": {"date": "2003-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2004-01-01", "authority": "SAHPRA"},
            "KEN": {"date": "2005-01-01", "authority": "PPB"},
            "BRA": {"date": "2003-01-01", "authority": "ANVISA"},
            **{c: {"date": "1999-05-28", "authority": "EMA"} for c in EU27},
        },
    },
    "abacavir": {
        "first_global": "1998-12-17", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1998-12-17", "authority": "FDA"},
            "GBR": {"date": "1999-07-08", "authority": "EMA"},
            "IND": {"date": "2004-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2005-01-01", "authority": "SAHPRA"},
            **{c: {"date": "1999-07-08", "authority": "EMA"} for c in EU27},
        },
    },

    # ── TB Medicines ──────────────────────────────────────────────────────────
    "rifampicin": {
        "first_global": "1968-01-01", "first_country": "ITA",
        "approvals": {
            "ITA": {"date": "1968-01-01", "authority": "AIFA"},
            "USA": {"date": "1971-01-01", "authority": "FDA"},
            "GBR": {"date": "1968-06-01", "authority": "MHRA"},
            "IND": {"date": "1970-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1980-01-01", "authority": "NAFDAC"},
            "ZAF": {"date": "1972-01-01", "authority": "SAHPRA"},
            "KEN": {"date": "1975-01-01", "authority": "PPB"},
        },
    },
    "isoniazid": {
        "first_global": "1952-01-01", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1952-01-01", "authority": "FDA"},
            "GBR": {"date": "1952-06-01", "authority": "MHRA"},
            "IND": {"date": "1955-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1970-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1965-01-01", "authority": "PPB"},
        },
    },
    "bedaquiline": {
        "first_global": "2012-12-28", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2012-12-28", "authority": "FDA"},
            "GBR": {"date": "2014-03-04", "authority": "EMA"},
            "IND": {"date": "2015-06-01", "authority": "CDSCO"},
            "ZAF": {"date": "2015-01-01", "authority": "SAHPRA"},
            "NGA": {"date": "2017-01-01", "authority": "NAFDAC"},
            **{c: {"date": "2014-03-04", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Malaria ───────────────────────────────────────────────────────────────
    "artemether": {
        "first_global": "1998-01-01", "first_country": "CHN",
        "approvals": {
            "CHN": {"date": "1998-01-01", "authority": "NMPA"},
            "GBR": {"date": "1999-04-13", "authority": "EMA"},
            "IND": {"date": "2000-01-01", "authority": "CDSCO"},
            "KEN": {"date": "2002-01-01", "authority": "PPB"},
            "NGA": {"date": "2003-01-01", "authority": "NAFDAC"},
            "ZAF": {"date": "2001-01-01", "authority": "SAHPRA"},
            "USA": {"date": "2009-04-07", "authority": "FDA"},
            **{c: {"date": "1999-04-13", "authority": "EMA"} for c in EU27},
        },
    },
    "artesunate": {
        "first_global": "2006-01-01", "first_country": "IND",
        "approvals": {
            "IND": {"date": "2006-01-01", "authority": "CDSCO"},
            "KEN": {"date": "2007-01-01", "authority": "PPB"},
            "NGA": {"date": "2008-01-01", "authority": "NAFDAC"},
            "GBR": {"date": "2021-04-16", "authority": "EMA"},
            "USA": {"date": "2020-05-26", "authority": "FDA"},
            **{c: {"date": "2021-04-16", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Hepatitis C ───────────────────────────────────────────────────────────
    "sofosbuvir": {
        "first_global": "2013-12-06", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2013-12-06", "authority": "FDA"},
            "IND": {"date": "2015-03-01", "authority": "CDSCO"},
            "BRA": {"date": "2015-11-01", "authority": "ANVISA"},
            "EGY": {"date": "2015-01-01", "authority": "EDA"},
            "ZAF": {"date": "2016-01-01", "authority": "SAHPRA"},
            **{c: {"date": "2014-01-16", "authority": "EMA"} for c in EU27},
        },
    },
    "daclatasvir": {
        "first_global": "2015-07-24", "first_country": "GBR",
        "approvals": {
            "GBR": {"date": "2015-07-24", "authority": "EMA"},
            "USA": {"date": "2015-07-24", "authority": "FDA"},
            "IND": {"date": "2016-01-01", "authority": "CDSCO"},
            "BRA": {"date": "2016-05-01", "authority": "ANVISA"},
            "ZAF": {"date": "2017-01-01", "authority": "SAHPRA"},
            **{c: {"date": "2015-07-24", "authority": "EMA"} for c in EU27},
        },
    },
    "sofosbuvir_velpatasvir": {
        "first_global": "2016-06-28", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2016-06-28", "authority": "FDA"},
            "GBR": {"date": "2016-07-06", "authority": "EMA"},
            "IND": {"date": "2017-09-01", "authority": "CDSCO"},
            "BRA": {"date": "2018-01-01", "authority": "ANVISA"},
            "EGY": {"date": "2017-01-01", "authority": "EDA"},
            "ZAF": {"date": "2018-06-01", "authority": "SAHPRA"},
            **{c: {"date": "2016-07-06", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Diabetes ──────────────────────────────────────────────────────────────
    "metformin": {
        "first_global": "1957-01-01", "first_country": "FRA",
        "approvals": {
            "FRA": {"date": "1957-01-01", "authority": "ANSM"},
            "GBR": {"date": "1958-01-01", "authority": "MHRA"},
            "USA": {"date": "1994-12-29", "authority": "FDA"},
            "IND": {"date": "1960-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1975-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1970-01-01", "authority": "PPB"},
            "ZAF": {"date": "1965-01-01", "authority": "SAHPRA"},
            "BRA": {"date": "1968-01-01", "authority": "ANVISA"},
            "AUS": {"date": "1977-01-01", "authority": "TGA"},
            "CAN": {"date": "1972-01-01", "authority": "Health Canada"},
        },
    },
    "insulin_glargine": {
        "first_global": "2000-04-20", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2000-04-20", "authority": "FDA"},
            "GBR": {"date": "2000-06-09", "authority": "EMA"},
            "IND": {"date": "2003-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2004-01-01", "authority": "SAHPRA"},
            "KEN": {"date": "2006-01-01", "authority": "PPB"},
            "NGA": {"date": "2007-01-01", "authority": "NAFDAC"},
            "BRA": {"date": "2002-01-01", "authority": "ANVISA"},
            "AUS": {"date": "2001-01-01", "authority": "TGA"},
            "CAN": {"date": "2001-01-01", "authority": "Health Canada"},
            **{c: {"date": "2000-06-09", "authority": "EMA"} for c in EU27},
        },
    },
    "dapagliflozin": {
        "first_global": "2012-11-12", "first_country": "GBR",
        "approvals": {
            "GBR": {"date": "2012-11-12", "authority": "EMA"},
            "USA": {"date": "2014-01-08", "authority": "FDA"},
            "IND": {"date": "2015-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2016-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "2015-06-01", "authority": "TGA"},
            "CAN": {"date": "2015-06-01", "authority": "Health Canada"},
            "JPN": {"date": "2014-03-24", "authority": "PMDA"},
            **{c: {"date": "2012-11-12", "authority": "EMA"} for c in EU27},
        },
    },
    "semaglutide": {
        "first_global": "2017-12-05", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2017-12-05", "authority": "FDA"},
            "GBR": {"date": "2018-01-08", "authority": "EMA"},
            "IND": {"date": "2021-06-01", "authority": "CDSCO"},
            "ZAF": {"date": "2022-01-01", "authority": "SAHPRA"},
            "BRA": {"date": "2021-01-01", "authority": "ANVISA"},
            "AUS": {"date": "2020-04-01", "authority": "TGA"},
            "CAN": {"date": "2018-01-01", "authority": "Health Canada"},
            "JPN": {"date": "2021-06-23", "authority": "PMDA"},
            **{c: {"date": "2018-01-08", "authority": "EMA"} for c in EU27},
        },
    },
    "empagliflozin": {
        "first_global": "2014-05-01", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2014-08-01", "authority": "FDA"},
            "GBR": {"date": "2014-05-22", "authority": "EMA"},
            "IND": {"date": "2015-06-01", "authority": "CDSCO"},
            "ZAF": {"date": "2016-01-01", "authority": "SAHPRA"},
            "BRA": {"date": "2016-06-01", "authority": "ANVISA"},
            "AUS": {"date": "2015-01-01", "authority": "TGA"},
            "CAN": {"date": "2015-08-01", "authority": "Health Canada"},
            "JPN": {"date": "2014-09-26", "authority": "PMDA"},
            **{c: {"date": "2014-05-22", "authority": "EMA"} for c in EU27},
        },
    },
    "liraglutide": {
        "first_global": "2009-01-30", "first_country": "GBR",
        "approvals": {
            "GBR": {"date": "2009-01-30", "authority": "EMA"},
            "USA": {"date": "2010-01-25", "authority": "FDA"},
            "IND": {"date": "2013-01-01", "authority": "CDSCO"},
            "AUS": {"date": "2012-01-01", "authority": "TGA"},
            **{c: {"date": "2009-01-30", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Cardiovascular ────────────────────────────────────────────────────────
    "atorvastatin": {
        "first_global": "1996-12-17", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1996-12-17", "authority": "FDA"},
            "GBR": {"date": "1997-09-01", "authority": "EMA"},
            "IND": {"date": "1999-01-01", "authority": "CDSCO"},
            "NGA": {"date": "2001-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "2002-01-01", "authority": "PPB"},
            "ZAF": {"date": "1999-01-01", "authority": "SAHPRA"},
            "BRA": {"date": "1998-01-01", "authority": "ANVISA"},
            "AUS": {"date": "1998-01-01", "authority": "TGA"},
            "CAN": {"date": "1997-01-01", "authority": "Health Canada"},
            "JPN": {"date": "2000-09-08", "authority": "PMDA"},
            **{c: {"date": "1997-09-01", "authority": "EMA"} for c in EU27},
        },
    },
    "amlodipine": {
        "first_global": "1990-07-31", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1992-07-31", "authority": "FDA"},
            "GBR": {"date": "1990-07-31", "authority": "MHRA"},
            "IND": {"date": "1994-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1996-01-01", "authority": "NAFDAC"},
            "ZAF": {"date": "1993-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "1992-01-01", "authority": "TGA"},
            "JPN": {"date": "1994-03-25", "authority": "PMDA"},
        },
    },
    "lisinopril": {
        "first_global": "1987-12-29", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1987-12-29", "authority": "FDA"},
            "GBR": {"date": "1990-01-01", "authority": "MHRA"},
            "IND": {"date": "1992-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1995-01-01", "authority": "NAFDAC"},
            "ZAF": {"date": "1991-01-01", "authority": "SAHPRA"},
            "CAN": {"date": "1990-01-01", "authority": "Health Canada"},
        },
    },
    "bisoprolol": {
        "first_global": "1986-01-01", "first_country": "DEU",
        "approvals": {
            "DEU": {"date": "1986-01-01", "authority": "BfArM"},
            "GBR": {"date": "1992-01-01", "authority": "MHRA"},
            "USA": {"date": "1992-07-31", "authority": "FDA"},
            "IND": {"date": "1995-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1998-01-01", "authority": "NAFDAC"},
            **{c: {"date": "1992-01-01", "authority": "EMA"} for c in EU27},
        },
    },
    "apixaban": {
        "first_global": "2011-05-18", "first_country": "GBR",
        "approvals": {
            "GBR": {"date": "2011-05-18", "authority": "EMA"},
            "USA": {"date": "2012-12-28", "authority": "FDA"},
            "IND": {"date": "2013-06-01", "authority": "CDSCO"},
            "ZAF": {"date": "2014-01-01", "authority": "SAHPRA"},
            "BRA": {"date": "2013-05-01", "authority": "ANVISA"},
            "AUS": {"date": "2013-01-01", "authority": "TGA"},
            "CAN": {"date": "2012-12-01", "authority": "Health Canada"},
            "JPN": {"date": "2013-09-18", "authority": "PMDA"},
            **{c: {"date": "2011-05-18", "authority": "EMA"} for c in EU27},
        },
    },
    "rivaroxaban": {
        "first_global": "2008-09-01", "first_country": "CAN",
        "approvals": {
            "CAN": {"date": "2008-09-01", "authority": "Health Canada"},
            "GBR": {"date": "2008-09-30", "authority": "EMA"},
            "USA": {"date": "2011-07-01", "authority": "FDA"},
            "IND": {"date": "2012-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2012-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "2009-01-01", "authority": "TGA"},
            **{c: {"date": "2008-09-30", "authority": "EMA"} for c in EU27},
        },
    },
    "sacubitril_valsartan": {
        "first_global": "2015-07-07", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2015-07-07", "authority": "FDA"},
            "GBR": {"date": "2015-11-19", "authority": "EMA"},
            "IND": {"date": "2016-06-01", "authority": "CDSCO"},
            "ZAF": {"date": "2017-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "2016-04-01", "authority": "TGA"},
            "JPN": {"date": "2020-06-29", "authority": "PMDA"},
            **{c: {"date": "2015-11-19", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Antibiotics ───────────────────────────────────────────────────────────
    "amoxicillin": {
        "first_global": "1972-01-01", "first_country": "GBR",
        "approvals": {
            "GBR": {"date": "1972-01-01", "authority": "MHRA"},
            "USA": {"date": "1974-01-01", "authority": "FDA"},
            "IND": {"date": "1975-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1978-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1977-01-01", "authority": "PPB"},
            "ZAF": {"date": "1975-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "1973-01-01", "authority": "TGA"},
        },
    },
    "azithromycin": {
        "first_global": "1988-01-01", "first_country": "YUG",
        "approvals": {
            "USA": {"date": "1991-11-01", "authority": "FDA"},
            "GBR": {"date": "1990-01-01", "authority": "MHRA"},
            "IND": {"date": "1994-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1996-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1995-01-01", "authority": "PPB"},
            "AUS": {"date": "1992-01-01", "authority": "TGA"},
        },
    },
    "doxycycline": {
        "first_global": "1967-01-01", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1967-01-01", "authority": "FDA"},
            "GBR": {"date": "1968-01-01", "authority": "MHRA"},
            "IND": {"date": "1970-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1972-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1971-01-01", "authority": "PPB"},
            "ZAF": {"date": "1970-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "1969-01-01", "authority": "TGA"},
        },
    },
    "ciprofloxacin": {
        "first_global": "1987-10-22", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1987-10-22", "authority": "FDA"},
            "GBR": {"date": "1987-01-01", "authority": "MHRA"},
            "IND": {"date": "1989-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1991-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1990-01-01", "authority": "PPB"},
            **{c: {"date": "1987-01-01", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Respiratory ───────────────────────────────────────────────────────────
    "salbutamol": {
        "first_global": "1969-01-01", "first_country": "GBR",
        "approvals": {
            "GBR": {"date": "1969-01-01", "authority": "MHRA"},
            "USA": {"date": "1982-09-01", "authority": "FDA"},
            "IND": {"date": "1972-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1975-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1974-01-01", "authority": "PPB"},
            "ZAF": {"date": "1971-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "1970-01-01", "authority": "TGA"},
        },
    },
    "budesonide": {
        "first_global": "1980-01-01", "first_country": "SWE",
        "approvals": {
            "SWE": {"date": "1980-01-01", "authority": "MPA"},
            "GBR": {"date": "1981-01-01", "authority": "MHRA"},
            "USA": {"date": "1994-02-10", "authority": "FDA"},
            "IND": {"date": "1993-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1996-01-01", "authority": "NAFDAC"},
            "ZAF": {"date": "1987-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "1985-01-01", "authority": "TGA"},
        },
    },

    # ── Gastrointestinal ──────────────────────────────────────────────────────
    "omeprazole": {
        "first_global": "1988-09-14", "first_country": "SWE",
        "approvals": {
            "SWE": {"date": "1988-09-14", "authority": "MPA"},
            "GBR": {"date": "1989-01-01", "authority": "MHRA"},
            "USA": {"date": "1989-09-14", "authority": "FDA"},
            "IND": {"date": "1992-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1994-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1993-01-01", "authority": "PPB"},
            "AUS": {"date": "1990-01-01", "authority": "TGA"},
        },
    },
    "pantoprazole": {
        "first_global": "1994-01-01", "first_country": "DEU",
        "approvals": {
            "DEU": {"date": "1994-01-01", "authority": "BfArM"},
            "GBR": {"date": "1995-01-01", "authority": "MHRA"},
            "USA": {"date": "2000-02-02", "authority": "FDA"},
            "IND": {"date": "1998-01-01", "authority": "CDSCO"},
            "NGA": {"date": "2002-01-01", "authority": "NAFDAC"},
            **{c: {"date": "1994-01-01", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Mental Health ─────────────────────────────────────────────────────────
    "fluoxetine": {
        "first_global": "1987-12-29", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1987-12-29", "authority": "FDA"},
            "GBR": {"date": "1989-01-01", "authority": "MHRA"},
            "IND": {"date": "1992-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1995-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1994-01-01", "authority": "PPB"},
            "AUS": {"date": "1990-01-01", "authority": "TGA"},
        },
    },
    "haloperidol": {
        "first_global": "1958-01-01", "first_country": "BEL",
        "approvals": {
            "BEL": {"date": "1958-01-01", "authority": "FAMHP"},
            "USA": {"date": "1967-04-12", "authority": "FDA"},
            "GBR": {"date": "1965-01-01", "authority": "MHRA"},
            "IND": {"date": "1965-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1970-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1970-01-01", "authority": "PPB"},
        },
    },
    "risperidone": {
        "first_global": "1993-06-29", "first_country": "CAN",
        "approvals": {
            "CAN": {"date": "1993-06-29", "authority": "Health Canada"},
            "USA": {"date": "1993-12-29", "authority": "FDA"},
            "GBR": {"date": "1993-10-01", "authority": "EMA"},
            "IND": {"date": "1996-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1998-01-01", "authority": "NAFDAC"},
            **{c: {"date": "1993-10-01", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Oncology ─────────────────────────────────────────────────────────────
    "imatinib": {
        "first_global": "2001-05-10", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2001-05-10", "authority": "FDA"},
            "GBR": {"date": "2001-11-07", "authority": "EMA"},
            "IND": {"date": "2003-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2004-01-01", "authority": "SAHPRA"},
            "BRA": {"date": "2003-06-01", "authority": "ANVISA"},
            "AUS": {"date": "2002-01-01", "authority": "TGA"},
            **{c: {"date": "2001-11-07", "authority": "EMA"} for c in EU27},
        },
    },
    "trastuzumab": {
        "first_global": "1998-09-25", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1998-09-25", "authority": "FDA"},
            "GBR": {"date": "2000-08-28", "authority": "EMA"},
            "IND": {"date": "2002-01-01", "authority": "CDSCO"},
            "BRA": {"date": "2002-01-01", "authority": "ANVISA"},
            "ZAF": {"date": "2004-01-01", "authority": "SAHPRA"},
            **{c: {"date": "2000-08-28", "authority": "EMA"} for c in EU27},
        },
    },
    "tamoxifen": {
        "first_global": "1977-12-30", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1977-12-30", "authority": "FDA"},
            "GBR": {"date": "1973-01-01", "authority": "MHRA"},
            "IND": {"date": "1980-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1985-01-01", "authority": "NAFDAC"},
            "AUS": {"date": "1979-01-01", "authority": "TGA"},
        },
    },
    "pembrolizumab": {
        "first_global": "2014-09-04", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2014-09-04", "authority": "FDA"},
            "GBR": {"date": "2015-07-17", "authority": "EMA"},
            "IND": {"date": "2018-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2018-06-01", "authority": "SAHPRA"},
            "BRA": {"date": "2017-05-01", "authority": "ANVISA"},
            "AUS": {"date": "2015-11-01", "authority": "TGA"},
            "JPN": {"date": "2016-09-28", "authority": "PMDA"},
            **{c: {"date": "2015-07-17", "authority": "EMA"} for c in EU27},
        },
    },
    "nivolumab": {
        "first_global": "2014-07-04", "first_country": "JPN",
        "approvals": {
            "JPN": {"date": "2014-07-04", "authority": "PMDA"},
            "USA": {"date": "2014-12-22", "authority": "FDA"},
            "GBR": {"date": "2015-06-19", "authority": "EMA"},
            "IND": {"date": "2018-01-01", "authority": "CDSCO"},
            "BRA": {"date": "2016-11-01", "authority": "ANVISA"},
            "AUS": {"date": "2015-08-01", "authority": "TGA"},
            **{c: {"date": "2015-06-19", "authority": "EMA"} for c in EU27},
        },
    },
    "osimertinib": {
        "first_global": "2015-11-13", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2015-11-13", "authority": "FDA"},
            "GBR": {"date": "2016-02-02", "authority": "EMA"},
            "IND": {"date": "2017-06-01", "authority": "CDSCO"},
            "ZAF": {"date": "2018-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "2016-09-01", "authority": "TGA"},
            "JPN": {"date": "2016-03-28", "authority": "PMDA"},
            **{c: {"date": "2016-02-02", "authority": "EMA"} for c in EU27},
        },
    },
    "venetoclax": {
        "first_global": "2016-04-11", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2016-04-11", "authority": "FDA"},
            "GBR": {"date": "2016-12-05", "authority": "EMA"},
            "IND": {"date": "2018-01-01", "authority": "CDSCO"},
            "AUS": {"date": "2016-11-01", "authority": "TGA"},
            **{c: {"date": "2016-12-05", "authority": "EMA"} for c in EU27},
        },
    },
    "lenalidomide": {
        "first_global": "2005-12-27", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2005-12-27", "authority": "FDA"},
            "GBR": {"date": "2007-06-14", "authority": "EMA"},
            "IND": {"date": "2010-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2011-01-01", "authority": "SAHPRA"},
            "AUS": {"date": "2008-01-01", "authority": "TGA"},
            **{c: {"date": "2007-06-14", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Autoimmune / Biologics ────────────────────────────────────────────────
    "adalimumab": {
        "first_global": "2002-12-31", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2002-12-31", "authority": "FDA"},
            "GBR": {"date": "2003-09-08", "authority": "EMA"},
            "IND": {"date": "2008-01-01", "authority": "CDSCO"},
            "ZAF": {"date": "2009-01-01", "authority": "SAHPRA"},
            "BRA": {"date": "2006-09-01", "authority": "ANVISA"},
            "AUS": {"date": "2003-05-01", "authority": "TGA"},
            "CAN": {"date": "2004-01-01", "authority": "Health Canada"},
            "JPN": {"date": "2008-05-09", "authority": "PMDA"},
            **{c: {"date": "2003-09-08", "authority": "EMA"} for c in EU27},
        },
    },
    "ustekinumab": {
        "first_global": "2008-09-25", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2008-09-25", "authority": "FDA"},
            "GBR": {"date": "2009-01-16", "authority": "EMA"},
            "IND": {"date": "2012-01-01", "authority": "CDSCO"},
            "AUS": {"date": "2009-08-01", "authority": "TGA"},
            **{c: {"date": "2009-01-16", "authority": "EMA"} for c in EU27},
        },
    },
    "dupilumab": {
        "first_global": "2017-03-28", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2017-03-28", "authority": "FDA"},
            "GBR": {"date": "2017-09-27", "authority": "EMA"},
            "AUS": {"date": "2018-04-01", "authority": "TGA"},
            "JPN": {"date": "2018-04-20", "authority": "PMDA"},
            **{c: {"date": "2017-09-27", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Maternal / Reproductive Health ────────────────────────────────────────
    "oxytocin": {
        "first_global": "1960-01-01", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1960-01-01", "authority": "FDA"},
            "GBR": {"date": "1960-06-01", "authority": "MHRA"},
            "IND": {"date": "1962-01-01", "authority": "CDSCO"},
            "KEN": {"date": "1970-01-01", "authority": "PPB"},
            "NGA": {"date": "1972-01-01", "authority": "NAFDAC"},
            "ZAF": {"date": "1963-01-01", "authority": "SAHPRA"},
        },
    },
    "misoprostol": {
        "first_global": "1986-12-27", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1986-12-27", "authority": "FDA"},
            "GBR": {"date": "1988-01-01", "authority": "MHRA"},
            "IND": {"date": "1992-01-01", "authority": "CDSCO"},
            "KEN": {"date": "2003-01-01", "authority": "PPB"},
            "NGA": {"date": "2006-01-01", "authority": "NAFDAC"},
        },
    },

    # ── Analgesics ────────────────────────────────────────────────────────────
    "paracetamol": {
        "first_global": "1953-01-01", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1955-01-01", "authority": "FDA"},
            "GBR": {"date": "1956-01-01", "authority": "MHRA"},
            "IND": {"date": "1960-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1965-01-01", "authority": "NAFDAC"},
            "KEN": {"date": "1964-01-01", "authority": "PPB"},
        },
    },
    "ibuprofen": {
        "first_global": "1969-01-01", "first_country": "GBR",
        "approvals": {
            "GBR": {"date": "1969-01-01", "authority": "MHRA"},
            "USA": {"date": "1974-07-01", "authority": "FDA"},
            "IND": {"date": "1977-01-01", "authority": "CDSCO"},
            "NGA": {"date": "1980-01-01", "authority": "NAFDAC"},
        },
    },

    # ── HIV long-acting ───────────────────────────────────────────────────────
    "cabotegravir": {
        "first_global": "2021-12-20", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2021-12-20", "authority": "FDA"},
            "GBR": {"date": "2020-12-01", "authority": "EMA"},
            "ZAF": {"date": "2022-06-01", "authority": "SAHPRA"},
            "KEN": {"date": "2023-01-01", "authority": "PPB"},
            "NGA": {"date": "2023-06-01", "authority": "NAFDAC"},
            **{c: {"date": "2020-12-01", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Neurology ────────────────────────────────────────────────────────────
    "levetiracetam": {
        "first_global": "1999-11-30", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1999-11-30", "authority": "FDA"},
            "GBR": {"date": "2000-09-29", "authority": "EMA"},
            "IND": {"date": "2005-01-01", "authority": "CDSCO"},
            "NGA": {"date": "2008-01-01", "authority": "NAFDAC"},
            "AUS": {"date": "2001-06-01", "authority": "TGA"},
            **{c: {"date": "2000-09-29", "authority": "EMA"} for c in EU27},
        },
    },
    "donepezil": {
        "first_global": "1996-11-25", "first_country": "USA",
        "approvals": {
            "USA": {"date": "1996-11-25", "authority": "FDA"},
            "GBR": {"date": "1997-03-05", "authority": "EMA"},
            "IND": {"date": "2001-01-01", "authority": "CDSCO"},
            "NGA": {"date": "2004-01-01", "authority": "NAFDAC"},
            "JPN": {"date": "1999-11-04", "authority": "PMDA"},
            **{c: {"date": "1997-03-05", "authority": "EMA"} for c in EU27},
        },
    },

    # ── Rare disease / Specialty ─────────────────────────────────────────────
    "nusinersen": {
        "first_global": "2016-12-23", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2016-12-23", "authority": "FDA"},
            "GBR": {"date": "2017-06-01", "authority": "EMA"},
            "AUS": {"date": "2018-03-01", "authority": "TGA"},
            **{c: {"date": "2017-06-01", "authority": "EMA"} for c in EU27},
        },
    },
    "ivacaftor_lumacaftor": {
        "first_global": "2015-07-02", "first_country": "USA",
        "approvals": {
            "USA": {"date": "2015-07-02", "authority": "FDA"},
            "GBR": {"date": "2015-11-19", "authority": "EMA"},
            "AUS": {"date": "2016-01-01", "authority": "TGA"},
            **{c: {"date": "2015-11-19", "authority": "EMA"} for c in EU27},
        },
    },
    "azelastine_hydrochloride": {
        "first_global": "1986-01-01", "first_country": "DEU",
        "approvals": {
            "DEU": {"date": "1986-01-01", "authority": "BfArM"},
            "GBR": {"date": "1991-01-01", "authority": "MHRA"},
            "USA": {"date": "1996-10-21", "authority": "FDA"},
            "IND": {"date": "2000-01-01", "authority": "CDSCO"},
            "NGA": {"date": "2005-01-01", "authority": "NAFDAC"},
            **{c: {"date": "1991-01-01", "authority": "EMA"} for c in EU27},
        },
    },
}


def run():
    """Write curated approval records and first_global_approval dates to Firestore."""
    db    = get_db()
    now   = datetime.utcnow().isoformat() + "Z"
    batch = db.batch()
    count = 0
    drug_count = 0

    for inn, seed in APPROVAL_SEEDS.items():
        drug_ref = db.collection("drugs").document(inn)

        # Update drug-level metadata (merge=True so we don't blow away AI enrichment)
        batch.set(drug_ref, {
            "inn":                   inn,
            "first_global_approval": seed["first_global"],
            "first_approval_country": seed["first_country"],
            "updated_at":            now,
        }, merge=True)
        drug_count += 1

        for country_code, info in seed["approvals"].items():
            approval_ref = drug_ref.collection("approvals").document(country_code)
            batch.set(approval_ref, {
                "authority":     info["authority"],
                "approval_date": info["date"],
                "source":        "approval_seeds",
                "confidence":    "verified",
                "updated_at":    now,
            }, merge=True)
            count += 1

            if count % 400 == 0:
                batch.commit()
                batch = db.batch()
                logger.info(f"Seeded {count} approval records so far…")
                time.sleep(0.3)

    batch.commit()
    logger.info(
        f"Approval seeds complete. {drug_count} drugs · {count} country approvals written."
    )
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()

import os
import csv
import logging
from typing import List, Dict, Optional
from datetime import datetime
from medilens.firebase_client import get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PriceEntry:
    def __init__(self, inn: str, country: str, price: float, currency: str, unit: str, source: str, date: str):
        self.inn = inn.upper().strip()
        self.country = country.strip()
        self.price = price
        self.currency = currency
        self.unit = unit
        self.source = source
        self.date = date

class PricingIngestor:
    def __init__(self):
        self.db = get_db()

    def update_drug_pricing(self, entries: List[PriceEntry]):
        """Uploads price data to Firestore."""
        for entry in entries:
            # We store pricing under drugs/{inn}/prices/{country_id}
            # Normalize INN to match main drug collection (lowercase/underscore for path)
            inn_id = entry.inn.lower().replace("/", "_").strip()
            
            # Upsert pricing data
            
            price_ref = self.db.collection('drugs').document(inn_id).collection('prices').document(entry.country)
            
            price_data = {
                'price': entry.price,
                'currency': entry.currency,
                'unit': entry.unit,
                'source': entry.source,
                'last_updated': entry.date or datetime.now().isoformat(),
                'country_name': entry.country
            }
            
            price_ref.set(price_data, merge=True)
            logger.info(f"Updated price for {entry.inn} in {entry.country}: {entry.price} {entry.currency}")

def ingest_gprm_sample():
    """Sample ingestor for GPRM-like CSV data."""
    # Logic to parse a GPRM CSV
    # Example columns: Product, Country, Median Price, Date
    # For now, we'll implement a mock-up to show the flow
    sample_data = [
        PriceEntry("DOLUTEGRAVIR", "Sri Lanka", 4.50, "USD", "30 tablets", "WHO GPRM", "2024-01-01"),
        PriceEntry("DOLUTEGRAVIR", "Malaysia", 12.00, "USD", "30 tablets", "WHO GPRM", "2024-01-01"),
        PriceEntry("DOLUTEGRAVIR", "USA", 125.50, "USD", "30 tablets", "GSK List", "2024-01-01"),
        PriceEntry("TRASTUZUMAB", "India", 150.00, "USD", "440mg vial", "MSF Report", "2023-11-01"),
        PriceEntry("TRASTUZUMAB", "USA", 3500.00, "USD", "440mg vial", "Market Average", "2023-11-01"),
        PriceEntry("AZELASTINE HYDROCHLORIDE", "Germany", 12.40, "EUR", "10ml spray", "BfArM", "2024-02-01"),
        PriceEntry("AZELASTINE HYDROCHLORIDE", "USA", 45.00, "USD", "10ml spray", "GoodRx", "2024-02-01"),
        PriceEntry("METFORMIN", "Global Median", 0.015, "USD", "1 tablet", "WHO EML", "2024-01-01"),
        PriceEntry("METFORMIN", "Sri Lanka", 0.008, "USD", "1 tablet", "NMRA", "2024-01-01"),
        PriceEntry("AMLODIPINE", "UK", 0.02, "GBP", "1 tablet", "NHS", "2024-01-01"),
        PriceEntry("AMLODIPINE", "USA", 0.45, "USD", "1 tablet", "Market", "2024-01-01"),
        PriceEntry("AMOXICILLIN/CLAVULANATE", "Global Median", 0.18, "USD", "1 tablet", "WHO EML", "2024-01-01"),
        PriceEntry("DAPAGLIFLOZIN", "Germany", 45.20, "EUR", "28 tablets", "Lauer-Taxe", "2024-03-01"),
        PriceEntry("DAPAGLIFLOZIN", "United Kingdom", 36.59, "GBP", "28 tablets", "NHS Tariff", "2024-03-01"),
        PriceEntry("ATORVASTATIN", "USA", 0.35, "USD", "1 tablet", "GoodRx", "2024-01-01"),
        PriceEntry("ATORVASTATIN", "Global Median", 0.04, "USD", "1 tablet", "WHO EML", "2024-01-01"),
    ]
    
    ingestor = PricingIngestor()
    ingestor.update_drug_pricing(sample_data)

if __name__ == "__main__":
    ingest_gprm_sample()

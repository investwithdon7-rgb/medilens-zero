"""
MediLens Search Indexer — Exports Firestore drug data to an Orama binary index.
This runs in the GitHub Actions 'Build + Deploy' workflow.
"""
import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from medilens.firebase_client import get_db

def export_index():
    db = get_db()
    print("Fetching drugs for search indexing...")
    
    drugs_ref = db.collection('drugs')
    docs = drugs_ref.stream()
    
    search_data = []
    for doc in docs:
        d = doc.to_dict()
        search_data.append({
            "id": doc.id,
            "inn": d.get('inn', ''),
            "brand_names": d.get('brand_names', []),
            "atc": d.get('atc', []),
            "therapeutic_class": d.get('therapeutic_class', ''),
            "who_essential": d.get('who_essential', False)
        })
    
    # We output a JSON that the frontend build step can ingest to create the Orama index.
    # Orama's binary index is usually built in Node.js, so we'll export a manifest.
    os.makedirs('data', exist_ok=True)
    with open('data/search_index_manifest.json', 'w') as f:
        json.dump(search_data, f, indent=2)
    
    print(f"Exported {len(search_data)} drugs to data/search_index_manifest.json")

if __name__ == "__main__":
    export_index()

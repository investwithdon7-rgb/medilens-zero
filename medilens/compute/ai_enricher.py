"""
MediLens AI Enrichment — Generates AI drug summaries using Gemini Pro.
This version uses direct REST calls to bypass library version issues.
"""
import os
import json
import time
import requests
from medilens.firebase_client import get_db

def enrich_drugs():
    db = get_db()
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("GEMINI_API_KEY NOT FOUND. Skipping enrichment.")
        return

    # Using v1beta endpoint for compatibility with flash-latest
    MODEL = "gemini-1.5-flash-latest"
    URL   = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={api_key}"
    
    print(f"Checking for drugs requiring AI enrichment using {MODEL} via REST...")
    
    drugs_ref = db.collection('drugs')
    try:
        drugs = list(drugs_ref.stream())
    except Exception as e:
        print(f"Failed to stream drugs from Firestore: {e}")
        return

    count = 0
    for doc in drugs:
        drug_data = doc.to_dict()
        # Skip if already enriched
        if drug_data.get('ai_summary') and drug_data.get('drug_class') and drug_data.get('drug_class') not in ['—', 'General Therapeutic', 'General']:
            continue
            
        count += 1
        if count > 50: # Batch limit per run to stay well within daily quotas
            print("Reached batch limit (50). Stopping for now.")
            break
        
        inn = doc.id
        category  = drug_data.get('drug_class', 'General Therapeutic')
        
        print(f"[{count}] Generating analytics for {inn}...")
        
        prompt = f"""
        Act as a clinical pharmacist and global health intelligence analyst.
        Provide analytical info for the drug: {inn}. 
        
        Return exactly 4 clear, professional sections in JSON format:
        1. drug_class: A 1-2 word primary therapeutic category (e.g., 'Oncology', 'Cardiovascular', 'Antiviral').
        2. significance: A 2-sentence breakdown of clinical impact.
        3. access_outlook: 2 sentences on global access barriers.
        4. alternatives: List 2-3 common therapeutic alternatives.
        
        Format:
        {{
          "drug_class": "...",
          "significance": "...",
          "access_outlook": "...",
          "alternatives": ["...", "..."]
        }}
        """
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 800}
        }

        try:
            time.sleep(10) # Heavy sleep (6 RPM) to ensure we NEVER hit 429
            res = requests.post(URL, json=payload, timeout=30)
            
            if res.status_code == 429:
                print("Rate limit reached (429). Exiting early to preserve quota.")
                return
            
            if res.status_code != 200:
                print(f"API Error {res.status_code}: {res.text}")
                continue

            resp_data = res.json()
            raw_text  = resp_data['candidates'][0]['content']['parts'][0]['text'].strip()
            
            # Clean up potential markdown formatting
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
            analytics = json.loads(raw_text)
            
            doc.reference.update({
                'drug_class': analytics.get('drug_class', 'General'),
                'ai_summary': analytics.get('significance', ''),
                'ai_analytics': analytics,
                'last_enriched': inventory_date() # Optional tracking
            })
            print(f"Successfully updated {inn}")
            
        except Exception as e:
            print(f"Error processing {inn}: {e}")
            continue

    if count == 0:
        print("No drugs require enrichment.")

def inventory_date():
    from datetime import datetime
    return datetime.utcnow().isoformat()

if __name__ == "__main__":
    enrich_drugs()

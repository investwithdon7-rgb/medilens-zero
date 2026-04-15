"""
MediLens AI Enrichment — Generates structured drug intelligence using Gemini.
Enriches each drug with 6 analytical fields stored in ai_analytics.
Uses direct REST calls for compatibility across Gemini model versions.
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
        print("GEMINI_API_KEY not found. Skipping enrichment.")
        return

    print("Checking for drugs requiring AI enrichment...")

    drugs_ref = db.collection('drugs')
    try:
        drugs = list(drugs_ref.stream())
    except Exception as e:
        print(f"Failed to stream drugs from Firestore: {e}")
        return

    count = 0
    MAX_PER_RUN = 2  # Respect Gemini free-tier quota

    for doc in drugs:
        if count >= MAX_PER_RUN:
            print(f"Reached limit of {MAX_PER_RUN} enrichments. Stopping.")
            break

        drug_data = doc.to_dict()

        # Skip if already fully enriched (all 6 fields present)
        ai = drug_data.get('ai_analytics') or {}
        already_enriched = (
            drug_data.get('ai_summary')
            and drug_data.get('drug_class')
            and drug_data.get('drug_class') not in ['—', 'General Therapeutic', 'General']
            and ai.get('mechanism')
            and ai.get('access_barriers')
            and ai.get('advocacy_angle')
        )
        if already_enriched:
            continue

        count += 1
        inn = doc.id
        print(f"[{count}/{MAX_PER_RUN}] Enriching: {inn}")

        prompt = f"""
Act as a clinical pharmacist and global health intelligence analyst.
Provide structured analytical intelligence for the drug: {inn}.

Return EXACTLY this JSON format with 6 fields. Be factual, clinical, and concise.

{{
  "drug_class": "1-2 word primary therapeutic category (e.g. 'Oncology', 'Cardiovascular', 'Antiviral', 'Diabetes')",
  "significance": "2 sentences on clinical impact and why this drug matters to patients.",
  "access_outlook": "2 sentences on the biggest global access barriers (cost, patents, registration gaps).",
  "mechanism": "1 sentence: mechanism of action (e.g. 'Inhibits BCR-ABL1 kinase, blocking CML cell proliferation').",
  "access_barriers": ["barrier 1 (max 6 words)", "barrier 2 (max 6 words)", "barrier 3 (max 6 words)"],
  "alternatives": ["therapeutic_alternative_inn_1", "therapeutic_alternative_inn_2"],
  "advocacy_angle": "1 sentence on the most powerful advocacy argument for closing the access gap for this drug."
}}

Rules:
- access_barriers: list 2–3 short labels (e.g. 'High originator cost', 'No generic available', 'Patent-protected until 2027')
- alternatives: list 2–3 INNs (generic names only, no brand names)
- advocacy_angle: frame around patient impact, not regulatory process
- Do not include markdown, explanation, or any text outside the JSON object
"""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 600}
        }

        # Try models in order — newest first, fallback to stable
        MODELS = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"]
        success = False

        for model in MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                time.sleep(11)  # Respect free-tier rate limits (≈60 req/min)

                res = requests.post(url, json=payload, timeout=30)

                if res.status_code == 200:
                    resp_data = res.json()
                    raw_text  = resp_data['candidates'][0]['content']['parts'][0]['text'].strip()

                    # Strip markdown fences if present
                    if "```json" in raw_text:
                        raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in raw_text:
                        raw_text = raw_text.split("```")[1].split("```")[0].strip()

                    analytics = json.loads(raw_text)

                    # Validate all 6 required fields are present
                    required = ['drug_class', 'significance', 'access_outlook', 'mechanism', 'access_barriers', 'advocacy_angle']
                    missing  = [f for f in required if not analytics.get(f)]
                    if missing:
                        print(f"  Incomplete response for {inn} (missing: {missing}). Retrying with next model...")
                        continue

                    doc.reference.update({
                        'drug_class':    analytics.get('drug_class', 'General'),
                        'ai_summary':    analytics.get('significance', ''),
                        'ai_analytics':  analytics,
                        'last_enriched': _now(),
                    })
                    print(f"  ✓ {inn} enriched via {model}")
                    success = True
                    break

                elif res.status_code == 429:
                    print(f"  Rate limited on {model}. Trying next...")
                    time.sleep(5)
                    continue
                else:
                    print(f"  {model} failed ({res.status_code}). Trying next...")
                    continue

            except json.JSONDecodeError as e:
                print(f"  JSON parse error for {inn} on {model}: {e}")
                continue
            except Exception as e:
                print(f"  Error with {model}: {e}")
                continue

        if not success:
            print(f"  ✗ Could not enrich {inn} with any model.")

    if count == 0:
        print("No drugs require enrichment at this time.")
    else:
        print(f"Enrichment complete. {count} drug(s) processed.")


def _now() -> str:
    from datetime import datetime
    return datetime.utcnow().isoformat() + 'Z'


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)
    enrich_drugs()

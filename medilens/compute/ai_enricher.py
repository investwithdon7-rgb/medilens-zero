"""
MediLens AI Enrichment — Generates AI drug summaries using Gemini Pro.
This runs in the GitHub Actions 'AI Enrich + Country Dashboards' workflow.
"""
import os
import google.generativeai as genai
from medilens.firebase_client import get_db

def enrich_drugs():
    db = get_db()
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("GEMINI_API_KEY NOT FOUND. Skipping enrichment.")
        return

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-pro')
    
    print("Checking for drugs requiring AI enrichment...")
    
    drugs_ref = db.collection('drugs')
    # Fetch recent drugs and process if missing drug_class or ai_summary
    drugs = drugs_ref.stream()
    
    count = 0
    for doc in drugs:
        drug_data = doc.to_dict()
        if drug_data.get('ai_summary') and drug_data.get('drug_class') and drug_data.get('drug_class') != 'General Therapeutic' and drug_data.get('drug_class') != 'General':
            continue
            
        count += 1
        if count > 500: break
        
        inn = doc.id
        category  = drug_data.get('drug_class', 'General Therapeutic')
        
        print(f"Generating analytics for {inn} ({category})...")
        
        prompt = f"""
        Act as a clinical pharmacist and global health intelligence analyst.
        Provide analytical info for the drug: {inn}. 
        Category: {category}.
        
        Return exactly 4 clear, professional sections in JSON format:
        1. drug_class: A 1-2 word primary therapeutic category (e.g., 'Oncology', 'Cardiovascular', 'Antiviral').
        2. significance: A 2-sentence breakdown of clinical impact and why this drug is a breakthrough or standard.
        3. access_outlook: 2 sentences on global access barriers (patents, pricing, or supply chain) particularly for LMICs.
        4. alternatives: List 2-3 common therapeutic alternatives or standard-of-care drugs used in the same category.
        
        Format example:
        {{
          "drug_class": "...",
          "significance": "...",
          "access_outlook": "...",
          "alternatives": ["...", "..."]
        }}
        """
        
        try:
            import time
            time.sleep(5) # Respect Gemini free tier limits (15 RPM)
            response = model.generate_content(prompt)
            # Basic JSON extraction from response
            import json
            raw_text = response.text.strip()
            # Clean up potential markdown formatting
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
            analytics = json.loads(raw_text)
            
            doc.reference.update({
                'drug_class': analytics.get('drug_class', 'General'),
                'ai_summary': analytics.get('significance', ''),
                'ai_analytics': analytics
            })
            print(f"Updated {inn} with deep analytics.")
        except Exception as e:
            print(f"Error generating analytics for {inn}: {e}")
            if "429" in str(e) or "Quota" in str(e) or "exhausted" in str(e) or "Too Many Requests" in str(e):
                print("Hit rate limit. Exiting early so pipeline can build dashboard with partial data.")
                return
            
    if count == 0:
        print("No drugs require enrichment at this time.")

if __name__ == "__main__":
    enrich_drugs()

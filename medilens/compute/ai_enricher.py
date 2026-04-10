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
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    print("Checking for drugs requiring AI enrichment...")
    
    drugs_ref = db.collection('drugs')
    # Fetch drugs without ai_summary
    drugs = drugs_ref.where('ai_summary', '==', None).limit(20).stream()
    
    count = 0
    for doc in drugs:
        count += 1
        inn = doc.id
        print(f"Generating summary for {inn}...")
        
        prompt = f"""
        Act as a clinical pharmacist and global health advocate.
        Provide a 3-sentence professional summary for the drug: {inn}.
        Sentence 1: Primary therapeutic use and mechanism.
        Sentence 2: Significant clinical or public health impact.
        Sentence 3: Status in global health (e.g., WHO EML status or generic availability).
        Keep it concise and objective.
        """
        
        try:
            response = model.generate_content(prompt)
            summary = response.text.strip()
            
            doc.reference.update({
                'ai_summary': summary
            })
            print(f"Updated {inn}.")
        except Exception as e:
            print(f"Error generating summary for {inn}: {e}")
            
    if count == 0:
        print("No drugs require enrichment at this time.")

if __name__ == "__main__":
    enrich_drugs()

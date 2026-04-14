"""
MediLens Major Disease Portfolio — Seeder for the Top 20 Global Diseases.
Seeds core molecules into Firestore to establish the platform's foundation.
"""
import firebase_admin
from firebase_admin import credentials, firestore
from medilens.firebase_client import get_db

CORE_PORTFOLIO = [
    # 1. HIV/AIDS
    {"inn": "DOLUTEGRAVIR", "therapeutic_class": "HIV/AIDS", "brand_names": ["Tivicay"], "who_essential": True},
    {"inn": "TENOFOVIR ALAFENAMIDE", "therapeutic_class": "HIV/AIDS", "brand_names": ["Vemlidy"], "who_essential": True},
    
    # 2. Malaria
    {"inn": "ARTEMETHER/LUMEFANTRINE", "therapeutic_class": "Malaria", "brand_names": ["Coartem"], "who_essential": True},
    {"inn": "ARTESUNATE", "therapeutic_class": "Malaria", "brand_names": ["Artesun"], "who_essential": True},
    
    # 3. Tuberculosis
    {"inn": "RIFAMPICIN", "therapeutic_class": "Tuberculosis", "brand_names": ["Rifadin"], "who_essential": True},
    {"inn": "BEDAQUILINE", "therapeutic_class": "Tuberculosis", "brand_names": ["Sirturo"], "who_essential": True},
    
    # 4. Hypertension
    {"inn": "AMLODIPINE", "therapeutic_class": "Cardiovascular", "brand_names": ["Norvasc"], "who_essential": True},
    {"inn": "LOSARTAN", "therapeutic_class": "Cardiovascular", "brand_names": ["Cozaar"], "who_essential": True},
    
    # 5. Cardiovascular (Cholesterol)
    {"inn": "ATORVASTATIN", "therapeutic_class": "Cardiovascular", "brand_names": ["Lipitor"], "who_essential": True},
    
    # 6. Diabetes
    {"inn": "METFORMIN", "therapeutic_class": "Diabetes", "brand_names": ["Glucophage"], "who_essential": True},
    {"inn": "INSULIN GLARGINE", "therapeutic_class": "Diabetes", "brand_names": ["Lantus"], "who_essential": True},
    {"inn": "DAPAGLIFLOZIN", "therapeutic_class": "Diabetes", "brand_names": ["Farxiga", "Forxiga"], "who_essential": True},
    
    # 7. Oncology
    {"inn": "TRASTUZUMAB", "therapeutic_class": "Oncology", "brand_names": ["Herceptin"], "who_essential": True},
    {"inn": "IMATINIB", "therapeutic_class": "Oncology", "brand_names": ["Gleevec"], "who_essential": True},
    {"inn": "RITUXIMAB", "therapeutic_class": "Oncology", "brand_names": ["Rituxan"], "who_essential": True},
    
    # 8. Respiratory
    {"inn": "SALBUTAMOL", "therapeutic_class": "Respiratory", "brand_names": ["Ventolin"], "who_essential": True},
    {"inn": "BUDESONIDE", "therapeutic_class": "Respiratory", "brand_names": ["Pulmicort"], "who_essential": True},
    
    # 9. Mental Health
    {"inn": "SERTALINE", "therapeutic_class": "Mental Health", "brand_names": ["Zoloft"], "who_essential": True},
    {"inn": "RISPERIDONE", "therapeutic_class": "Mental Health", "brand_names": ["Risperdal"], "who_essential": True},
    
    # 10. Hepatitis C
    {"inn": "SOFOSBUVIR", "therapeutic_class": "Hepatitis C", "brand_names": ["Sovaldi"], "who_essential": True},
    
    # 11. Infectious Diseases (Antibiotics)
    {"inn": "AMOXICILLIN/CLAVULANATE", "therapeutic_class": "Anti-Infective", "brand_names": ["Augmentin"], "who_essential": True},
    {"inn": "AZITHROMYCIN", "therapeutic_class": "Anti-Infective", "brand_names": ["Zithromax"], "who_essential": True},
    
    # 12. Epilepsy
    {"inn": "SODIUM VALPROATE", "therapeutic_class": "Neurology", "brand_names": ["Epilim", "Depakote"], "who_essential": True},
    
    # 13. Maternal Health
    {"inn": "OXYTOCIN", "therapeutic_class": "Maternal Health", "brand_names": ["Pitocin"], "who_essential": True},
    
    # 14. Pain / Palliative
    {"inn": "MORPHINE", "therapeutic_class": "Pain Management", "brand_names": ["MS Contin"], "who_essential": True},
    
    # 15. Gastrointestinal
    {"inn": "OMEPRAZOLE", "therapeutic_class": "Gastrointestinal", "brand_names": ["Prilosec"], "who_essential": True},
    
    # 16. Autoimmune
    {"inn": "ADALIMUMAB", "therapeutic_class": "Rheumatology", "brand_names": ["Humira"], "who_essential": True},
    
    # 17. Emergency
    {"inn": "EPINEPHRINE", "therapeutic_class": "Emergency", "brand_names": ["EpiPen"], "who_essential": True},
    
    # 18. Vaccine / Prevention
    {"inn": "PNEUMOCOCCAL VACCINE", "therapeutic_class": "Vaccines", "brand_names": ["Prevnar"], "who_essential": True},
    
    # 19. Antiviral
    {"inn": "ACYCLOVIR", "therapeutic_class": "Antiviral", "brand_names": ["Zovirax"], "who_essential": True},
    
    # 20. Ophthalmology
    {"inn": "RANIBIZUMAB", "therapeutic_class": "Ophthalmology", "brand_names": ["Lucentis"], "who_essential": False}
]

def seed_major_portfolio():
    db = get_db()
    print(f"Seeding {len(CORE_PORTFOLIO)} molecules for 20 major disease areas...")
    
    for drug in CORE_PORTFOLIO:
        doc_id = drug['inn'].lower().replace("/", "_")
        doc_ref = db.collection('drugs').document(doc_id)
        
        # Merge to keep existing AI enrichment if any
        doc_ref.set(drug, merge=True)
        print(f"  ✓ Seeded {drug['inn']}")

    print("Finalized inclusion of drugs for 20 major disease areas.")

if __name__ == "__main__":
    seed_major_portfolio()

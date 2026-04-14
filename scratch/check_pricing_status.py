from medilens.firebase_client import get_db

db = get_db()
drugs = list(db.collection('drugs').limit(10).stream())
print(f"Checking top 10 drugs for real price data...")

total_prices = 0
for d in drugs:
    prices = list(d.reference.collection('prices').stream())
    print(f"Drug {d.id} has {len(prices)} price records")
    total_prices += len(prices)

countries = list(db.collection('country_dashboards').limit(5).stream())
for c in countries:
    data = c.to_dict()
    print(f"Country {c.id} - Pricing Percentile (Beta): {data.get('pricing_percentile')}")

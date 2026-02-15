
import db
import json

try:
    print("Checking sales history...")
    history = db.get_sales_history()
    print(f"Success! Found {len(history)} records.")
    for h in history:
        print(f" - ID: {h['id']}, Total: {h['total']}")
except Exception as e:
    print(f"CRASHED: {e}")
    import traceback
    traceback.print_exc()

print("\nChecking products...")
try:
    products = db.get_all_products()
    print(f"Success! Found {len(products)} products.")
except Exception as e:
    print(f"Products CRASHED: {e}")

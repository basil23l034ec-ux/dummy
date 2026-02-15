import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_worker_flow():
    print("Testing Worker API Flow...")
    
    # 1. Add Product
    new_product = {
        "id": "WORKER_TEST_01",
        "name": "Test Product",
        "price": 100.0,
        "stock": 10,
        "category": "Test",
        "unit": "1 pc"
    }
    print(f"\n1. Adding product {new_product['id']}...")
    try:
        res = requests.post(f"{BASE_URL}/api/worker/add-product", json=new_product)
        if res.status_code == 200:
            print("✅ Product added successfully.")
        else:
            print(f"❌ Failed to add product: {res.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

    # 2. Verify Product Exists
    print("\n2. Verifying product in list...")
    try:
        res = requests.get(f"{BASE_URL}/api/worker/products")
        products = res.json()
        if "WORKER_TEST_01" in products:
            print("✅ Product found in inventory.")
        else:
            print("❌ Product NOT found in inventory.")
    except Exception as e:
        print(f"❌ Error: {e}")

    # 3. Update Stock
    print("\n3. Updating stock...")
    try:
        update_data = {
            "id": "WORKER_TEST_01",
            "stock": 50,
            "price": 120.0
        }
        res = requests.post(f"{BASE_URL}/api/worker/update-product", json=update_data)
        if res.status_code == 200:
            print("✅ Stock updated successfully.")
        else:
            print(f"❌ Failed to update stock: {res.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

    # 4. Verify Update
    print("\n4. Verifying update...")
    try:
        res = requests.get(f"{BASE_URL}/api/worker/products")
        products = res.json()
        p = products.get("WORKER_TEST_01")
        if p and p['stock'] == 50 and p['price'] == 120.0:
            print("✅ Product details updated correctly.")
        else:
            print(f"❌ Product details mismatch: {p}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    time.sleep(2)
    test_worker_flow()

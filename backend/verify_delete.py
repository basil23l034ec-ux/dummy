import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_delete_product():
    pid = "DEL_TEST_01"
    
    # 1. Add Product
    new_product = {
        "id": pid,
        "name": "Delete Test Product",
        "price": 10.0,
        "stock": 5,
        "category": "Test"
    }
    
    print(f"Adding product {pid}...")
    requests.post(f"{BASE_URL}/api/worker/add-product", json=new_product)
    
    # 2. Verify Added
    res = requests.get(f"{BASE_URL}/api/worker/products")
    if pid in res.json():
        print("✅ Product added.")
    else:
        print("❌ Failed to add product.")
        return

    # 3. Delete Product
    print("Deleting product...")
    res = requests.post(f"{BASE_URL}/api/worker/delete-product", json={"id": pid})
    
    if res.status_code == 200:
        print("✅ Delete request successful.")
    else:
        print(f"❌ Failed to delete: {res.text}")
        return

    # 4. Verify Deleted
    print("Verifying deletion...")
    res = requests.get(f"{BASE_URL}/api/worker/products")
    if pid not in res.json():
        print("✅ Product successfully removed from inventory.")
    else:
        print("❌ Product still exists in inventory.")

if __name__ == "__main__":
    time.sleep(2)
    test_delete_product()

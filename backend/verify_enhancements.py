import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_enhancements():
    # 1. Add Product with Image
    pid = "IMG_TEST_01"
    new_product = {
        "id": pid,
        "name": "Image Test Product",
        "price": 50.0,
        "stock": 100,
        "category": "Test",
        "image": "https://example.com/test.png"
    }
    
    print(f"Adding product {pid} with image...")
    res = requests.post(f"{BASE_URL}/api/worker/add-product", json=new_product)
    if res.status_code == 200:
        print("✅ Added successfully.")
    else:
        print(f"❌ Failed to add: {res.text}")
        return

    # 2. Check Last Updated
    print("Verifying Last Updated timestamp...")
    res = requests.get(f"{BASE_URL}/api/worker/products")
    products = res.json()
    p = products.get(pid)
    
    if p:
        print(f"Product Image: {p.get('image')}")
        print(f"Last Updated: {p.get('last_updated')}")
        
        if p.get('image') == "https://example.com/test.png" and p.get('last_updated'):
             print("✅ Image and Last Updated fields present.")
        else:
             print("❌ Fields missing or incorrect.")
    else:
        print("❌ Product not found.")

if __name__ == "__main__":
    time.sleep(2)
    test_enhancements()

import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_image_edit():
    pid = "IMG_EDIT_TEST"
    
    # 1. Add Product
    new_product = {
        "id": pid,
        "name": "Image Edit Product",
        "price": 50.0,
        "stock": 100,
        "category": "Test",
        "image": "original.png"
    }
    
    print(f"Adding product {pid}...")
    requests.post(f"{BASE_URL}/api/worker/add-product", json=new_product)
    
    # 2. Update Image
    print("Updating image...")
    update_data = {
        "id": pid,
        "image": "updated.png"
    }
    res = requests.post(f"{BASE_URL}/api/worker/update-product", json=update_data)
    
    if res.status_code == 200:
        print("✅ Update request successful.")
    else:
        print(f"❌ Failed to update: {res.text}")
        return

    # 3. Verify Update
    print("Verifying updated image...")
    res = requests.get(f"{BASE_URL}/api/worker/products")
    products = res.json()
    p = products.get(pid)
    
    if p and p.get('image') == "updated.png":
        print("✅ Image updated correctly.")
    else:
        print(f"❌ Image mismatch. Expected 'updated.png', got '{p.get('image')}'")

if __name__ == "__main__":
    time.sleep(2)
    test_image_edit()

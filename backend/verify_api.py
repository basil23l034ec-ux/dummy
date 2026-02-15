import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_get_products():
    print("Testing GET /products...")
    try:
        response = requests.get(f"{BASE_URL}/products")
        if response.status_code == 200:
            products = response.json()
            if len(products) > 0:
                print("✅ Products fetched successfully.")
                # Return a valid product ID for next tests
                return list(products.keys())[0] 
            else:
                print("❌ Product list is empty.")
        else:
            print(f"❌ Failed to fetch products. Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
    return None

def test_add_to_cart(product_id):
    print(f"\nTesting POST /rfid with ID {product_id}...")
    try:
        response = requests.post(f"{BASE_URL}/rfid", json={"uid": product_id})
        if response.status_code == 200:
            cart = response.json().get("cart", {})
            if product_id in cart:
                print("✅ Item added to cart successfully.")
                return True
            else:
                print("❌ Item not found in cart response.")
        else:
            print(f"❌ Failed to add item. Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
    return False

def test_checkout():
    print("\nTesting POST /checkout...")
    try:
        response = requests.post(f"{BASE_URL}/checkout")
        if response.status_code == 200:
            print("✅ Checkout successful.")
        else:
            print(f"❌ Checkout failed. Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    # Wait for server to start
    time.sleep(2)
    
    pid = test_get_products()
    if pid:
        if test_add_to_cart(pid):
            test_checkout()

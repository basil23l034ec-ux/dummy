import requests

BASE_URL = "http://localhost:5000"

def test_auth():
    print("Locked Step 1: Attempt to access protected resource without login...")
    session = requests.Session()
    
    # Try to access worker API without login
    res = session.get(f"{BASE_URL}/api/worker/products")
    if res.status_code == 401 or "login" in res.url:
        print("✅ Access denied correctly (Redirected/401).")
    else:
        print(f"❌ Access allowed without login? Status: {res.status_code}")
        return

    print("\nStep 2: Login with BAD credentials...")
    res = session.post(f"{BASE_URL}/api/worker/login", json={"username": "worker", "password": "wrongpassword"})
    if res.status_code == 401:
        print("✅ Login failed as expected.")
    else:
        print(f"❌ Login succeeded with bad creds? Status: {res.status_code}")

    print("\nStep 3: Login with CORRECT credentials...")
    res = session.post(f"{BASE_URL}/api/worker/login", json={"username": "worker", "password": "worker123"})
    if res.status_code == 200 and res.json().get("success"):
        print("✅ Login successful.")
    else:
        print(f"❌ Login failed with correct creds. Res: {res.text}")
        return

    print("\nStep 4: Access protected resource WITH login...")
    res = session.get(f"{BASE_URL}/api/worker/products")
    if res.status_code == 200:
        products = res.json()
        print(f"✅ Access granted. Retrieved {len(products)} products.")
    else:
        print(f"❌ Access denied even after login. Status: {res.status_code}")
        return

    print("\nStep 5: Test Logout...")
    res = session.post(f"{BASE_URL}/api/worker/logout")
    if res.json().get("success"):
        print("✅ Logout successful.")
    else:
        print("❌ Logout failed.")

    print("\nStep 6: Access protected resource AFTER logout...")
    res = session.get(f"{BASE_URL}/api/worker/products")
    if res.status_code == 401 or "login" in res.url:
        print("✅ Access denied correctly.")
    else:
        print(f"❌ Access still allowed after logout? Status: {res.status_code}")

if __name__ == "__main__":
    test_auth()

import requests
import re

BASE_URL = "http://localhost:5000"
SESSION = requests.Session()

# Login as admin to check admin page
SESSION.post(f"{BASE_URL}/api/admin/login", json={"username": "admin", "password": "admin123"})

# Login as worker to check worker page
SESSION.post(f"{BASE_URL}/api/worker/login", json={"username": "worker", "password": "worker123"})

def check_filters(url, page_name):
    print(f"Checking {page_name} at {url}...")
    try:
        res = SESSION.get(url)
        content = res.text
        
        required_elements = [
            ('id="searchInput"', "Search Input"),
            ('id="categoryFilter"', "Category Dropdown"),
            ('id="stockFilter"', "Stock Status Dropdown"),
        ]
        
        all_passed = True
        for snippet, name in required_elements:
            if snippet in content:
                print(f"✅ Found {name}")
            else:
                print(f"❌ Missing {name}")
                all_passed = False
                
        return all_passed
    except Exception as e:
        print(f"❌ Error access {page_name}: {e}")
        return False

if __name__ == "__main__":
    print("--- Verifying Search & Filter UI ---\n")
    worker_ok = check_filters(f"{BASE_URL}/worker", "Worker Dashboard")
    print("")
    admin_ok = check_filters(f"{BASE_URL}/admin/inventory", "Admin Inventory")
    
    if worker_ok and admin_ok:
        print("\n✅ All filter elements verified successfully.")
    else:
        print("\n❌ Verification failed.")

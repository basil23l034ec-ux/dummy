import requests

BASE_URL = "http://localhost:5000"
SESSION = requests.Session()

# Login as worker
SESSION.post(f"{BASE_URL}/api/worker/login", json={"username": "worker", "password": "worker123"})

def verify_ui():
    print("Checking Worker Dashboard UI elements...")
    try:
        res = SESSION.get(f"{BASE_URL}/worker")
        content = res.text
        
        checks = [
            ('glass-card', "Glass Card Effect"),
            ('stats-grid', "Stats Grid Layout"),
            ('stat-value', "Stats Value Elements"),
            ('filter-bar', "Filter Bar"),
            ('tailwindcss', "Tailwind CSS CDN")
        ]
        
        all_passed = True
        for snippet, name in checks:
            if snippet in content:
                print(f"✅ Found {name}")
            else:
                print(f"❌ Missing {name}")
                all_passed = False
                
        return all_passed
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if verify_ui():
        print("\n✅ UI Redesign Verified Successfully.")
    else:
        print("\n❌ UI Redesign Verification Failed.")

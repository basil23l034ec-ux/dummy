import requests

BASE_URL = "http://localhost:5000"
SESSION = requests.Session()

# Login
SESSION.post(f"{BASE_URL}/api/worker/login", json={"username": "worker", "password": "worker123"})

def verify_theme():
    print("Checking Theme Toggle Elements...")
    try:
        # Check HTML
        res = SESSION.get(f"{BASE_URL}/worker")
        html_content = res.text
        if 'id="themeToggle"' in html_content:
            print("✅ Found Theme Toggle Button in HTML")
        else:
            print("❌ Missing Theme Toggle Button")
            return False

        # Check CSS
        res_css = SESSION.get(f"{BASE_URL}/worker-frontend/static/worker.css")
        if '[data-theme="light"]' in res_css.text:
            print("✅ Found Light Theme CSS Variables")
        else:
            print("❌ Missing Light Theme CSS")
            return False

        # Check JS
        res_js = SESSION.get(f"{BASE_URL}/worker-frontend/static/worker.js")
        if 'toggleTheme' in res_js.text:
            print("✅ Found toggleTheme function in JS")
        else:
            print("❌ Missing toggleTheme function")
            return False

        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if verify_theme():
        print("\n✅ Theme Toggle Feature Verified.")
    else:
        print("\n❌ Verification Failed.")

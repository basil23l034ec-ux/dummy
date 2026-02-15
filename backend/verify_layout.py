import requests

def test_layout():
    url = "http://localhost:5000/worker"
    try:
        print(f"Fetching {url}...")
        res = requests.get(url)
        content = res.text
        
        checks = {
            "Tabs Container": '<div class="tabs">',
            "Inventory Tab": 'switchTab(\'inventory\')',
            "Add Product Tab": 'switchTab(\'addProduct\')',
            "Add Product Section": 'id="addProductSection"',
            "Inventory Section": 'id="inventorySection"'
        }
        
        all_passed = True
        for name, snippet in checks.items():
            if snippet in content:
                print(f"✅ {name} found.")
            else:
                print(f"❌ {name} NOT found.")
                all_passed = False
                
        if all_passed:
            print("\n✅ Layout verification successful.")
        else:
            print("\n❌ Layout verification failed.")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_layout()

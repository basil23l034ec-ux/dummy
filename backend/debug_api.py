import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

url = "http://localhost:5000/api/ai/design"
payload = {"prompt": "futuristic cyberpunk city with neon lights"}
headers = {"Content-Type": "application/json"}

try:
    s = requests.Session()
    
    # Login
    print("Logging in...")
    login_url = "http://localhost:5000/api/worker/login"
    login_payload = {"username": "worker", "password": "worker123"}
    s.post(login_url, json=login_payload)
    
    print("Sending request to API...")
    response = s.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("Response JSON:")
        print(json.dumps(data, indent=2))
        
        design = data.get("design", {})
        image_url = design.get("image")
        print(f"\nImage URL: {image_url}")
        
        if "pollinations" in image_url:
            print("SUCCESS: Using Pollinations.ai")
        else:
            print("FAILURE: Not using Pollinations.ai")
    else:
        print(f"Error: {response.text}")

except Exception as e:
    print(f"Connection Error: {e}")

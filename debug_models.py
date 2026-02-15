import google.generativeai as genai
import os

GENAI_API_KEY = "AIzaSyA4DqOx3yqrD6qfmXSCm5Pkxam7IJ7-FF0"
genai.configure(api_key=GENAI_API_KEY)

print("Listing available models...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Model: {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")

import os
import json
import requests
from dotenv import load_dotenv
from openai import OpenAI
import random
import urllib.parse

load_dotenv()

api_key = os.environ.get("GENAI_API_KEY")
print(f"API Key prefix: {api_key[:10]}...")

if not api_key.startswith("nvapi-"):
    print("WARNING: Not using an NVIDIA key!")

try:
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=api_key
    )

    system_instruction = """
    You are a creative Lead Designer for a high-end grocery & retail store.
    Your goal is to create VISUALLY STUNNING, EXCITING, and MODERN promotion designs.
    
    Based on the user's request, generate a JSON object with:
    - title: A short, punchy, high-impact headline (max 4 words). USE HTML to make it pop! 
    - subtitle: A persuasive, catchy 1-sentence subtext that drives action.
    - image_prompt: A highly detailed, artistic description of a background image to generate. 
    
    Return ONLY valid JSON.
    """
    
    prompt = "Halloween candy special offer with a background image of mage"
    
    print("\nSending request to NVIDIA NIM...")
    completion = client.chat.completions.create(
        model="meta/llama-3.1-70b-instruct",
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Create a hype design for: {prompt}"}
        ],
        temperature=0.7,
        top_p=1,
        max_tokens=1024,
        response_format={"type": "json_object"}
    )
    
    text = completion.choices[0].message.content
    print("\nRaw Response Content:")
    print(text)
    
    design = json.loads(text)
    print("\nParsed JSON:")
    print(json.dumps(design, indent=2))
    
    # Simulate App Logic
    if 'image_prompt' not in design:
        design['image_prompt'] = design.get('image_keyword', 'grocery store')
        
    encoded_prompt = urllib.parse.quote(design['image_prompt'])
    seed = random.randint(1, 100000)
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&nologo=true&seed={seed}"
    
    print(f"\nGenerated Image URL: {image_url}")

except Exception as e:
    print(f"\nERROR: {e}")

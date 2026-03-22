import os
import requests
from dotenv import load_dotenv

# Try to load from root and backend
load_dotenv(".env")
load_dotenv("backend/.env")

key = os.getenv("TOMTOM_API_KEY")
print(f"Key used: {key}")

url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"
params = {
    "point": "12.9176,77.6238", # Silk Board
    "unit": "KMPH",
    "key": key
}

try:
    resp = requests.get(url, params=params, timeout=10)
    print(f"Status Code: {resp.status_code}")
    if resp.status_code == 200:
        print("Success! Data received.")
        print(resp.json().get("flowSegmentData", {}).get("currentSpeed"))
    else:
        print(f"Error Body: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")

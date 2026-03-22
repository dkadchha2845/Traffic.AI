import os
import requests
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("backend/.env")

weather_key = os.getenv("OPENWEATHERMAP_API_KEY")
print(f"Weather Key: {weather_key}")

try:
    url = f"https://api.openweathermap.org/data/2.5/weather?lat=12.9716&lon=77.5946&appid={weather_key}"
    resp = requests.get(url, timeout=10)
    print(f"Status Code: {resp.status_code}")
    if resp.status_code == 200:
        print("Success!")
    else:
        print(f"Error: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")

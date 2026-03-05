import os
import requests
import random
from dotenv import load_dotenv

load_dotenv()

# We can use API keys if available in .env, otherwise fall back to realistic mock generation
WEATHER_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY")
TRAFFIC_API_KEY = os.getenv("TOMTOM_API_KEY")

def get_live_weather(lat=40.7128, lon=-74.0060):
    """Fetches live weather from OpenWeatherMap. Falls back to realistic mock if no key."""
    if WEATHER_API_KEY:
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=metric"
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                return {
                    "condition": data["weather"][0]["main"].lower(),
                    "temp": data["main"]["temp"],
                    "visibility": data.get("visibility", 10000)
                }
        except Exception as e:
            print("Weather API error:", e)
    
    # Realistic fallback
    conditions = ["clear", "rain", "fog", "snow"]
    chosen = random.choices(conditions, weights=[0.6, 0.2, 0.1, 0.1])[0]
    return {
        "condition": chosen,
        "temp": round(random.uniform(-5.0, 35.0), 1),
        "visibility": 10000 if chosen == "clear" else random.randint(1000, 5000)
    }

def get_live_traffic_congestion(lat=40.7128, lon=-74.0060):
    """Fetches real-time congestion levels from TomTom/Waze. Falls back to mock if no key."""
    if TRAFFIC_API_KEY:
        try:
            url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key={TRAFFIC_API_KEY}&point={lat},{lon}"
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                flow = data.get("flowSegmentData", {})
                current_speed = flow.get("currentSpeed", 30)
                free_flow = flow.get("freeFlowSpeed", 30)
                density = min(100, max(0, int((1 - (current_speed / max(free_flow, 1))) * 100)))
                return {"congestion_level": density, "source": "TomTom API"}
        except Exception as e:
            print("Traffic API error:", e)
            
    # Realistic fallback
    return {
        "congestion_level": random.randint(10, 95),
        "source": "Synthetic Sensor Array"
    }

def get_historical_traffic_data():
    """Simulates fetching from PeMS / NYC OpenData for training datasets."""
    # In a real app, this would query a massive CSV or BigQuery dataset.
    return {
        "am_peak_volume": random.randint(2000, 5000),
        "pm_peak_volume": random.randint(3000, 6000),
        "average_daily_traffic": random.randint(15000, 35000)
    }

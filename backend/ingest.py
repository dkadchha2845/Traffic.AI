import os
from dotenv import load_dotenv
from agent import ingest_real_life_scenario

# Load environment variables
load_dotenv()

def populate_database():
    print("Prepping real-life traffic scenarios for ingestion...")
    
    # Mock real-life datasets regarding traffic management and incidents
    scenarios = [
        {
            "content": "Alert: Severe congestion reported at the intersection of Main St and 5th Ave due to a malfunctioning traffic light. Vehicles are backed up for 2 miles in the Northbound lane. Recommended action: Route emergency vehicles through 6th Ave and adjust adjacent traffic signals to allow longer green times for East-West cross traffic.",
            "metadata": {"type": "incident", "location": "Main St & 5th Ave", "severity": "high"}
        },
        {
            "content": "Observation: Everyday between 8:00 AM and 9:00 AM, the outbound lane on Highway 42 experiences a 40% drop in average speed due to the school zone speed limit coming into effect. Recommended action: Pre-emptively adjust the highway off-ramp signals at 7:45 AM to prevent spillback onto the main highway.",
            "metadata": {"type": "pattern", "location": "Highway 42", "time": "morning_rush"}
        },
        {
            "content": "Emergency event: An ambulance is approaching the Downtown Medical Center from the South. The AI agent should immediately trigger a 'green wave' along Medical District Blvd, pre-empting all pedestrian crossings and side-street lights until the emergency vehicle has arrived.",
            "metadata": {"type": "emergency_protocol", "priority": "critical"}
        },
        {
            "content": "Weather impact: Heavy rainfall has reduced visibility and road traction across the city. Traffic speed has decreased by an average of 15 mph. Adaptive logic dictates increasing the 'yellow light' duration by 1 second across all major intersections to prevent rear-end collisions resulting from sudden braking.",
            "metadata": {"type": "weather", "condition": "rain", "action": "safety"}
        }
    ]

    print(f"Ingesting {len(scenarios)} scenarios into Supabase Vector Store...")
    
    success_count = 0
    for idx, scenario in enumerate(scenarios):
        try:
            print(f"Ingesting scenario {idx + 1}...")
            ingest_real_life_scenario(scenario["content"], scenario["metadata"])
            success_count += 1
        except Exception as e:
            print(f"Failed to ingest scenario {idx + 1}: {e}")

    print(f"Done! Successfully ingested {success_count} out of {len(scenarios)} scenarios.")

if __name__ == "__main__":
    # Ensure OPENAI_API_KEY and SUPABASE keys are present
    if not os.getenv("OPENAI_API_KEY"):
        print("ERROR: Missing OPENAI_API_KEY in .env")
    else:
        populate_database()

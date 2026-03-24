import os
from dotenv import load_dotenv
from agent import ingest_real_life_scenario

# Load environment variables
load_dotenv()

def populate_database():
    print("Prepping real-life Bangalore traffic scenarios for ingestion...")
    
    # Comprehensive Bangalore traffic knowledge base
    scenarios = [
        # Incident protocols
        {
            "content": "Alert: Severe congestion reported at Silk Board Junction due to signal malfunction. Vehicles backed up for 2km on Hosur Road. Recommended action: Route traffic through BTM 2nd Stage, extend green on Hosur Road by 45s, dispatch traffic police for manual control at junction.",
            "metadata": {"type": "incident", "location": "Silk Board Junction", "severity": "critical"}
        },
        {
            "content": "Marathahalli Bridge congestion spike: ORR traffic at 85% capacity. Recommended diversion via Varthur Road or Sarjapur Road. Activate adaptive signal cycling every 60s on ORR stretch. Alert BMTC to reroute buses via Whitefield Main Road.",
            "metadata": {"type": "incident", "location": "Marathahalli Bridge", "severity": "high"}
        },
        # Peak hour patterns
        {
            "content": "Morning peak pattern (7-10 AM): Silk Board Junction experiences 85-95% congestion. Electronic City traffic spills onto Hosur Road. Recommended pre-emptive action at 6:45 AM: Extend green phases by 20s on Hosur Road NS axis. At 7:30 AM, activate diversion signs directing traffic to Bannerghatta Road.",
            "metadata": {"type": "pattern", "location": "Silk Board", "time": "morning_rush"}
        },
        {
            "content": "Evening peak pattern (5-9 PM): Hebbal Flyover reaches 80-90% congestion. Airport-bound traffic conflicts with NH-44 corridor. Recommended action at 4:45 PM: Pre-emptively adjust Bellary Road signals. At 5:30 PM, activate Thanisandra Main Road as alternate corridor.",
            "metadata": {"type": "pattern", "location": "Hebbal Flyover", "time": "evening_rush"}
        },
        {
            "content": "KR Puram Bridge daily pattern: Persistent 70-80% congestion due to Old Madras Road bottleneck. Whitefield commuters cause secondary congestion at Tin Factory. Recommended: Stagger green phases between KR Puram and Tin Factory signals. Divert Whitefield traffic via Mahadevapura bypass during peak.",
            "metadata": {"type": "pattern", "location": "KR Puram", "time": "all_day"}
        },
        # Emergency protocols
        {
            "content": "Emergency vehicle protocol: When an ambulance approaches, activate green-wave corridor across 3-5 junctions. Cascade timing: 90s delay between each junction signal override. Duration per junction: 120s full green. Auto-terminate corridor after estimated travel time + 120s buffer. Log all overrides to audit trail.",
            "metadata": {"type": "emergency_protocol", "priority": "critical"}
        },
        {
            "content": "Fire engine corridor: Priority 1 emergency. Full green on all junctions in path. Pre-empt all pedestrian crossings. Side-street signals forced to red. Estimated inter-junction travel: 90s at emergency speed. Deploy traffic police to junction ahead of fire engine for manual clearance.",
            "metadata": {"type": "emergency_protocol", "priority": "critical"}
        },
        # Weather protocols
        {
            "content": "Heavy rainfall protocol for Bangalore: Reduce speed limits by 15 km/h on all flyovers (Hebbal, Silk Board, Electronic City). Extend yellow phase by 2s at all major intersections. Increase gap between green phases by 3s to prevent rear-end collisions. Alert: Koramangala and BTM Layout prone to waterlogging — activate diversions via elevated roads.",
            "metadata": {"type": "weather", "condition": "rain", "action": "safety"}
        },
        {
            "content": "Fog protocol: Visibility drops below 200m on NH-44 and Airport Road corridors during winter mornings (6-8 AM). Action: Reduce speed limits to 30 km/h. Extend signal cycles by 50%. Activate flashing amber mode on minor intersections. Alert BMTC and cab services.",
            "metadata": {"type": "weather", "condition": "fog", "action": "safety"}
        },
        # Signal optimization knowledge
        {
            "content": "Adaptive signal optimization for Outer Ring Road: The ORR stretch from Marathahalli to Sarjapur has 6 signal-controlled intersections. Optimal coordination: Green wave at 40 km/h during off-peak, 25 km/h during peak. Phase offset: 45s between consecutive signals. Dynamic adjustment based on upstream queue detection.",
            "metadata": {"type": "optimization", "location": "Outer Ring Road", "technique": "green_wave"}
        },
        {
            "content": "Koramangala signal strategy: Sony World Junction handles mixed traffic — auto-rickshaws (30%), two-wheelers (40%), cars (25%), buses (5%). Recommended phase allocation: NS axis 40s, EW axis 30s, dedicated right-turn phase 15s. Pedestrian phase: 20s integrated with left-turn movement.",
            "metadata": {"type": "optimization", "location": "Koramangala", "technique": "phase_allocation"}
        },
        # Diversion routes
        {
            "content": "Silk Board diversions when congestion exceeds 80%: Route 1: Hosur Road → Bannerghatta Road via Arekere (saves 12-18 min). Route 2: BTM 2nd Stage Inner Road (saves 8-12 min). Route 3: For Electronic City bound — NICE Road entry at Konappana Agrahara. Activate BMTC alternate bus route B-42.",
            "metadata": {"type": "diversion", "location": "Silk Board", "trigger": "congestion_80pct"}
        },
        {
            "content": "Hebbal diversions: Route 1: Bellary Road → Yeshwanthpur (saves 10-12 min). Route 2: Thanisandra Main Road to bypass flyover (saves 7-10 min). For airport traffic: Use Hennur Road → Yelahanka bypass during peak congestion. BMTC: Reroute Volvo buses via Nagawara.",
            "metadata": {"type": "diversion", "location": "Hebbal", "trigger": "congestion_80pct"}
        },
    ]

    print(f"Ingesting {len(scenarios)} scenarios into Supabase Vector Store...")
    
    success_count = 0
    for idx, scenario in enumerate(scenarios):
        try:
            print(f"Ingesting scenario {idx + 1}/{len(scenarios)}...")
            ingest_real_life_scenario(scenario["content"], scenario["metadata"])
            success_count += 1
        except Exception as e:
            print(f"Failed to ingest scenario {idx + 1}: {e}")

    print(f"Done! Successfully ingested {success_count} out of {len(scenarios)} scenarios.")

if __name__ == "__main__":
    # Ensure OPENAI_API_KEY and SUPABASE keys are present
    if not os.getenv("OPENAI_API_KEY"):
        print("WARNING: Missing OPENAI_API_KEY in .env — embeddings will use mock mode")
    populate_database()

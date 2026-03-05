import os
import numpy as np
import gymnasium as gym
from gymnasium import spaces
from stable_baselines3 import PPO
from supabase import create_client, Client

# Initialize Supabase client
url = os.environ.get("VITE_SUPABASE_URL", "")
key = os.environ.get("VITE_SUPABASE_ANON_KEY", "")

class HistoricalTrafficEnv(gym.Env):
    """
    A custom Gymnasium Environment that replays actual physical traffic 
    quadrant counts parsed by YOLO and stored in the PostgreSQL database.
    """
    def __init__(self, trace_data):
        super(HistoricalTrafficEnv, self).__init__()
        # Actions: 0 = North/South Green, 1 = East/West Green
        self.action_space = spaces.Discrete(2)
        
        # Max capacity per lane bounded
        self.observation_space = spaces.Box(low=0, high=500, shape=(4,), dtype=np.int32)
        
        self.trace_data = trace_data
        self.max_steps = len(self.trace_data) - 1
        self.time_step = 0
        self.state = np.zeros(4, dtype=np.int32)
        
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.time_step = 0
        if self.max_steps > 0:
            first_row = self.trace_data[0]
            self.state = np.array([first_row['north'], first_row['south'], first_row['east'], first_row['west']], dtype=np.int32)
        else:
            self.state = np.zeros(4, dtype=np.int32)
        return self.state, {}
        
    def step(self, action):
        self.time_step += 1
        
        # AI receives penalizations bounded by actual physical traffic counts recorded in Bengaluru
        reward = -int(np.sum(self.state))
        
        done = self.time_step >= self.max_steps
        truncated = False
        
        if not done:
            # Advance to the exact next recorded frame context
            next_row = self.trace_data[self.time_step]
            self.state = np.array([next_row['north'], next_row['south'], next_row['east'], next_row['west']], dtype=np.int32)
            
        return self.state, float(reward), done, truncated, {}

def run_retraining_pipeline():
    if not url or not key:
        print("CRITICAL: Supabase credentials missing. Cannot retrain agent on live dataset.")
        return
        
    supabase: Client = create_client(url, key)
    print("Connecting to Operational CityOS Database...")
    print("Fetching historical telemetry array from bounded timeline...")
    
    response = supabase.table("traffic_data").select("north, south, east, west").order("created_at", desc=False).limit(10000).execute()
    data = response.data
    
    if not data or len(data) < 100:
        print(f"Insufficient Epoch Data. Found {len(data) if data else 0} trajectory states. Require exactly >100 for PPO alignment.")
        return
        
    print(f"Ingested {len(data)} valid spatial trajectory states. Constructing Replay Buffer Environment...")
    env = HistoricalTrafficEnv(data)
    
    model_path = os.path.join(os.path.dirname(__file__), "ppo_traffic_model")
    
    if os.path.exists(model_path + ".zip"):
        print("Loading baseline PPO agent weights for Continuous Learning Alignment (Fine-Tuning)...")
        model = PPO.load(model_path, env=env)
    else:
        print("Proceeding with cold start alignment (Training from scratch)...")
        model = PPO("MlpPolicy", env, verbose=0)
        
    print("Beginning Agent Self-Training Optimization Loop (10,000 steps)...")
    model.learn(total_timesteps=10000)
    
    model.save(model_path)
    print(f"Self-Training Protocol ABSOLUTE SUCCESS! New synaptic agent weights merged & securely saved to {model_path}.zip")

if __name__ == "__main__":
    print("--- CITYOS REINFORCEMENT AGENT CONTINUOUS LEARNING PIPELINE ---")
    run_retraining_pipeline()

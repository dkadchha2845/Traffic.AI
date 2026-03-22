import gymnasium as gym
from gymnasium import spaces
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
import os

_MODEL = None
_MODEL_STATUS = {"loaded": False, "error": None, "path": None}

class TrafficIntersectionEnv(gym.Env):
    """
    Custom Environment that follows gym interface.
    Simulates a 4-way traffic intersection.
    """
    def __init__(self):
        super(TrafficIntersectionEnv, self).__init__()
        # Actions: 
        # 0 = North/South Green, East/West Red
        # 1 = North/South Red, East/West Green
        self.action_space = spaces.Discrete(2)
        
        # Observation: Queue lengths at the 4 lanes [North, South, East, West]
        # Max capacity per lane is nominally 100
        self.observation_space = spaces.Box(low=0, high=100, shape=(4,), dtype=np.int32)
        
        self.state = np.zeros(4, dtype=np.int32)
        self.time_step = 0
        self.max_steps = 200

    def step(self, action):
        self.time_step += 1
        
        # Arrivals (random influx of cars 0-3 per lane per step)
        arrivals = np.random.randint(0, 4, size=4)
        self.state += arrivals
        
        # Departures based on the action (green light)
        departures = np.zeros(4, dtype=np.int32)
        if action == 0:
            # North/South Green (Indices 0 and 1)
            departures[0] = min(self.state[0], 5) # Let up to 5 cars pass
            departures[1] = min(self.state[1], 5)
        elif action == 1:
            # East/West Green (Indices 2 and 3)
            departures[2] = min(self.state[2], 5)
            departures[3] = min(self.state[3], 5)
            
        self.state -= departures
        
        # Ensure state bounds
        self.state = np.clip(self.state, 0, 100)
        
        # Reward: minimize total wait time (negative sum of queue lengths)
        reward = -int(np.sum(self.state))
        
        # Penalty for extremely unbalanced wait times (fairness)
        variance_penalty = -int(np.var(self.state) * 0.1)
        reward += variance_penalty
        
        done = self.time_step >= self.max_steps
        truncated = False
        info = {}
        
        return self.state, float(reward), done, truncated, info

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.state = np.random.randint(0, 15, size=4).astype(np.int32)
        self.time_step = 0
        info = {}
        return self.state, info

def train_ppo_model(timesteps=5000):
    env = TrafficIntersectionEnv()
    # Check if env is compliant
    check_env(env)
    
    print("Training PPO Model on Traffic Intersection Environment...")
    model = PPO("MlpPolicy", env, verbose=0)
    model.learn(total_timesteps=timesteps)
    
    model_path = os.path.join(os.path.dirname(__file__), "ppo_traffic_model")
    model.save(model_path)
    print(f"Model trained and saved to {model_path}.zip")
    return model_path

def _get_model_path():
    return os.path.join(os.path.dirname(__file__), "ppo_traffic_model.zip")

def load_model():
    global _MODEL
    model_path = _get_model_path()
    _MODEL_STATUS["path"] = model_path
    if _MODEL is not None:
        return _MODEL
    if not os.path.exists(model_path):
        _MODEL_STATUS["loaded"] = False
        _MODEL_STATUS["error"] = f"Model file missing: {model_path}"
        return None
    try:
        _MODEL = PPO.load(model_path)
        _MODEL_STATUS["loaded"] = True
        _MODEL_STATUS["error"] = None
        return _MODEL
    except Exception as exc:
        _MODEL_STATUS["loaded"] = False
        _MODEL_STATUS["error"] = str(exc)
        return None

def get_model_status():
    return dict(_MODEL_STATUS)

def predict_action(observation):
    # observation = [North_Queue, South_Queue, East_Queue, West_Queue]
    model = load_model()
    if model is None:
        return 0 # Default fallback if model isn't trained yet
    # The model expects a batch or a single observation matching the box shape
    action, _states = model.predict(np.array(observation, dtype=np.int32), deterministic=True)
    return int(action)

if __name__ == "__main__":
    train_ppo_model(10000)

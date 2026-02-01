import requests
import os
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# --- City-Specific State Memory ---
_city_states = {}

# --- CACHING SYSTEM ---
_sensor_cache = {
    'data': None,
    'timestamp': None,
    'ttl': 4
}

def get_city_state(city):
    """Initialize state with stable starting values."""
    if city not in _city_states:
        _city_states[city] = {
            'pm25': random.uniform(25, 35),      # Start in "Moderate" range
            'noise': random.uniform(55, 65),     # Start in "Normal" range
            'wind': 12.0,
            # Trend Tracking
            'pm25_target': 30.0,                 # We now drift towards a 'Target'
            'trend_duration': 0
        }
    return _city_states[city]

def fetch_environmental_data(city="Thiruvananthapuram"):
    state = get_city_state(city)
    
    data = {
        "location": city,
        "pm25": 15.0,
        "wind_kph": 0,
        "wind_dir": "N",
        "noise": 50,
        "temp_c": 25.0,
        "humidity": 60,
        "aqi": 1,
        "timestamp": datetime.now().isoformat()
    }

    # Fetch Real Weather (Temperature/Humidity/Wind Dir only)
    weather_key = os.getenv("WEATHER_API_KEY")
    if weather_key:
        try:
            w_url = f"http://api.weatherapi.com/v1/current.json?key={weather_key}&q={city}&aqi=yes"
            response = requests.get(w_url, timeout=3)
            if response.status_code == 200:
                wx = response.json()
                data['wind_dir'] = wx['current']['wind_dir']
                data['temp_c'] = wx['current']['temp_c']
                data['humidity'] = wx['current']['humidity']
        except Exception as e:
            print(f"Weather API Error: {e}")

    # --- SMOOTH DYNAMIC DATA ---
    # We generate values that 'drift' rather than 'jump'
    data['wind_kph'] = generate_smooth_wind(state)
    data['pm25'] = generate_smooth_pm25(state)
    data['noise'] = generate_smooth_noise(state)
    
    return data

# --- SMOOTH GENERATORS (Fixes the Risk Score Jumps) ---

def generate_smooth_pm25(state):
    """
    Gradually drifts PM2.5 towards a target value.
    Prevents instant 10->50 jumps.
    """
    # 1. Pick a new target if we reached the old one or time is up
    if state['trend_duration'] <= 0 or abs(state['pm25'] - state['pm25_target']) < 1:
        # Pick a target between 15 (Clean) and 80 (Polluted)
        state['pm25_target'] = random.uniform(15, 80)
        # Take 10-20 updates to get there (Slow drift)
        state['trend_duration'] = random.randint(10, 20)
    
    state['trend_duration'] -= 1
    
    # 2. Smoothly move 5% of the way to the target per update
    # This creates a realistic curve
    current = state['pm25']
    target = state['pm25_target']
    
    new_val = current + (target - current) * 0.05
    
    # Add tiny jitter (breathing effect) so it's not robotic
    new_val += random.uniform(-0.5, 0.5)
    
    state['pm25'] = max(5, min(300, new_val))
    return round(state['pm25'], 1)

def generate_smooth_wind(state):
    """
    Wind changes slowly, with occasional gusts that fade out.
    """
    # Small random drift
    change = random.uniform(-0.5, 0.5)
    
    # Gust event (Smooth rise)
    target = state['wind'] + change
    
    # Apply smoothing (Inertia)
    state['wind'] = (state['wind'] * 0.9) + (target * 0.1)
    
    # Physics check
    state['wind'] = max(2, min(40, state['wind']))
    return round(state['wind'], 1)

def generate_smooth_noise(state):
    """
    Noise is naturally jumpy, but we dampen the jump size 
    so the Risk Score doesn't panic.
    """
    # Base fluctuation is small (±1 dB)
    change = random.uniform(-1, 1)
    
    # Occasional car pass (Smooth spike)
    if random.random() < 0.15:
        change += random.uniform(2, 4) # Reduced from 15 to 4
        
    new_val = state['noise'] + change
    
    # Pull back to 'Base Noise Level' (e.g., 60dB)
    # This prevents it from drifting to 100dB forever
    base_level = 60
    new_val = new_val * 0.95 + base_level * 0.05
    
    state['noise'] = max(40, min(85, new_val))
    return int(state['noise'])

# --- MAP ENRICHMENT ---
SENSOR_PROFILES = {
    "industrial": {"pm25_multiplier": 1.2, "pm25_offset": 10, "noise_offset": 5},
    "traffic": {"pm25_multiplier": 1.1, "pm25_offset": 5, "noise_offset": 10},
    "residential": {"pm25_multiplier": 0.9, "pm25_offset": -2, "noise_offset": -5},
    "environmental": {"pm25_multiplier": 0.6, "pm25_offset": -10, "noise_offset": -10}
}

def enrich_sensor_network(sensors_list):
    """
    Injects live data into map pins.
    """
    now = datetime.now()
    if (_sensor_cache['data'] is not None and 
        _sensor_cache['timestamp'] is not None):
        time_diff = (now - _sensor_cache['timestamp']).total_seconds()
        if time_diff < _sensor_cache['ttl']:
            return _sensor_cache['data']
    
    enriched_sensors = []
    region_weather_cache = {}

    for sensor in sensors_list:
        city = sensor.get("location", "Thiruvananthapuram")
        
        if city not in region_weather_cache:
            region_weather_cache[city] = fetch_environmental_data(city)
            
        baseline = region_weather_cache[city]
        stype = sensor.get("type", "residential")
        profile = SENSOR_PROFILES.get(stype, SENSOR_PROFILES["residential"])
        
        base_pm = baseline.get("pm25", 30)
        base_noise = baseline.get("noise", 60)
        
        jitter = random.uniform(-1, 1)
        
        sensor["pm25"] = round((base_pm * profile["pm25_multiplier"]) + profile["pm25_offset"] + jitter, 1)
        sensor["noise"] = int(base_noise + profile["noise_offset"] + jitter)
        
        # Clamp
        sensor["pm25"] = max(5, sensor["pm25"])
        sensor["noise"] = max(40, sensor["noise"])
        
        sensor["temp"] = baseline.get("temp_c", 30)
        sensor["wind_kph"] = baseline.get("wind_kph", 10)
        
        # Updated Status Logic (Matches Smoothing)
        sensor["status"] = "active"
        if sensor["pm25"] > 60: sensor["status"] = "Warning"
        if sensor["pm25"] > 100: sensor["status"] = "Critical"
            
        enriched_sensors.append(sensor)
    
    _sensor_cache['data'] = enriched_sensors
    _sensor_cache['timestamp'] = now
    
    return enriched_sensors
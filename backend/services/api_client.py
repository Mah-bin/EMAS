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
            # Trend Tracking - NOW WITH MORE MOVEMENT
            'pm25_target': 30.0,
            'noise_target': 60.0,
            'wind_target': 12.0,
            'trend_duration': 0,
            'update_count': 0  # Track updates for periodic shifts
        }
    return _city_states[city]

def fetch_environmental_data(city="Thiruvananthapuram"):
    state = get_city_state(city)
    
    # Increment update counter
    state['update_count'] += 1
    
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

    # --- SMOOTH BUT VISIBLE DYNAMIC DATA ---
    data['wind_kph'] = generate_smooth_wind(state)
    data['pm25'] = generate_smooth_pm25(state)
    data['noise'] = generate_smooth_noise(state)
    
    return data

# --- ENHANCED SMOOTH GENERATORS (More Visible Changes) ---

def generate_smooth_pm25(state):
    """
    Gradually drifts PM2.5 with MORE VISIBLE changes.
    Creates clear upward/downward trends for the chart.
    """
    # 1. Create periodic "events" every 6-10 updates (30-50 seconds)
    if state['trend_duration'] <= 0 or abs(state['pm25'] - state['pm25_target']) < 2:
        # Pick a more dramatic target for visible change
        current_hour = datetime.now().hour
        
        # Time-based patterns for realism
        if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
            # Rush hour - higher pollution
            state['pm25_target'] = random.uniform(40, 70)
        elif 22 <= current_hour or current_hour <= 5:
            # Night - lower pollution
            state['pm25_target'] = random.uniform(15, 30)
        else:
            # Normal day - varied
            state['pm25_target'] = random.uniform(25, 50)
        
        # Take 6-10 updates to reach target (visible trend on chart)
        state['trend_duration'] = random.randint(6, 10)
    
    state['trend_duration'] -= 1
    
    # 2. Move 15% of the way to target (INCREASED from 5%)
    # This creates visible trends on the chart
    current = state['pm25']
    target = state['pm25_target']
    
    step_size = (target - current) * 0.15
    new_val = current + step_size
    
    # 3. Add visible jitter (INCREASED from ±0.5 to ±2)
    # This prevents flat lines between major changes
    new_val += random.uniform(-2, 2)
    
    # 4. Occasional spike events (pollution incidents)
    if random.random() < 0.05:  # 5% chance per update
        spike = random.uniform(5, 15)
        new_val += spike
        print(f"💨 Pollution spike in {state.get('city', 'city')}: +{spike:.1f} PM2.5")
    
    state['pm25'] = max(5, min(150, new_val))
    return round(state['pm25'], 1)

def generate_smooth_wind(state):
    """
    Wind with MORE VISIBLE changes and periodic gusts.
    """
    # Create wind pattern every 8-12 updates
    if state['update_count'] % random.randint(8, 12) == 0:
        state['wind_target'] = random.uniform(5, 25)
    
    # Move 20% towards target (INCREASED from 10%)
    current = state['wind']
    target = state['wind_target']
    
    step = (target - current) * 0.20
    new_val = current + step
    
    # Add visible variation (±1.5 instead of ±0.5)
    new_val += random.uniform(-1.5, 1.5)
    
    # Occasional gusts
    if random.random() < 0.08:  # 8% chance
        gust = random.uniform(5, 10)
        new_val += gust
        print(f"💨 Wind gust: +{gust:.1f} km/h")
    
    state['wind'] = max(2, min(40, new_val))
    return round(state['wind'], 1)

def generate_smooth_noise(state):
    """
    Noise with MORE VISIBLE fluctuations.
    Creates clear peaks and valleys on the chart.
    """
    # Create noise pattern every 5-8 updates
    if state['update_count'] % random.randint(5, 8) == 0:
        # Pick new base level
        current_hour = datetime.now().hour
        if 8 <= current_hour <= 20:
            state['noise_target'] = random.uniform(58, 72)  # Daytime
        else:
            state['noise_target'] = random.uniform(45, 55)  # Nighttime
    
    # Move 25% towards target (INCREASED from implied 5%)
    current = state['noise']
    target = state['noise_target']
    
    step = (target - current) * 0.25
    new_val = current + step
    
    # Add visible jitter (±2 instead of ±1)
    new_val += random.uniform(-2, 2)
    
    # Traffic/Activity spikes (more frequent)
    if random.random() < 0.12:  # 12% chance (increased from implied 15%)
        spike = random.uniform(5, 12)  # Visible spike
        new_val += spike
    
    state['noise'] = max(40, min(90, new_val))
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
        
        # Updated Status Logic
        sensor["status"] = "active"
        if sensor["pm25"] > 60: sensor["status"] = "Warning"
        if sensor["pm25"] > 100: sensor["status"] = "Critical"
            
        enriched_sensors.append(sensor)
    
    _sensor_cache['data'] = enriched_sensors
    _sensor_cache['timestamp'] = now
    
    return enriched_sensors
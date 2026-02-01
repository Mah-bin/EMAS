def calculate_risk(data):
    """
    Implements correlation detection and risk scoring with environmental factors.
    Enhanced version with contextual alert generation for Kerala's industrial zones.
    """
    score = 0
    alerts = []
    
    # Extract values
    pm25 = data.get('pm25', 0)
    temp = data.get('temp_c', 25)
    humidity = data.get('humidity', 60)
    aqi = data.get('aqi', 1)
    wind_kph = data.get('wind_kph', 0)
    wind_dir = data.get('wind_dir', 'N')
    noise = data.get('noise', 0)
    
    # Air Quality Check (PM2.5) - Critical for industrial zones
    if pm25 > 55:
        score += 40
        alerts.append(f"🚨 CRITICAL: PM2.5 at {pm25:.1f} µg/m³ (Hazardous - Avoid outdoor activity)")
    elif pm25 > 35:
        score += 30
        alerts.append(f"⚠️ UNHEALTHY: PM2.5 at {pm25:.1f} µg/m³ (Sensitive groups should limit exposure)")
    elif pm25 > 25:
        score += 15
        alerts.append(f"⚠️ Moderate: PM2.5 at {pm25:.1f} µg/m³ (Consider reducing prolonged outdoor activity)")

    # Temperature Risk - Kerala climate considerations
    if temp > 38:
        score += 30
        alerts.append(f"🌡️ EXTREME HEAT: {temp}°C - Heat stroke risk HIGH")
    elif temp > 35:
        score += 20
        alerts.append(f"🌡️ Very Hot: {temp}°C - Stay hydrated, avoid midday sun")
    elif temp > 32:
        score += 10
        alerts.append(f"🌡️ Hot conditions: {temp}°C - Monitor vulnerable populations")

    # Humidity Risk - High humidity amplifies heat stress
    if humidity > 85:
        score += 20
        alerts.append(f"💧 Very high humidity: {humidity}% - Heat index significantly elevated")
    elif humidity > 75:
        score += 10

    # AQI Risk - US EPA Index
    if aqi >= 5:
        score += 40
        alerts.append("☢️ AIR QUALITY HAZARDOUS: Everyone should avoid outdoor activity")
    elif aqi >= 4:
        score += 30
        alerts.append("🔴 AIR QUALITY UNHEALTHY: Health alert for all groups")
    elif aqi >= 3:
        score += 20
        alerts.append("🟠 AIR QUALITY UNHEALTHY for sensitive groups")

    # CORRELATION LOGIC 1: High PM2.5 + Wind Direction
    # Helps identify pollution source direction
    if pm25 > 25:
        if wind_kph > 20:
            score += 25
            alerts.append(f"🌬️ POLLUTION SPREAD RISK: High winds ({wind_kph:.1f} km/h) from {wind_dir} may be dispersing pollutants from industrial areas")
        elif wind_kph > 10:
            score += 15
            alerts.append(f"🌬️ Pollution transport: Moderate winds ({wind_kph:.1f} km/h) from {wind_dir} direction")
        elif wind_kph < 5:
            score += 10
            alerts.append(f"⚠️ Stagnant air: Low wind speed ({wind_kph:.1f} km/h) - Pollutants accumulating")

    # CORRELATION LOGIC 2: High Temp + High Humidity (Heat Index)
    if temp > 32 and humidity > 75:
        score += 25
        # Calculate approximate heat index
        heat_index = temp + (0.5 * (humidity - 50))
        alerts.append(f"🥵 HEAT INDEX WARNING: Feels like {heat_index:.0f}°C - Dangerous heat stress conditions")

    # CORRELATION LOGIC 3: High PM2.5 + Low Wind (Stagnation)
    if pm25 > 35 and wind_kph < 5:
        score += 20
        alerts.append("⚠️ STAGNATION EVENT: Low wind + high pollution = air quality deteriorating rapidly")

    # Noise Factor - Industrial/Traffic zones
    if noise > 85:
        score += 35
        alerts.append(f"🔊 HAZARDOUS NOISE: {noise} dB - Hearing damage risk, use protection")
    elif noise > 75:
        score += 25
        alerts.append(f"🔊 EXCESSIVE NOISE: {noise} dB - Prolonged exposure harmful (industrial/traffic zone)")
    elif noise > 70:
        score += 15
        alerts.append(f"🔊 Elevated noise: {noise} dB - May cause stress and sleep disruption")

    # CORRELATION LOGIC 4: Multiple factors (Compounding risk)
    if pm25 > 35 and noise > 75:
        score += 15
        alerts.append("⚠️ MULTI-FACTOR ALERT: High pollution + noise exposure - Limit time in affected area")

    # CORRELATION LOGIC 5: AQI + Temperature (Respiratory stress)
    if aqi >= 3 and temp > 35:
        score += 20
        alerts.append("🌡️☢️ COMPOUND RISK: Poor air quality + extreme heat = severe respiratory stress")

    # Specific recommendations based on risk level
    if score >= 70:
        alerts.append("🚨 RECOMMENDATION: STAY INDOORS. Close windows. Use air purification if available.")
    elif score >= 50:
        alerts.append("⚠️ RECOMMENDATION: Limit outdoor activities. Vulnerable groups stay indoors.")
    elif score >= 30:
        alerts.append("ℹ️ RECOMMENDATION: Monitor conditions. Reduce strenuous outdoor activities.")

    # Return the score (capped at 100) and the contextual alerts
    return min(score, 100), alerts
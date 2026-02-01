# Overview
EMAS is a full-stack environmental monitoring platform for communities near industrial zones in Kerala, India. It integrates real-time data from multiple sources, performs correlation analysis to identify pollution sources, and provides intelligent alerts with citizen participation features.
Key Features:

- Real-time monitoring (PM2.5, noise, temperature, humidity, wind)

- Interactive dashboard with trend analysis

- Live map with 22 sensor locations across Kerala

- Smart risk scoring (0-100) with contextual alerts

- Citizen reporting with auto-validation

- Correlation detection (PM2.5 + wind, temp + humidity, etc.)

## Tech Stack

- Backend: FastAPI • Python • SQLite • WeatherAPI

- Frontend: React • Leaflet Maps • Chart.js
  
- Features: Auto-logging • REST API • Time-series database

## Key Features Explained

1. Multi-Source Data Integration

- WeatherAPI.com for temperature, humidity, wind
  
- Simulated PM2.5 and noise sensors
  
- Smooth data algorithms prevent erratic readings

2. Intelligent Risk Scoring

- Multi-factor analysis (PM2.5, temp, humidity, noise, wind)

- 4 risk levels: Low (0-29), Moderate (30-49), High (50-69), Critical (70-100)

- Contextual alerts with actionable recommendations

3. Correlation Detection
 
- PM2.5 + Wind → Identifies pollution source direction

- Temp + Humidity → Heat index calculation

- PM2.5 + Low Wind → Stagnation event detection

- Multi-Factor → Compound risk warnings

4. Citizen Participation

- Submit reports with photo evidence
  
- Auto-validation against sensor data
  
- Upvote/downvote system for credibility
  
- Statistics dashboard

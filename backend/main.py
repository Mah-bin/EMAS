import json
import os
import base64
from datetime import datetime
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional

# Import your custom services
from services.api_client import fetch_environmental_data
from risk_engine import calculate_risk
from database import (
    init_db, log_reading, get_history,
    submit_citizen_report, get_citizen_reports, validate_citizen_report,
    update_report_votes, submit_alert_validation, get_alert_validations,
    get_report_statistics
)

# Lifespan: Handles startup and shutdown tasks
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This runs when the server starts
    print("🚀 Starting Environmental Monitoring System...")
    init_db()
    print("✅ Database initialized and system ready!")
    yield
    # This runs when the server stops
    print("🛑 Shutting down system...")

app = FastAPI(
    title="Environmental Monitoring API",
    description="Real-time environmental monitoring with risk analysis",
    version="1.0.0",
    lifespan=lifespan
)

# CORS: Allow Frontend to communicate with Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ENDPOINTS ---

@app.get("/")
def root():
    """API health check endpoint"""
    return {
        "message": "Environmental Monitoring API is Active",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/api/monitor")
def monitor(city: str = "Kozhikode"):
    """
    Fetches live environmental data, calculates risk, and logs to database.
    
    Query Parameters:
    - city: Location to monitor (default: Kozhikode)
    """
    try:
        # Fetch environmental data
        data = fetch_environmental_data(city)
        
        # Calculate risk score and alerts
        score, alerts = calculate_risk(data)
        
        # Save to database for historical trends
        log_reading(data, score)
        
        return {
            "status": "success",
            "timestamp": data.get("timestamp"),
            "location": data.get("location", city),
            "current": {
                "temperature": data.get("temp_c"),
                "humidity": data.get("humidity"),
                "pm25": data.get("pm25"),
                "aqi": data.get("aqi"),
                "wind_speed": data.get("wind_kph"),
                "wind_direction": data.get("wind_dir"),
                "noise": data.get("noise")
            },
            "risk_assessment": {
                "score": score,
                "level": get_risk_level(score),
                "alerts": alerts
            }
        }
    except Exception as e:
        print(f"❌ Error in monitor endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
def history(limit: int = 24):
    """
    Returns historical readings for trend analysis.
    
    Query Parameters:
    - limit: Number of records to return (default: 24)
    """
    try:
        records = get_history(limit)
        return {
            "status": "success",
            "count": len(records),
            "data": records
        }
    except Exception as e:
        print(f"❌ Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sensors")
def get_sensors():
    """
    Returns sensor locations for map visualization with real-time enriched data.
    Reads from data/mock_sensors.json and enriches with live PM2.5 and Noise values.
    """
    file_path = os.path.join(os.path.dirname(__file__), "..", "data", "mock_sensors.json")
    try:
        with open(file_path, "r") as f:
            sensors = json.load(f)
            # Import the enrich function from api_client
            from services.api_client import enrich_sensor_network
            # Enrich sensors with real-time data
            enriched_sensors = enrich_sensor_network(sensors)
            return {
                "status": "success",
                "count": len(enriched_sensors),
                "sensors": enriched_sensors
            }
    except FileNotFoundError:
        # Return default sensor if file not found
        default_sensor = [{
            "id": "sensor_default",
            "name": "Primary Station",
            "lat": 11.2588,
            "lon": 75.7804,
            "type": "multi-sensor",
            "status": "active"
        }]
        return {
            "status": "warning",
            "message": "mock_sensors.json not found, using default",
            "count": 1,
            "sensors": default_sensor
        }

@app.get("/api/correlations")
def get_correlations():
    """
    Analyzes correlations between environmental factors.
    """
    try:
        records = get_history(24)
        
        if len(records) < 2:
            return {
                "status": "insufficient_data",
                "message": "Need at least 2 data points for correlation analysis"
            }
        
        # Calculate correlations (simplified Pearson correlation)
        correlations = calculate_correlations(records)
        
        return {
            "status": "success",
            "correlations": correlations,
            "sample_size": len(records)
        }
    except Exception as e:
        print(f"❌ Error calculating correlations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Helper Functions ---

def get_risk_level(score):
    """Convert risk score to readable level"""
    if score >= 70:
        return "Critical"
    elif score >= 50:
        return "High"
    elif score >= 30:
        return "Moderate"
    else:
        return "Low"

def calculate_correlations(records):
    """Calculate correlations between environmental metrics"""
    if len(records) < 2:
        return {}
    
    # Extract data series
    pm25_values = [r['pm25'] for r in records if r['pm25'] is not None]
    wind_values = [r['wind_kph'] for r in records if r['wind_kph'] is not None]
    noise_values = [r['noise'] for r in records if r['noise'] is not None]
    
    def pearson_correlation(x, y):
        """Calculate Pearson correlation coefficient"""
        if len(x) != len(y) or len(x) < 2:
            return 0.0
        
        n = len(x)
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))
        sum_x2 = sum(xi * xi for xi in x)
        sum_y2 = sum(yi * yi for yi in y)
        
        numerator = n * sum_xy - sum_x * sum_y
        denominator = ((n * sum_x2 - sum_x ** 2) * (n * sum_y2 - sum_y ** 2)) ** 0.5
        
        if denominator == 0:
            return 0.0
        
        return numerator / denominator
    
    # Calculate all correlations
    min_len = min(len(pm25_values), len(wind_values), len(noise_values))
    
    return {
        "pm25_wind": round(pearson_correlation(pm25_values[:min_len], wind_values[:min_len]), 3),
        "pm25_noise": round(pearson_correlation(pm25_values[:min_len], noise_values[:min_len]), 3),
        "wind_noise": round(pearson_correlation(wind_values[:min_len], noise_values[:min_len]), 3)
    }

# ===== CITIZEN PARTICIPATION ENDPOINTS =====

# Pydantic models for request validation
class CitizenReportModel(BaseModel):
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    report_type: str  # 'smoke', 'odor', 'noise', 'other'
    severity: int  # 1-5 scale
    description: Optional[str] = None
    photo_base64: Optional[str] = None  # Base64 encoded image
    citizen_name: Optional[str] = None
    citizen_contact: Optional[str] = None

class AlertValidationModel(BaseModel):
    alert_id: int
    validation_type: str  # 'confirm', 'deny', 'unsure'
    location: str
    citizen_comment: Optional[str] = None

@app.post("/api/citizen/report")
async def create_citizen_report(report: CitizenReportModel):
    """
    Submit a new citizen report about environmental issues.
    Supports smoke, odor, noise, and other pollution reports.
    """
    try:
        # Handle photo if provided
        photo_path = None
        if report.photo_base64:
            # Create uploads directory if it doesn't exist
            upload_dir = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            photo_filename = f"report_{timestamp}.jpg"
            photo_path = os.path.join(upload_dir, photo_filename)
            
            # Decode and save base64 image
            try:
                image_data = base64.b64decode(report.photo_base64.split(',')[-1])
                with open(photo_path, 'wb') as f:
                    f.write(image_data)
                photo_path = f"uploads/{photo_filename}"  # Store relative path
            except Exception as e:
                print(f"Error saving photo: {e}")
                photo_path = None
        
        # Prepare report data
        report_data = {
            'location': report.location,
            'latitude': report.latitude,
            'longitude': report.longitude,
            'report_type': report.report_type,
            'severity': report.severity,
            'description': report.description,
            'photo_path': photo_path,
            'citizen_name': report.citizen_name,
            'citizen_contact': report.citizen_contact
        }
        
        # Save to database
        report_id = submit_citizen_report(report_data)
        
        # Auto-validate if sensor data correlates
        auto_validation = check_report_against_sensors(report)
        
        return {
            "status": "success",
            "message": "Report submitted successfully",
            "report_id": report_id,
            "auto_validation": auto_validation
        }
    except Exception as e:
        print(f"❌ Error creating citizen report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/citizen/reports")
def get_reports(location: Optional[str] = None, status: Optional[str] = None, limit: int = 50):
    """
    Get citizen reports with optional filters.
    
    Query Parameters:
    - location: Filter by city/district
    - status: Filter by status (pending, validated, resolved, dismissed)
    - limit: Maximum number of reports to return
    """
    try:
        reports = get_citizen_reports(location=location, status=status, limit=limit)
        return {
            "status": "success",
            "count": len(reports),
            "reports": reports
        }
    except Exception as e:
        print(f"❌ Error fetching reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/citizen/report/{report_id}/vote")
def vote_on_report(report_id: int, upvote: bool = True):
    """
    Upvote or downvote a citizen report.
    
    Path Parameters:
    - report_id: ID of the report
    
    Query Parameters:
    - upvote: True for upvote, False for downvote
    """
    try:
        votes = update_report_votes(report_id, upvote=upvote)
        return {
            "status": "success",
            "report_id": report_id,
            "votes": votes
        }
    except Exception as e:
        print(f"❌ Error updating votes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/citizen/validate-alert")
def validate_alert(validation: AlertValidationModel):
    """
    Citizen validation of a system-generated alert.
    Helps improve alert accuracy and builds community trust.
    """
    try:
        validation_id = submit_alert_validation(
            alert_id=validation.alert_id,
            validation_type=validation.validation_type,
            location=validation.location,
            citizen_comment=validation.citizen_comment
        )
        
        return {
            "status": "success",
            "message": "Thank you for validating this alert!",
            "validation_id": validation_id
        }
    except Exception as e:
        print(f"❌ Error submitting validation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/citizen/statistics")
def get_citizen_statistics(location: Optional[str] = None):
    """
    Get statistics about citizen participation.
    
    Query Parameters:
    - location: Optional location filter
    """
    try:
        stats = get_report_statistics(location=location)
        return {
            "status": "success",
            "location": location or "All regions",
            "statistics": stats
        }
    except Exception as e:
        print(f"❌ Error fetching statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper function for auto-validation
def check_report_against_sensors(report: CitizenReportModel):
    """
    Check if a citizen report correlates with current sensor data.
    Returns validation status and correlation score.
    """
    try:
        # Fetch current sensor data for the reported location
        sensor_data = fetch_environmental_data(report.location)
        
        correlation_found = False
        validation_notes = []
        
        # Check smoke/odor reports against PM2.5
        if report.report_type in ['smoke', 'odor']:
            pm25 = sensor_data.get('pm25', 0)
            if pm25 > 35:  # Moderate or higher
                correlation_found = True
                validation_notes.append(f"Sensors confirm elevated PM2.5: {pm25:.1f} µg/m³")
        
        # Check noise reports against noise sensors
        if report.report_type == 'noise':
            noise = sensor_data.get('noise', 0)
            if noise > 70:  # Above normal
                correlation_found = True
                validation_notes.append(f"Sensors confirm elevated noise: {noise} dB")
        
        # Auto-validate if correlation found
        if correlation_found and report.severity >= 3:
            # This would call validate_citizen_report after report creation
            return {
                "validated": True,
                "confidence": "high",
                "notes": " | ".join(validation_notes)
            }
        
        return {
            "validated": False,
            "confidence": "pending",
            "notes": "Awaiting manual review or additional sensor correlation"
        }
        
    except Exception as e:
        print(f"Error in auto-validation: {e}")
        return {"validated": False, "confidence": "error", "notes": str(e)}

# Run with: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
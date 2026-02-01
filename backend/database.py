import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "environmental.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "schema.sql")

def init_db():
    """Initialize the database with schema"""
    # Ensure the data folder exists
    data_dir = os.path.dirname(DB_PATH)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
    
    # Connect to the SQLite file
    conn = sqlite3.connect(DB_PATH)
    
    # Read and Execute the schema.sql file
    try:
        with open(SCHEMA_PATH, 'r') as f:
            conn.executescript(f.read())
        print("✅ Database initialized successfully")
    except FileNotFoundError:
        print(f"⚠️  schema.sql not found at {SCHEMA_PATH}")
        # Create tables manually if schema file not found
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                pm25 REAL,
                wind_kph REAL,
                wind_dir TEXT,
                noise REAL,
                risk_score INTEGER,
                alert_triggered BOOLEAN
            );
            
            CREATE TABLE IF NOT EXISTS citizen_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                location TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                report_type TEXT NOT NULL,
                severity INTEGER NOT NULL,
                description TEXT,
                photo_path TEXT,
                citizen_name TEXT,
                citizen_contact TEXT,
                status TEXT DEFAULT 'pending',
                validated_by_sensor BOOLEAN DEFAULT 0,
                validation_timestamp TEXT,
                validation_notes TEXT,
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS alert_validations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id INTEGER,
                timestamp TEXT NOT NULL,
                validation_type TEXT NOT NULL,
                citizen_comment TEXT,
                location TEXT NOT NULL
            );
        """)
        print("✅ Created tables manually")
        
    conn.commit()
    conn.close()

def log_reading(data, risk_score):
    """Save a new reading to the database"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Determine if alert should be triggered (score >= 50)
    alert_triggered = risk_score >= 50
    
    c.execute(
        "INSERT INTO history (timestamp, pm25, wind_kph, wind_dir, noise, risk_score, alert_triggered) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            datetime.now().isoformat(), 
            data.get('pm25'), 
            data.get('wind_kph'),
            data.get('wind_dir'),
            data.get('noise'), 
            risk_score,
            alert_triggered
        )
    )
    conn.commit()
    conn.close()

def get_history(limit=24):
    """Fetch past readings for trend analysis"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(f"SELECT * FROM history ORDER BY timestamp DESC LIMIT {limit}")
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows

# ===== CITIZEN PARTICIPATION FUNCTIONS =====

def submit_citizen_report(report_data):
    """
    Submit a new citizen report
    
    Args:
        report_data (dict): Report information containing:
            - location, latitude, longitude
            - report_type, severity, description
            - photo_path (optional)
            - citizen_name, citizen_contact (optional)
    
    Returns:
        int: ID of the created report
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute("""
        INSERT INTO citizen_reports 
        (timestamp, location, latitude, longitude, report_type, severity, 
         description, photo_path, citizen_name, citizen_contact, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    """, (
        datetime.now().isoformat(),
        report_data.get('location'),
        report_data.get('latitude'),
        report_data.get('longitude'),
        report_data.get('report_type'),
        report_data.get('severity'),
        report_data.get('description'),
        report_data.get('photo_path'),
        report_data.get('citizen_name'),
        report_data.get('citizen_contact')
    ))
    
    report_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return report_id

def get_citizen_reports(location=None, status=None, limit=50):
    """
    Fetch citizen reports with optional filters
    
    Args:
        location (str): Filter by location
        status (str): Filter by status (pending, validated, resolved, dismissed)
        limit (int): Maximum number of reports to return
    
    Returns:
        list: List of report dictionaries
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    query = "SELECT * FROM citizen_reports WHERE 1=1"
    params = []
    
    if location:
        query += " AND location = ?"
        params.append(location)
    
    if status:
        query += " AND status = ?"
        params.append(status)
    
    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)
    
    c.execute(query, params)
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    
    return rows

def validate_citizen_report(report_id, validated_by_sensor=False, validation_notes=None):
    """
    Validate a citizen report (either by sensor data or manual review)
    
    Args:
        report_id (int): ID of the report to validate
        validated_by_sensor (bool): Whether validation came from sensor correlation
        validation_notes (str): Notes about the validation
    
    Returns:
        bool: Success status
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute("""
        UPDATE citizen_reports 
        SET status = 'validated',
            validated_by_sensor = ?,
            validation_timestamp = ?,
            validation_notes = ?
        WHERE id = ?
    """, (validated_by_sensor, datetime.now().isoformat(), validation_notes, report_id))
    
    success = c.rowcount > 0
    conn.commit()
    conn.close()
    
    return success

def update_report_votes(report_id, upvote=True):
    """
    Update upvotes or downvotes for a citizen report
    
    Args:
        report_id (int): ID of the report
        upvote (bool): True for upvote, False for downvote
    
    Returns:
        dict: Updated vote counts
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    field = "upvotes" if upvote else "downvotes"
    c.execute(f"UPDATE citizen_reports SET {field} = {field} + 1 WHERE id = ?", (report_id,))
    
    c.execute("SELECT upvotes, downvotes FROM citizen_reports WHERE id = ?", (report_id,))
    result = dict(c.fetchone())
    
    conn.commit()
    conn.close()
    
    return result

def submit_alert_validation(alert_id, validation_type, location, citizen_comment=None):
    """
    Submit citizen validation of a system alert
    
    Args:
        alert_id (int): ID of the alert being validated
        validation_type (str): 'confirm', 'deny', or 'unsure'
        location (str): Location of the citizen
        citizen_comment (str): Optional comment
    
    Returns:
        int: ID of the validation record
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute("""
        INSERT INTO alert_validations 
        (alert_id, timestamp, validation_type, citizen_comment, location)
        VALUES (?, ?, ?, ?, ?)
    """, (alert_id, datetime.now().isoformat(), validation_type, citizen_comment, location))
    
    validation_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return validation_id

def get_alert_validations(alert_id=None):
    """
    Get alert validations, optionally filtered by alert_id
    
    Args:
        alert_id (int): Optional alert ID to filter by
    
    Returns:
        list: List of validation records
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if alert_id:
        c.execute("SELECT * FROM alert_validations WHERE alert_id = ? ORDER BY timestamp DESC", (alert_id,))
    else:
        c.execute("SELECT * FROM alert_validations ORDER BY timestamp DESC LIMIT 100")
    
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    
    return rows

def get_report_statistics(location=None):
    """
    Get statistics about citizen reports
    
    Args:
        location (str): Optional location filter
    
    Returns:
        dict: Statistics including counts by type and status
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    location_filter = f"WHERE location = '{location}'" if location else ""
    
    # Count by type
    c.execute(f"""
        SELECT report_type, COUNT(*) as count 
        FROM citizen_reports {location_filter}
        GROUP BY report_type
    """)
    by_type = {row['report_type']: row['count'] for row in c.fetchall()}
    
    # Count by status
    c.execute(f"""
        SELECT status, COUNT(*) as count 
        FROM citizen_reports {location_filter}
        GROUP BY status
    """)
    by_status = {row['status']: row['count'] for row in c.fetchall()}
    
    # Get total and recent (last 24h)
    c.execute(f"SELECT COUNT(*) as total FROM citizen_reports {location_filter}")
    total = c.fetchone()['total']
    
    c.execute(f"""
        SELECT COUNT(*) as recent 
        FROM citizen_reports 
        {location_filter}
        {'AND' if location else 'WHERE'} timestamp >= datetime('now', '-1 day')
    """)
    recent = c.fetchone()['recent']
    
    conn.close()
    
    return {
        'total': total,
        'recent_24h': recent,
        'by_type': by_type,
        'by_status': by_status
    }
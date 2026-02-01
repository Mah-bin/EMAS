-- Environmental Monitoring System Schema
-- Enhanced with Citizen Participation Layer

-- Existing history table
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

-- Index for faster time-series querying
CREATE INDEX IF NOT EXISTS idx_timestamp ON history(timestamp);

-- NEW: Citizen Reports Table
CREATE TABLE IF NOT EXISTS citizen_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    report_type TEXT NOT NULL,  -- 'smoke', 'odor', 'noise', 'other'
    severity INTEGER NOT NULL,  -- 1-5 scale
    description TEXT,
    photo_path TEXT,  -- Path to uploaded photo
    citizen_name TEXT,
    citizen_contact TEXT,
    status TEXT DEFAULT 'pending',  -- 'pending', 'validated', 'resolved', 'dismissed'
    validated_by_sensor BOOLEAN DEFAULT 0,
    validation_timestamp TEXT,
    validation_notes TEXT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0
);

-- Index for faster querying by location and type
CREATE INDEX IF NOT EXISTS idx_location ON citizen_reports(location);
CREATE INDEX IF NOT EXISTS idx_report_type ON citizen_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_status ON citizen_reports(status);
CREATE INDEX IF NOT EXISTS idx_timestamp_reports ON citizen_reports(timestamp);

-- NEW: Alert Validations Table (tracks citizen validation of system alerts)
CREATE TABLE IF NOT EXISTS alert_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER,
    timestamp TEXT NOT NULL,
    validation_type TEXT NOT NULL,  -- 'confirm', 'deny', 'unsure'
    citizen_comment TEXT,
    location TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_validations ON alert_validations(alert_id);
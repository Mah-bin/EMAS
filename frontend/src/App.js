import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import CitizenReportForm from './Citizenreportform';
import CitizenReportsPanel from './Citizenreportspanel';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});


function App() {
  // --- 1. CITY SELECTION STATE ---
  const [selectedCity, setSelectedCity] = useState('Thiruvananthapuram'); 

  // List of districts matching your mock_sensors.json
  const KERALA_DISTRICTS = [
    "Thiruvananthapuram", 
    "Kollam", 
    "Pathanamthitta", 
    "Alappuzha", 
    "Ernakulam", 
    "Thrissur", 
    "Palakkad", 
    "Kannur", 
    "Kasaragod"
  ];

  const [monitorData, setMonitorData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [correlations, setCorrelations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [chartKey, setChartKey] = useState(0); // Force chart re-render
  
  // Citizen Participation State
  const [showReportForm, setShowReportForm] = useState(false);
  const [showCitizenPanel, setShowCitizenPanel] = useState(false);
  
  // Use ref to track previous data
  const prevHistoryRef = useRef();

  // Fetch monitor data from backend (Dynamic City)
  const fetchMonitorData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/monitor?city=${selectedCity}`);
      if (!response.ok) throw new Error('Backend connection failed');
      const data = await response.json();
      console.log('Monitor data received:', data);
      setMonitorData(data);
      setError(null);
    } catch (err) {
      console.error('Monitor fetch error:', err);
      setError(err.message);
    }
  };

  // Fetch historical data
  const fetchHistory = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/history?limit=24`);
      if (!response.ok) throw new Error('History fetch failed');
      const data = await response.json();
      
      const newData = data.data || [];
      console.log('📊 History fetch:', {
        count: newData.length,
        latestPM25: newData[0]?.pm25,
        latestNoise: newData[0]?.noise,
        latestTimestamp: newData[0]?.timestamp
      });
      
      // Check if data actually changed
      if (prevHistoryRef.current) {
        const oldLatest = prevHistoryRef.current[0];
        const newLatest = newData[0];
        
        if (oldLatest && newLatest) {
          const changed = oldLatest.timestamp !== newLatest.timestamp ||
                         oldLatest.pm25 !== newLatest.pm25 ||
                         oldLatest.noise !== newLatest.noise;
          
          if (changed) {
            console.log('✅ NEW DATA DETECTED - Chart will update');
            setChartKey(prev => prev + 1); // Force chart refresh
          } else {
            console.log('⚠️  Data unchanged - same as before');
          }
        }
      }
      
      prevHistoryRef.current = newData;
      setHistoryData(newData);
      
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  // Fetch sensor locations
  const fetchSensors = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/sensors`);
      if (!response.ok) throw new Error('Sensors fetch failed');
      const data = await response.json();
      setSensors(data.sensors || []);
    } catch (err) {
      console.error('Sensors fetch error:', err);
    }
  };

  // Fetch correlations
  const fetchCorrelations = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/correlations`);
      if (!response.ok) {
        console.warn('Correlations fetch failed (non-critical)');
        return;
      }
      const data = await response.json();
      setCorrelations(data.correlations);
    } catch (err) {
      console.error('Correlations fetch error:', err);
    }
  };

  // Generate AI Predictions based on Historical Trends
  const generatePredictions = (currentData, history) => {
    if (!currentData?.current) return;
    
    const current = currentData.current;
    
    let pm25Trend = (Math.random() - 0.5) * 2;
    let noiseTrend = (Math.random() - 0.5) * 2;
    let tempTrend = (Math.random() - 0.5) * 0.5;

    if (history && history.length >= 2) {
      const lookback = Math.min(history.length, 5);
      const recent = history[0];           
      const older = history[lookback - 1]; 
      
      pm25Trend = (recent.pm25 - older.pm25) / lookback;
      noiseTrend = (recent.noise - older.noise) / lookback;
      
      if (recent.temperature && older.temperature) {
         tempTrend = (recent.temperature - older.temperature) / lookback;
      }
    }

    const preds = [];
    
    for (let i = 1; i <= 6; i++) {
      const jitter = (Math.random() - 0.5) * 2; 
      
      const predictedPM25 = Math.max(5, Math.min(150, current.pm25 + (pm25Trend * i) + jitter));
      const predictedNoise = Math.max(40, Math.min(95, current.noise + (noiseTrend * i) + jitter));
      const predictedTemp = Math.max(10, Math.min(50, (current.temperature || 25) + (tempTrend * i) + (jitter * 0.1)));
      
      let metric, value, status;
      
      if (i % 3 === 1) {
        metric = 'PM2.5';
        value = `${predictedPM25.toFixed(1)} µg/m³`;
        status = predictedPM25 > 55 ? 'Unhealthy' : predictedPM25 > 35 ? 'Moderate' : 'Good';
      } else if (i % 3 === 2) {
        metric = 'Noise';
        value = `${predictedNoise.toFixed(0)} dB`;
        status = predictedNoise > 75 ? 'Elevated' : predictedNoise > 65 ? 'Moderate' : 'Normal';
      } else {
        metric = 'Temperature';
        value = `${predictedTemp.toFixed(1)}°C`;
        status = predictedTemp > 35 ? 'Hot' : predictedTemp > 30 ? 'Warm' : 'Comfortable';
      }
      
      preds.push({
        time: `+${i}h`,
        value,
        metric,
        confidence: `${Math.max(60, 98 - i * 5)}%`,
        status
      });
    }
    
    setPredictions(preds);
  };

  const addTimelineEvent = (type, message) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    setTimeline(prev => [{
      time: timeStr,
      type,
      message
    }, ...prev.slice(0, 9)]); 
  };

  // --- 2. UPDATED USE EFFECT ---
  useEffect(() => {
    const loadData = async () => {
      console.log(`🔄 Loading data for ${selectedCity}...`);
      setLoading(true);
      await fetchMonitorData();
      await fetchHistory();
      await fetchSensors();
      await fetchCorrelations();
      setLoading(false);
    };

    loadData();

    const fastInterval = setInterval(() => {
      console.log('⏰ 5-second refresh triggered');
      fetchMonitorData();
      fetchHistory();
      fetchCorrelations();
    }, 5000);

    const slowInterval = setInterval(() => {
      fetchSensors();
    }, 10000); 

    return () => {
      clearInterval(fastInterval);
      clearInterval(slowInterval);
    };
  }, [selectedCity]); 

  useEffect(() => {
    if (monitorData) {
      generatePredictions(monitorData, historyData);
    }
  }, [monitorData, historyData]);

  useEffect(() => {
    if (monitorData?.risk_assessment?.alerts) {
      const alerts = monitorData.risk_assessment.alerts;
      if (alerts.length > 0) {
        const severity = monitorData.risk_assessment.score >= 70 ? 'danger' : 
                        monitorData.risk_assessment.score >= 50 ? 'warning' : 'info';
        addTimelineEvent(severity, alerts[0]);
      }
    }
  }, [monitorData?.risk_assessment?.alerts]);

  const getStatus = (val, thresholds) => {
    if (val <= thresholds[0]) return { text: 'Safe', class: 'safe' };
    if (val <= thresholds[1]) return { text: 'Warning', class: 'warning' };
    return { text: 'Danger', class: 'danger' };
  };

  const getRiskColor = (score) => {
    if (score >= 70) return '#ef4444';
    if (score >= 50) return '#f59e0b';
    if (score >= 30) return '#3b82f6';
    return '#10b981';
  };

  if (loading || !monitorData) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', color: '#e5e7eb' }}>
        <h2>🌍 Loading Environmental Monitoring System...</h2>
        <p style={{ marginTop: '20px', color: '#9ca3af', fontFamily: 'monospace' }}>
          Target: {selectedCity} | Loading...
        </p>
      </div>
    );
  }

  if (error && !monitorData) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', color: '#ef4444' }}>
        <h2>⚠️ Connection Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} style={{
          marginTop: '20px', padding: '12px 24px', background: '#3b82f6', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer'
        }}>Retry Connection</button>
      </div>
    );
  }

  const current = monitorData.current || {};
  const risk = monitorData.risk_assessment || { score: 0, level: 'Low', alerts: [] };
  
  // Chart Configuration - Create fresh data object each time
  const chartData = {
    labels: historyData.slice().reverse().map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: 'PM2.5 (µg/m³)',
        data: historyData.slice().reverse().map(d => d.pm25),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5
      },
      {
        label: 'Wind (km/h)',
        data: historyData.slice().reverse().map(d => d.wind_kph),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5
      },
      {
        label: 'Noise (dB)',
        data: historyData.slice().reverse().map(d => d.noise),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    plugins: {
      legend: { 
        labels: { 
          color: '#e5e7eb', 
          font: { family: 'JetBrains Mono', size: 12 },
          usePointStyle: true,
          padding: 15
        } 
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#e5e7eb',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    scales: {
      y: { 
        grid: { color: 'rgba(255, 255, 255, 0.1)' }, 
        ticks: { color: '#9ca3af', font: { size: 11 } }
      },
      x: { 
        grid: { display: false }, 
        ticks: { 
          color: '#9ca3af', 
          maxRotation: 45, 
          minRotation: 45,
          font: { size: 10 }
        } 
      }
    }
  };

  // Determine map center
  const citySensors = sensors.filter(s => s.location === selectedCity);
  const mapCenter = citySensors.length > 0 
    ? [citySensors[0].lat, citySensors[0].lon || citySensors[0].lng]
    : [10.8505, 76.2711];

  return (
    <div className="container">
      
      {/* HEADER */}
      <header>
        <div className="header-content">
          <div>
            <h1>🌍 ENVIRONMENTAL MONITORING SYSTEM</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
              <span style={{ 
                color: 'var(--text-muted)', 
                fontSize: '13px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                ZONE:
              </span>
              <div className="city-select-container">
                <select 
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="city-select"
                >
                  {KERALA_DISTRICTS.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setShowReportForm(true)}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              🗣️ Report Issue
            </button>
            <button
              onClick={() => setShowCitizenPanel(true)}
              style={{
                padding: '10px 20px',
                background: showCitizenPanel ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.1)',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                color: '#3b82f6',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono',
                transition: 'all 0.2s'
              }}
            >
              📊 Community Reports
            </button>
            <div className="status-badge">
              <div className="status-dot"></div>
              <span>SYSTEM ACTIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Alert Banner */}
      {risk.alerts && risk.alerts.length > 0 && (
        <div className="alert-banner" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div className="alert-icon">⚠️</div>
          <div className="alert-content">
            <h3>Active Environmental Alerts</h3>
            {risk.alerts.slice(0, 3).map((alert, idx) => (
              <p key={idx}>• {alert}</p>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        <div className="metric-card">
          <div className="metric-header"><div className="metric-title">Temperature</div><span style={{ fontSize: '24px' }}>🌡️</span></div>
          <div className="metric-value">{current.temperature?.toFixed(1) || '—'}<span className="metric-unit">°C</span></div>
          <div className="metric-bar"><div className={`metric-bar-fill ${getStatus(current.temperature || 0, [30, 38]).class}`} style={{ width: `${Math.min((current.temperature / 50) * 100, 100)}%` }}></div></div>
        </div>

        <div className="metric-card">
          <div className="metric-header"><div className="metric-title">Humidity</div><span style={{ fontSize: '24px' }}>💧</span></div>
          <div className="metric-value">{current.humidity || '—'}<span className="metric-unit">%</span></div>
          <div className="metric-bar"><div className={`metric-bar-fill ${getStatus(current.humidity || 0, [70, 85]).class}`} style={{ width: `${current.humidity}%` }}></div></div>
        </div>

        <div className="metric-card">
          <div className="metric-header"><div className="metric-title">Air Quality (PM2.5)</div><span style={{ fontSize: '24px' }}>🌫️</span></div>
          <div className="metric-value">{current.pm25?.toFixed(1) || '—'}<span className="metric-unit">µg/m³</span></div>
          <div className="metric-bar"><div className={`metric-bar-fill ${getStatus(current.pm25 || 0, [25, 55]).class}`} style={{ width: `${Math.min((current.pm25 / 100) * 100, 100)}%` }}></div></div>
        </div>

        <div className="metric-card">
          <div className="metric-header"><div className="metric-title">Wind Speed</div><span style={{ fontSize: '24px' }}>💨</span></div>
          <div className="metric-value">{current.wind_speed?.toFixed(1) || '—'}<span className="metric-unit">km/h</span></div>
          <div className="metric-bar"><div className={`metric-bar-fill ${getStatus(current.wind_speed || 0, [20, 40]).class}`} style={{ width: `${Math.min((current.wind_speed / 100) * 100, 100)}%` }}></div></div>
        </div>

        <div className="metric-card">
          <div className="metric-header"><div className="metric-title">Noise Level</div><span style={{ fontSize: '24px' }}>🔊</span></div>
          <div className="metric-value">{current.noise || '—'}<span className="metric-unit">dB</span></div>
          <div className="metric-bar"><div className={`metric-bar-fill ${getStatus(current.noise || 0, [70, 80]).class}`} style={{ width: `${Math.min((current.noise / 120) * 100, 100)}%` }}></div></div>
        </div>

        <div className="metric-card" style={{ gridColumn: 'span 1' }}>
          <div className="metric-header"><div className="metric-title">Total Risk Score</div><span style={{ fontSize: '24px' }}>🎯</span></div>
          <div className="metric-value" style={{ color: getRiskColor(risk.score) }}>{risk.score}<span className="metric-unit">/100</span></div>
          <div className="metric-bar"><div className={`metric-bar-fill ${getStatus(risk.score, [30, 70]).class}`} style={{ width: `${risk.score}%` }}></div></div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Level: <strong style={{ color: getRiskColor(risk.score) }}>{risk.level}</strong></p>
        </div>
      </div>

      {/* AI Predictions */}
      <div className="analysis-card" style={{ marginBottom: '24px' }}>
        <div className="section-header">
          <h2 className="section-title">🤖 AI Predictions (Next 6 Hours)</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '16px' }}>
          {predictions.map((pred, idx) => (
            <div key={idx} style={{ background: 'rgba(26, 35, 50, 0.6)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', transition: 'all 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#8b5cf6', fontFamily: 'JetBrains Mono, monospace' }}>{pred.time}</span>
                <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>{pred.confidence}</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{pred.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{pred.metric} - <strong>{pred.status}</strong></div>
            </div>
          ))}
        </div>
      </div>

      {/* Correlations */}
      {correlations && (
        <div className="analysis-card">
          <div className="section-header">
            <h2 className="section-title">🔗 Correlation Analysis</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pattern detection from historical data</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
            <div className="correlation-cell" style={{
              background: Math.abs(correlations.pm25_wind) > 0.6 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              border: `1px solid ${Math.abs(correlations.pm25_wind) > 0.6 ? '#ef4444' : '#3b82f6'}`,
              borderRadius: '8px', padding: '16px', textAlign: 'center'
            }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 700, marginBottom: '4px', color: Math.abs(correlations.pm25_wind) > 0.5 ? '#ef4444' : '#10b981' }}>
                {correlations.pm25_wind > 0 ? '+' : ''}{correlations.pm25_wind?.toFixed(2) || '—'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>PM2.5 ↔ Wind</div>
            </div>
            
            <div className="correlation-cell" style={{
               background: Math.abs(correlations.pm25_noise) > 0.6 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
               border: `1px solid ${Math.abs(correlations.pm25_noise) > 0.6 ? '#ef4444' : '#3b82f6'}`,
               borderRadius: '8px', padding: '16px', textAlign: 'center'
            }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 700, marginBottom: '4px', color: Math.abs(correlations.pm25_noise) > 0.5 ? '#ef4444' : '#10b981' }}>
                {correlations.pm25_noise > 0 ? '+' : ''}{correlations.pm25_noise?.toFixed(2) || '—'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>PM2.5 ↔ Noise</div>
            </div>

            <div className="correlation-cell" style={{
               background: Math.abs(correlations.wind_noise) > 0.6 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
               border: `1px solid ${Math.abs(correlations.wind_noise) > 0.6 ? '#ef4444' : '#3b82f6'}`,
               borderRadius: '8px', padding: '16px', textAlign: 'center'
            }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 700, marginBottom: '4px', color: Math.abs(correlations.wind_noise) > 0.5 ? '#ef4444' : '#10b981' }}>
                {correlations.wind_noise > 0 ? '+' : ''}{correlations.wind_noise?.toFixed(2) || '—'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Wind ↔ Noise</div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="analysis-card" style={{ marginTop: '24px' }}>
        <div className="section-header"><h2 className="section-title">📋 Activity Timeline</h2></div>
        <div style={{ marginTop: '16px', maxHeight: '300px', overflowY: 'auto' }}>
          {timeline.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity</p> : timeline.map((event, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '16px', padding: '12px', borderLeft: `3px solid ${event.type === 'danger' ? '#ef4444' : event.type === 'warning' ? '#f59e0b' : '#3b82f6'}`, background: idx % 2 === 0 ? 'rgba(26, 35, 50, 0.3)' : 'transparent', marginBottom: '8px', borderRadius: '4px' }}>
              <div style={{ minWidth: '60px', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{event.time}</div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', flex: 1 }}>{event.message}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Map + Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '24px' }}>
        
        {/* Left: Map Section */}
        <div className="map-section">
          <div className="section-header">
            <h2 className="section-title">📍 SENSOR NETWORK MAP</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {citySensors.length} Active Units in {selectedCity}
            </span>
          </div>
          <MapContainer 
            key={selectedCity} 
            center={mapCenter} 
            zoom={10} 
            style={{ height: '400px', borderRadius: '12px', border: '1px solid var(--border-color)' }}
          >
            <TileLayer 
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap &copy; CARTO'
            />
            {citySensors.map(sensor => (
              <Marker key={sensor.id} position={[sensor.lat, sensor.lon || sensor.lng]}>
                <Popup className="sensor-popup">
                  <div style={{ color: '#111827', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    <h4 style={{ marginBottom: '8px' }}>{sensor.name}</h4>
                    <p><strong>Type:</strong> {sensor.type}</p>
                    <p><strong>Status:</strong> {sensor.status}</p>
                    <p><strong>Location:</strong> {sensor.location}</p>
                    <hr style={{ margin: '8px 0', border: '0', borderTop: '1px solid #ccc' }}/>
                    <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                       <span>PM2.5: <strong>{sensor.pm25}</strong></span>
                       <span>Noise: <strong>{sensor.noise}dB</strong></span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Right: Trend Chart */}
        <div className="chart-card">
          <div className="section-header">
            <h2 className="section-title">📊 Live Trends</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {historyData.length} points • {chartKey} updates
            </span>
          </div>
          <div style={{ height: '350px' }}>
            {historyData.length > 0 ? (
              <Line 
                key={chartKey}
                options={chartOptions} 
                data={chartData} 
                redraw={true}
              />
            ) : (
              <div style={{ textAlign: 'center', paddingTop: '120px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '8px' }}>
                  Collecting historical data...
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Chart will appear after data is logged
                </p>
                <div style={{ 
                  marginTop: '20px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  color: '#3b82f6',
                  fontSize: '12px'
                }}>
                  <div className="status-dot" style={{ background: '#3b82f6' }}></div>
                  Monitoring active
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- NEW POPUP MODAL FOR REPORTS (Replaces bottom scrolling) --- */}
      {showCitizenPanel && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            background: '#111827', 
            padding: '24px', 
            borderRadius: '16px',
            border: '1px solid #374151', 
            width: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setShowCitizenPanel(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'transparent', border: 'none',
                color: '#9ca3af', fontSize: '24px', cursor: 'pointer'
              }}
            >
              ×
            </button>

            {/* Header */}
            <div className="section-header">
              <h2 className="section-title">🗣️ Community Reports</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Citizen-reported environmental issues
              </span>
            </div>

            {/* The Panel Component */}
            <div style={{ marginTop: '20px' }}>
              <CitizenReportsPanel selectedCity={selectedCity} />
            </div>
            
            <div style={{textAlign: 'right', marginTop: '16px'}}>
              <button 
                onClick={() => setShowCitizenPanel(false)}
                style={{
                   padding: '8px 16px', background: '#374151', border: 'none', 
                   color: 'white', borderRadius: '6px', cursor: 'pointer'
                }}
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Report Form Modal */}
      {showReportForm && (
        <CitizenReportForm
          selectedCity={selectedCity}
          onClose={() => setShowReportForm(false)}
          onSubmitSuccess={() => {
            if (showCitizenPanel) {
              setShowCitizenPanel(false);
              setTimeout(() => setShowCitizenPanel(true), 100);
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
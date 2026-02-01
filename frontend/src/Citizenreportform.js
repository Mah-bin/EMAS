import React, { useState } from 'react';

const CitizenReportForm = ({ selectedCity, onClose, onSubmitSuccess }) => {
  const [formData, setFormData] = useState({
    report_type: 'smoke',
    severity: 3,
    description: '',
    citizen_name: '',
    citizen_contact: '',
    photo: null
  });
  
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const reportTypes = [
    { value: 'smoke', label: '💨 Smoke', icon: '💨' },
    { value: 'odor', label: '👃 Odor', icon: '👃' },
    { value: 'noise', label: '🔊 Noise', icon: '🔊' },
    { value: 'other', label: '⚠️ Other', icon: '⚠️' }
  ];

  const severityLevels = [
    { value: 1, label: 'Minor', color: '#10b981' },
    { value: 2, label: 'Low', color: '#3b82f6' },
    { value: 3, label: 'Moderate', color: '#f59e0b' },
    { value: 4, label: 'High', color: '#ef4444' },
    { value: 5, label: 'Severe', color: '#dc2626' }
  ];

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, photo: file });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      // Convert photo to base64 if present
      let photoBase64 = null;
      if (formData.photo) {
        const reader = new FileReader();
        photoBase64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(formData.photo);
        });
      }

      const response = await fetch('http://localhost:8000/api/citizen/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: selectedCity,
          latitude: null,
          longitude: null,
          report_type: formData.report_type,
          severity: formData.severity,
          description: formData.description,
          photo_base64: photoBase64,
          citizen_name: formData.citizen_name || null,
          citizen_contact: formData.citizen_contact || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Report submitted successfully! Thank you for helping your community.' });
        
        // Show auto-validation results if any
        if (data.auto_validation?.validated) {
          setTimeout(() => {
            setMessage({ 
              type: 'success', 
              text: `✓ Report validated by sensors: ${data.auto_validation.notes}` 
            });
          }, 2000);
        }
        
        // Reset form
        setTimeout(() => {
          if (onSubmitSuccess) onSubmitSuccess();
          if (onClose) onClose();
        }, 3000);
      } else {
        setMessage({ type: 'error', text: data.detail || 'Failed to submit report' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #111827 0%, #1a2332 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px 8px'
          }}
        >
          ×
        </button>

        <h2 style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '24px',
          marginBottom: '8px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🗣️ Report Environmental Issue
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
          Help your community by reporting pollution incidents in {selectedCity}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Report Type */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
              Type of Issue *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {reportTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, report_type: type.value })}
                  style={{
                    padding: '12px',
                    background: formData.report_type === type.value ? 'rgba(59, 130, 246, 0.2)' : 'rgba(26, 35, 50, 0.6)',
                    border: formData.report_type === type.value ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
              Severity Level: <span style={{ color: severityLevels[formData.severity - 1].color }}>{severityLevels[formData.severity - 1].label}</span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: parseInt(e.target.value) })}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                outline: 'none',
                background: `linear-gradient(to right, #10b981, #f59e0b, #ef4444)`
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Minor</span>
              <span>Severe</span>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              placeholder="Describe what you observed (time, location details, etc.)"
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(26, 35, 50, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'IBM Plex Sans, sans-serif',
                resize: 'vertical',
                minHeight: '100px'
              }}
            />
          </div>

          {/* Photo Upload */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
              Photo Evidence (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(26, 35, 50, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
            {photoPreview && (
              <img 
                src={photoPreview} 
                alt="Preview" 
                style={{ 
                  marginTop: '12px', 
                  maxWidth: '100%', 
                  height: 'auto', 
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }} 
              />
            )}
          </div>

          {/* Contact Info */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
              Your Name (Optional)
            </label>
            <input
              type="text"
              value={formData.citizen_name}
              onChange={(e) => setFormData({ ...formData, citizen_name: e.target.value })}
              placeholder="Anonymous"
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(26, 35, 50, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'IBM Plex Sans, sans-serif'
              }}
            />
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
              borderRadius: '8px',
              color: message.type === 'success' ? '#10b981' : '#ef4444',
              fontSize: '14px'
            }}>
              {message.text}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '14px',
              background: submitting ? '#6b7280' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'JetBrains Mono, monospace'
            }}
          >
            {submitting ? '⏳ Submitting...' : '📤 Submit Report'}
          </button>
        </form>

        <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Your report will be reviewed and validated against sensor data
        </p>
      </div>
    </div>
  );
};

export default CitizenReportForm;
import React, { useState, useEffect } from 'react';

const CitizenReportsPanel = ({ selectedCity }) => {
  const [reports, setReports] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'validated'
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const status = filter === 'all' ? '' : filter;
      const response = await fetch(
        `http://localhost:8000/api/citizen/reports?location=${selectedCity}&status=${status}&limit=10`
      );
      const data = await response.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/citizen/statistics?location=${selectedCity}`
      );
      const data = await response.json();
      setStatistics(data.statistics);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchReports(), fetchStatistics()]);
      setLoading(false);
    };
    loadData();
  }, [selectedCity, filter]);

  const handleVote = async (reportId, upvote) => {
    try {
      await fetch(
        `http://localhost:8000/api/citizen/report/${reportId}/vote?upvote=${upvote}`,
        { method: 'POST' }
      );
      fetchReports(); // Refresh reports
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const getReportTypeIcon = (type) => {
    const icons = {
      smoke: '💨',
      odor: '👃',
      noise: '🔊',
      other: '⚠️'
    };
    return icons[type] || '📝';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      1: '#10b981',
      2: '#3b82f6',
      3: '#f59e0b',
      4: '#ef4444',
      5: '#dc2626'
    };
    return colors[severity] || '#6b7280';
  };

  const getStatusBadge = (status, validated) => {
    const styles = {
      pending: { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '⏳ Pending' },
      validated: { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: validated ? '✓ Auto-Validated' : '✓ Validated' },
      resolved: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', text: '✓ Resolved' },
      dismissed: { bg: 'rgba(107, 114, 128, 0.1)', border: '#6b7280', text: '✕ Dismissed' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span style={{
        padding: '4px 8px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        color: style.border
      }}>
        {style.text}
      </span>
    );
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        Loading citizen reports...
      </div>
    );
  }

  return (
    <div>
      {/* Statistics Cards */}
      {statistics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'rgba(26, 35, 50, 0.6)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6', fontFamily: 'JetBrains Mono' }}>
              {statistics.total}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Total Reports
            </div>
          </div>
          <div style={{
            background: 'rgba(26, 35, 50, 0.6)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981', fontFamily: 'JetBrains Mono' }}>
              {statistics.recent_24h}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Last 24 Hours
            </div>
          </div>
          <div style={{
            background: 'rgba(26, 35, 50, 0.6)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b', fontFamily: 'JetBrains Mono' }}>
              {statistics.by_status?.pending || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Pending Review
            </div>
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['all', 'pending', 'validated'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px',
              background: filter === f ? 'rgba(59, 130, 246, 0.2)' : 'rgba(26, 35, 50, 0.6)',
              border: filter === f ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No reports found for {selectedCity}
          </div>
        ) : (
          reports.map(report => (
            <div
              key={report.id}
              style={{
                background: 'rgba(26, 35, 50, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{getReportTypeIcon(report.report_type)}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>
                      {report.report_type} Report
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatTimestamp(report.timestamp)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  {getStatusBadge(report.status, report.validated_by_sensor)}
                  <div style={{
                    padding: '2px 8px',
                    background: getSeverityColor(report.severity) + '20',
                    border: `1px solid ${getSeverityColor(report.severity)}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: getSeverityColor(report.severity)
                  }}>
                    Severity: {report.severity}/5
                  </div>
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '12px', lineHeight: '1.5' }}>
                {report.description}
              </p>

              {/* Validation Notes */}
              {report.validation_notes && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#10b981',
                  marginBottom: '12px'
                }}>
                  <strong>Validation:</strong> {report.validation_notes}
                </div>
              )}

              {/* Footer: Votes and Reporter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {report.citizen_name ? `Reported by ${report.citizen_name}` : 'Anonymous report'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleVote(report.id, true)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid #10b981',
                      borderRadius: '6px',
                      color: '#10b981',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    👍 {report.upvotes || 0}
                  </button>
                  <button
                    onClick={() => handleVote(report.id, false)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    👎 {report.downvotes || 0}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CitizenReportsPanel;
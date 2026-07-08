import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useResearch } from '../context/ResearchContext';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { researchHistory, getResearchHistory, historyLoading, error } = useResearch();
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const refreshHistory = async () => {
      await getResearchHistory();
      if (isMounted) {
        setLastUpdated(new Date());
      }
    };

    refreshHistory();

    const refreshInterval = window.setInterval(refreshHistory, 30000);
    window.addEventListener('focus', refreshHistory);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshHistory);
    };
  }, [getResearchHistory]);

  const formatDate = (dateValue) => {
    if (!dateValue) return 'Unknown';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(dateValue));
  };

  const getAverageConfidence = (items) => {
    if (items.length === 0) return 0;

    const total = items.reduce((acc, item) => {
      return acc + (item.recommendation?.confidenceScore || 0);
    }, 0);

    return Math.round(total / items.length);
  };

  const getRecommendationColor = (rec) => {
    switch(rec) {
      case 'Invest': return 'var(--accent-success)';
      case 'Hold': return 'var(--accent-warning)';
      case 'Pass': return 'var(--accent-danger)';
      default: return 'var(--text-secondary)';
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 80) return 'var(--accent-success)';
    if (score >= 60) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const historyRows = researchHistory.map((item) => ({
    id: item._id || item.id,
    company: item.companyName || item.companyProfile?.name || 'Unknown company',
    symbol: item.companySymbol || item.companyProfile?.symbol || 'N/A',
    date: formatDate(item.analysisDate || item.createdAt),
    recommendation: item.recommendation?.decision || 'Hold',
    confidence: item.recommendation?.confidenceScore || 0
  }));

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <h1>Welcome back, {user?.name}!</h1>
          <p>Your investment research dashboard</p>
          {lastUpdated && (
            <span className="dashboard-live-status">
              Live data updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Link to="/research" className="new-research-btn">
          <span>+</span> New Research
        </Link>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div className="stat-info">
            <span className="stat-value">{historyRows.length}</span>
            <span className="stat-label">Total Research</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <div className="stat-info">
            <span className="stat-value">
              {historyRows.filter(r => r.recommendation === 'Invest').length}
            </span>
            <span className="stat-label">Invest Recommendations</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🎯</span>
          <div className="stat-info">
            <span className="stat-value">
              {getAverageConfidence(researchHistory)}%
            </span>
            <span className="stat-label">Avg Confidence</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏦</span>
          <div className="stat-info">
            <span className="stat-value">
              {new Set(historyRows.map(r => r.symbol)).size}
            </span>
            <span className="stat-label">Companies Researched</span>
          </div>
        </div>
      </div>

      <div className="research-history">
        <h2>Recent Research</h2>
        {error && <div className="dashboard-error">{error}</div>}
        {historyLoading && historyRows.length === 0 ? (
          <div className="loading-state">
            <div className="shimmer-card"></div>
            <div className="shimmer-card"></div>
            <div className="shimmer-card"></div>
          </div>
        ) : historyRows.length > 0 ? (
          <div className="research-list">
            {historyRows.map((item) => (
              <div className="research-item" key={item.id}>
                <div className="research-company">
                  <span className="company-name">{item.company}</span>
                  <span className="company-symbol">{item.symbol}</span>
                </div>
                <div className="research-date">{item.date}</div>
                <div 
                  className="research-recommendation"
                  style={{ color: getRecommendationColor(item.recommendation) }}
                >
                  {item.recommendation}
                </div>
                <div className="research-confidence">
                  <div 
                    className="confidence-bar"
                    style={{ 
                      width: `${item.confidence}%`,
                      background: getConfidenceColor(item.confidence)
                    }}
                  />
                  <span className="confidence-value">{item.confidence}%</span>
                </div>
                <Link to="/research" className="view-details-btn">View Details</Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p>No research history yet</p>
            <p className="empty-sub">Start your first company analysis</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

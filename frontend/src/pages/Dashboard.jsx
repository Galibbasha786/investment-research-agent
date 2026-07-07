import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [researchHistory, setResearchHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock data - will be replaced with real API calls
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setResearchHistory([
        {
          id: 1,
          company: 'Apple Inc.',
          symbol: 'AAPL',
          date: '2024-01-15',
          recommendation: 'Invest',
          confidence: 87
        },
        {
          id: 2,
          company: 'Tesla Inc.',
          symbol: 'TSLA',
          date: '2024-01-14',
          recommendation: 'Hold',
          confidence: 65
        },
        {
          id: 3,
          company: 'Amazon.com Inc.',
          symbol: 'AMZN',
          date: '2024-01-13',
          recommendation: 'Invest',
          confidence: 92
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

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

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <h1>Welcome back, {user?.name}!</h1>
          <p>Your investment research dashboard</p>
        </div>
        <button className="new-research-btn">
          <span>+</span> New Research
        </button>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div className="stat-info">
            <span className="stat-value">{researchHistory.length}</span>
            <span className="stat-label">Total Research</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <div className="stat-info">
            <span className="stat-value">
              {researchHistory.filter(r => r.recommendation === 'Invest').length}
            </span>
            <span className="stat-label">Invest Recommendations</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🎯</span>
          <div className="stat-info">
            <span className="stat-value">
              {researchHistory.length > 0 
                ? Math.round(researchHistory.reduce((acc, r) => acc + r.confidence, 0) / researchHistory.length)
                : 0}%
            </span>
            <span className="stat-label">Avg Confidence</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏦</span>
          <div className="stat-info">
            <span className="stat-value">
              {new Set(researchHistory.map(r => r.symbol)).size}
            </span>
            <span className="stat-label">Companies Researched</span>
          </div>
        </div>
      </div>

      <div className="research-history">
        <h2>Recent Research</h2>
        {loading ? (
          <div className="loading-state">
            <div className="shimmer-card"></div>
            <div className="shimmer-card"></div>
            <div className="shimmer-card"></div>
          </div>
        ) : researchHistory.length > 0 ? (
          <div className="research-list">
            {researchHistory.map((item) => (
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
                <button className="view-details-btn">View Details</button>
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
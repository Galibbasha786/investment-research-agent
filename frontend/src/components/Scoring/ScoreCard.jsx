import React, { useState } from 'react';
import axios from 'axios';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  BarChart,
  Info,
  Download,
  MinusCircle,
  RefreshCcw
} from 'lucide-react';
import './ScoreCard.css';

const ScoreCard = ({ symbol, companyData }) => {
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [error, setError] = useState(null);

  const calculateScore = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post('/api/score/calculate', {
        symbol,
        companyData
      });

      setScoreData(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to calculate score');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'var(--accent-success)';
    if (score >= 50) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const getRecommendationIcon = (rec) => {
    switch(rec) {
      case 'Invest': return <CheckCircle size={22} />;
      case 'Pass': return <XCircle size={22} />;
      default: return <MinusCircle size={22} />;
    }
  };

  if (loading) {
    return (
      <div className="score-card loading">
        <div className="score-loader">
          <div className="spinner"></div>
          <p>Calculating investment score...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="score-card error">
        <AlertCircle size={24} />
        <p>{error}</p>
        <button onClick={calculateScore} className="retry-btn">Retry</button>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className="score-card placeholder">
        <div className="score-prompt">
          <BarChart size={32} />
          <h3>Investment Score</h3>
          <p>Get a comprehensive investment score based on multiple factors</p>
          <button onClick={calculateScore} className="calculate-btn">
            Calculate Score
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="score-card fade-in">
      <div className="score-header">
        <h3>Investment Score</h3>
        <button onClick={calculateScore} className="refresh-btn">
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      <div className="score-main">
        <div className="score-circle" style={{ 
          borderColor: getScoreColor(scoreData.overallScore) 
        }}>
          <span className="score-value">{scoreData.overallScore}</span>
          <span className="score-label">Overall</span>
        </div>

        <div className="score-details">
          <div className="score-recommendation">
            <span className="rec-icon" style={{ color: getScoreColor(scoreData.overallScore) }}>
              {getRecommendationIcon(scoreData.recommendation)}
            </span>
            <span className="rec-text" style={{ color: getScoreColor(scoreData.overallScore) }}>
              {scoreData.recommendation}
            </span>
            <span className="rec-confidence">Confidence: {scoreData.confidence}%</span>
          </div>
        </div>
      </div>

      <div className="score-components">
        {Object.entries(scoreData.components).map(([key, value]) => (
          <div key={key} className="component-item">
            <div className="component-header">
              <span className="component-name">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className="component-score" style={{ color: getScoreColor(value.score) }}>
                {value.score}%
              </span>
            </div>
            <div className="component-bar">
              <div 
                className="component-fill" 
                style={{ 
                  width: `${value.score}%`,
                  background: getScoreColor(value.score)
                }}
              />
            </div>
            <div className="component-weight">
              Weight: {Math.round(value.weight * 100)}%
            </div>
            {value.explanations && value.explanations.length > 0 && (
              <div className="component-explanations">
                {value.explanations.slice(0, 2).map((exp, i) => (
                  <small key={i}>{exp}</small>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="score-actions">
        <button className="export-btn">
          <Download size={16} />
          Export Report
        </button>
        <button className="info-btn">
          <Info size={16} />
          Learn More
        </button>
      </div>
    </div>
  );
};

export default ScoreCard;

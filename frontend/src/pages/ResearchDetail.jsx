import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building2,
  Calendar,
  BarChart3,
  DollarSign,
  PieChart,
  Users,
  Target
} from 'lucide-react';
import './ResearchDetail.css';

const ResearchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [research, setResearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchResearch();
  }, [id]);

  const fetchResearch = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/research/${id}`);
      setResearch(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await axios.post('/api/research/export', 
        { researchId: id },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${research.companyName}_Investment_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'var(--accent-success)';
    if (score >= 50) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="research-detail-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading research details...</p>
        </div>
      </div>
    );
  }

  if (error || !research) {
    return (
      <div className="research-detail-page">
        <div className="error-container">
          <AlertCircle size={32} />
          <p>{error || 'Research not found'}</p>
          <Link to="/dashboard" className="back-link">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const rec = research.recommendation || {};
  const scores = research.scores || {};
  const company = research.companyProfile || {};
  const financials = research.financialData || {};

  return (
    <div className="research-detail-page">
      <div className="detail-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
        <div className="detail-actions">
          <button onClick={handleExportPDF} className="export-btn">
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      <div className="detail-content">
        {/* Company Header */}
        <div className="company-header">
          <div className="company-info">
            <h1>{research.companyName}</h1>
            <span className="company-symbol">{research.companySymbol}</span>
            {company.industry && (
              <span className="company-industry">{company.industry}</span>
            )}
          </div>
          <div className="company-meta">
            <span className="meta-item">
              <Calendar size={16} />
              {formatDate(research.analysisDate || research.createdAt)}
            </span>
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="meta-item">
                <Building2 size={16} />
                Website
              </a>
            )}
          </div>
        </div>

        {/* Recommendation Summary */}
        <div className="recommendation-summary">
          <div className="rec-main" style={{ borderColor: getScoreColor(rec.confidenceScore || 0) }}>
            <div className="rec-decision">
              {rec.decision === 'Invest' && <CheckCircle size={32} style={{ color: 'var(--accent-success)' }} />}
              {rec.decision === 'Hold' && <AlertCircle size={32} style={{ color: 'var(--accent-warning)' }} />}
              {rec.decision === 'Pass' && <XCircle size={32} style={{ color: 'var(--accent-danger)' }} />}
              <span className="rec-label" style={{ color: getScoreColor(rec.confidenceScore || 0) }}>
                {rec.decision || 'N/A'}
              </span>
            </div>
            <div className="rec-confidence">
              <span className="confidence-label">Confidence</span>
              <span className="confidence-value" style={{ color: getScoreColor(rec.confidenceScore || 0) }}>
                {rec.confidenceScore || 0}%
              </span>
              <div className="confidence-bar-full">
                <div 
                  className="confidence-fill"
                  style={{ 
                    width: `${rec.confidenceScore || 0}%`,
                    background: getScoreColor(rec.confidenceScore || 0)
                  }}
                />
              </div>
            </div>
          </div>
          <div className="rec-summary">
            <p>{rec.summary || 'No summary available'}</p>
          </div>
        </div>

        {/* Scores Breakdown */}
        <div className="scores-section">
          <h2>Score Breakdown</h2>
          <div className="scores-grid">
            {Object.entries(scores).map(([key, value]) => {
              const label = key.replace(/([A-Z])/g, ' $1').trim();
              return (
                <div key={key} className="score-item">
                  <div className="score-header">
                    <span className="score-name">{label}</span>
                    <span className="score-value" style={{ color: getScoreColor(value.score || 0) }}>
                      {value.score || 0}%
                    </span>
                  </div>
                  <div className="score-bar">
                    <div 
                      className="score-fill"
                      style={{ 
                        width: `${value.score || 0}%`,
                        background: getScoreColor(value.score || 0)
                      }}
                    />
                  </div>
                  <span className="score-weight">Weight: {Math.round((value.weight || 0) * 100)}%</span>
                  {value.explanation && (
                    <p className="score-explanation">{value.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reasoning */}
        {rec.reasoning && rec.reasoning.length > 0 && (
          <div className="reasoning-section">
            <h2>Key Reasoning</h2>
            <ul className="reasoning-list">
              {rec.reasoning.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Drivers */}
        {rec.keyDrivers && rec.keyDrivers.length > 0 && (
          <div className="drivers-section">
            <h2>Key Drivers</h2>
            <ul className="drivers-list">
              {rec.keyDrivers.map((driver, idx) => (
                <li key={idx}>{driver}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks to Monitor */}
        {rec.risksToMonitor && rec.risksToMonitor.length > 0 && (
          <div className="risks-section">
            <h2>Risks to Monitor</h2>
            <ul className="risks-list">
              {rec.risksToMonitor.map((risk, idx) => (
                <li key={idx}>{risk}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Financial Highlights */}
        {financials && (
          <div className="financial-highlights">
            <h2>Financial Highlights</h2>
            <div className="financial-grid">
              {financials.revenue && (
                <div className="financial-item">
                  <span className="financial-label">Revenue</span>
                  <span className="financial-value">${(financials.revenue.current / 1e9).toFixed(2)}B</span>
                </div>
              )}
              {financials.profit && (
                <div className="financial-item">
                  <span className="financial-label">Net Income</span>
                  <span className="financial-value">${(financials.profit.current / 1e9).toFixed(2)}B</span>
                </div>
              )}
              {financials.assets && (
                <div className="financial-item">
                  <span className="financial-label">Total Assets</span>
                  <span className="financial-value">${(financials.assets.current / 1e9).toFixed(2)}B</span>
                </div>
              )}
              {financials.liabilities && (
                <div className="financial-item">
                  <span className="financial-label">Total Liabilities</span>
                  <span className="financial-value">${(financials.liabilities.current / 1e9).toFixed(2)}B</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchDetail;
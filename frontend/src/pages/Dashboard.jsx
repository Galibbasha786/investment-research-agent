import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useResearch } from '../context/ResearchContext';
import axios from 'axios';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Building2, 
  Clock, 
  Trash2, 
  Eye,
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  Database
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { researchHistory, getResearchHistory, loading, error } = useResearch();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    getResearchHistory();
  }, []);

  const handleViewDetails = (researchId) => {
    navigate(`/research/${researchId}`);
  };

  const handleDeleteResearch = async (id) => {
    try {
      setDeletingId(id);
      // Call API to delete
      const response = await axios.delete(`/api/research/${id}`);

      if (response.data.success) {
        await getResearchHistory(); // Refresh list
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportReport = async (research) => {
    try {
      const response = await axios.post('/api/research/export', 
        { researchId: research._id },
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

  const getRecommendationColor = (rec) => {
    if (!rec) return 'var(--text-secondary)';
    switch(rec) {
      case 'Invest': return 'var(--accent-success)';
      case 'Hold': return 'var(--accent-warning)';
      case 'Pass': return 'var(--accent-danger)';
      default: return 'var(--text-secondary)';
    }
  };

  const getRecommendationIcon = (rec) => {
    if (!rec) return null;
    switch(rec) {
      case 'Invest': return <CheckCircle size={16} />;
      case 'Hold': return <AlertCircle size={16} />;
      case 'Pass': return <XCircle size={16} />;
      default: return null;
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 80) return 'var(--accent-success)';
    if (score >= 60) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const stats = {
    total: researchHistory?.length || 0,
    invest: researchHistory?.filter(r => r.recommendation?.decision === 'Invest').length || 0,
    hold: researchHistory?.filter(r => r.recommendation?.decision === 'Hold').length || 0,
    pass: researchHistory?.filter(r => r.recommendation?.decision === 'Pass').length || 0,
    avgConfidence: researchHistory?.length > 0 
      ? Math.round(researchHistory.reduce((acc, r) => acc + (r.recommendation?.confidenceScore || 0), 0) / researchHistory.length)
      : 0
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <h1>Welcome back, {user?.name}</h1>
          <p>Your investment research dashboard</p>
          <span className="dashboard-live-status">
            Live
          </span>
        </div>
        <Link to="/research" className="new-research-btn">
          <FileText size={20} />
          New Research
        </Link>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <Database size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Research</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--accent-success)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: 'var(--accent-success)' }}>{stats.invest}</span>
            <span className="stat-label">Invest Recommendations</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--accent-warning)' }}>
            <BarChart3 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: 'var(--accent-warning)' }}>{stats.hold}</span>
            <span className="stat-label">Hold Recommendations</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--accent-danger)' }}>
            <TrendingDown size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: 'var(--accent-danger)' }}>{stats.pass}</span>
            <span className="stat-label">Pass Recommendations</span>
          </div>
        </div>
      </div>

      <div className="research-history">
        <h2>Research History</h2>

        {error && (
          <div className="dashboard-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="shimmer-card"></div>
            <div className="shimmer-card"></div>
            <div className="shimmer-card"></div>
          </div>
        ) : researchHistory?.length > 0 ? (
          <div className="research-list">
            {researchHistory.map((item) => (
              <div className="research-item" key={item._id}>
                <div className="research-company">
                  <span className="company-name">{item.companyName}</span>
                  <span className="company-symbol">{item.companySymbol}</span>
                </div>
                <div className="research-date">
                  <Clock size={14} />
                  {formatDate(item.analysisDate || item.createdAt)}
                </div>
                <div 
                  className="research-recommendation"
                  style={{ 
                    color: getRecommendationColor(item.recommendation?.decision),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {getRecommendationIcon(item.recommendation?.decision)}
                  {item.recommendation?.decision || 'N/A'}
                </div>
                <div className="research-confidence">
                  <div 
                    className="confidence-bar"
                    style={{ 
                      width: `${item.recommendation?.confidenceScore || 0}%`,
                      background: getConfidenceColor(item.recommendation?.confidenceScore || 0),
                      color: getConfidenceColor(item.recommendation?.confidenceScore || 0)
                    }}
                  />
                  <span className="confidence-value">{item.recommendation?.confidenceScore || 0}%</span>
                </div>
                <div className="research-actions">
                  <button 
                    onClick={() => handleViewDetails(item._id)}
                    className="action-btn view-btn"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={() => handleExportReport(item)}
                    className="action-btn export-btn"
                    title="Export Report"
                  >
                    <Download size={16} />
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(item._id)}
                    className="action-btn delete-btn"
                    title="Delete Research"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {showDeleteConfirm === item._id && (
                  <div className="delete-confirm-overlay">
                    <div className="delete-confirm-dialog">
                      <p>Delete research for {item.companyName}?</p>
                      <div className="delete-confirm-actions">
                        <button 
                          onClick={() => handleDeleteResearch(item._id)}
                          className="confirm-delete-btn"
                          disabled={deletingId === item._id}
                        >
                          {deletingId === item._id ? 'Deleting...' : 'Delete'}
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(null)}
                          className="cancel-delete-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <Building2 size={28} />
            </div>
            <p>No research history yet</p>
            <p className="empty-sub">Start your first company analysis</p>
            <Link to="/research" className="empty-action-btn">
              <FileText size={16} />
              Start Research
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
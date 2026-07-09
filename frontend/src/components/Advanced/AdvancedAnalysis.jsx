import React, { useState } from 'react';
import axios from 'axios';
import { 
  Brain, 
  Activity, 
  BarChart3, 
  TrendingUp, 
  Shield, 
  Target,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Layers,
  GitBranch,
  Users,
  Database,
  Zap,
  RefreshCw,
  Search,
  Building2,
  FileText,
  Sparkles
} from 'lucide-react';
import './AdvancedAnalysis.css';

const AdvancedAnalysis = () => {
  const [symbol, setSymbol] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState('idle');
  const [searchHistory, setSearchHistory] = useState([]);

  const runAdvancedAnalysis = async () => {
    if (!symbol.trim()) {
      setError('Please enter a company symbol');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setActiveStep('starting');

      // Fetch company data (non-blocking – analysis runs even if this fails)
      let companyData = null;
      try {
        const companyResponse = await axios.get(`/api/research/company/${symbol.toUpperCase()}`);
        companyData = companyResponse.data.data;
      } catch (companyErr) {
        console.warn('Company data fetch failed, proceeding without it:', companyErr.message);
      }

      setActiveStep('parallel');

      // Run advanced analysis
      const response = await axios.post('/api/advanced/analyze', {
        symbol: symbol.toUpperCase(),
        companyData: companyData
      });

      setActiveStep('complete');

      const analysisResult = response.data.data;
      if (!analysisResult || (!analysisResult.success && analysisResult.error)) {
        throw new Error(analysisResult?.error || 'Analysis returned no results');
      }

      setResult(analysisResult);
      
      // Add to search history
      setSearchHistory(prev => [
        { 
          symbol: symbol.toUpperCase(), 
          companyName: companyData?.profile?.name || analysisResult?.data?.companyName || symbol.toUpperCase(), 
          timestamp: new Date() 
        },
        ...prev.slice(0, 9)
      ]);
      
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Advanced analysis failed');
      setActiveStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      runAdvancedAnalysis();
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
      case 'Invest': return <CheckCircle size={20} />;
      case 'Hold': return <AlertCircle size={20} />;
      case 'Pass': return <XCircle size={20} />;
      default: return null;
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="advanced-page">
      <div className="advanced-page-header">
        <div className="advanced-page-title">
          <h1>
            <Brain size={32} />
            Advanced AI Analysis
          </h1>
          <p>Multi-agent LangGraph analysis with parallel processing, sentiment analysis, and intelligent recommendations</p>
        </div>
        <div className="advanced-version-badge">
          <GitBranch size={16} />
          v2.0
          <span className="badge-dot"></span>
          LangGraph
        </div>
      </div>

      {/* Search Section */}
      <div className="advanced-search-section">
        <div className="advanced-search-container">
          <div className="search-input-group">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Enter company symbol (e.g., AAPL, TSLA, MSFT)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyPress={handleKeyPress}
              className="advanced-search-input"
            />
            <button 
              onClick={runAdvancedAnalysis}
              disabled={loading || !symbol.trim()}
              className="advanced-search-btn"
            >
              {loading ? <RefreshCw size={18} className="spinning" /> : <Zap size={18} />}
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
          <div className="search-hint">
            <span>Try: AAPL, TSLA, MSFT, GOOGL, AMZN, NVDA</span>
            <span className="agent-info">
              <Users size={14} />
              5 Agents
            </span>
          </div>
        </div>

        {/* Search History */}
        {searchHistory.length > 0 && (
          <div className="search-history">
            <span className="history-label">Recent:</span>
            {searchHistory.map((item, i) => (
              <button
                key={i}
                className="history-item"
                onClick={() => {
                  setSymbol(item.symbol);
                  setCompanyName(item.companyName);
                  setTimeout(runAdvancedAnalysis, 100);
                }}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="advanced-error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">×</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="advanced-loading-container">
          <div className="advanced-loader-card">
            <div className="loader-spinner"></div>
            <p className="loader-title">AI Agents are analyzing {symbol || 'company'}...</p>
            <div className="agent-workflow-visual">
              <div className={`agent-node ${activeStep === 'starting' || activeStep === 'parallel' ? 'active' : ''}`}>
                <Layers size={18} />
                <span>Parallel Analysis</span>
                <div className="node-status"></div>
              </div>
              <div className="agent-connector">→</div>
              <div className={`agent-node ${activeStep === 'gathering' || activeStep === 'parallel' ? 'active' : ''}`}>
                <Database size={18} />
                <span>Gather Data</span>
                <div className="node-status"></div>
              </div>
              <div className="agent-connector">→</div>
              <div className={`agent-node ${activeStep === 'sentiment' || activeStep === 'gathering' ? 'active' : ''}`}>
                <TrendingUp size={18} />
                <span>Sentiment</span>
                <div className="node-status"></div>
              </div>
              <div className="agent-connector">→</div>
              <div className={`agent-node ${activeStep === 'recommendation' || activeStep === 'sentiment' ? 'active' : ''}`}>
                <Target size={18} />
                <span>Recommendation</span>
                <div className="node-status"></div>
              </div>
              <div className="agent-connector">→</div>
              <div className={`agent-node ${activeStep === 'complete' ? 'active' : ''}`}>
                <Sparkles size={18} />
                <span>Complete</span>
                <div className="node-status"></div>
              </div>
            </div>
            <div className="agent-status-messages">
              <span className="status-message">
                {activeStep === 'starting' && '🔄 Initializing agents...'}
                {activeStep === 'parallel' && '📊 Running parallel financial analysis...'}
                {activeStep === 'gathering' && '📰 Gathering news and videos...'}
                {activeStep === 'sentiment' && '📈 Analyzing market sentiment...'}
                {activeStep === 'recommendation' && '🎯 Generating recommendation...'}
                {activeStep === 'complete' && '✅ Analysis complete!'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="advanced-results-container fade-in">
          {/* Company Header */}
          <div className="result-company-header">
            <div className="company-info">
              <Building2 size={24} />
              <h2>{result.data?.companyName || result.symbol}</h2>
              <span className="company-symbol">{result.symbol}</span>
              {result.data?.industry && (
                <span className="company-industry">{result.data.industry}</span>
              )}
            </div>
            <div className="result-meta">
              <span className="meta-item">
                <Clock size={14} />
                {formatDate(result.data?.generatedAt)}
              </span>
              <span className="meta-item">
                <Activity size={14} />
                v{result.data?.agentVersion || '2.0'}
              </span>
            </div>
          </div>

          {/* Recommendation Summary */}
          <div className="result-recommendation-card">
            <div className="rec-main">
              <div className="rec-decision" style={{ 
                borderColor: getRecommendationColor(result.data?.recommendation?.recommendation) 
              }}>
                {getRecommendationIcon(result.data?.recommendation?.recommendation)}
                <span className="rec-label" style={{ 
                  color: getRecommendationColor(result.data?.recommendation?.recommendation) 
                }}>
                  {result.data?.recommendation?.recommendation || 'Hold'}
                </span>
              </div>
              <div className="rec-confidence">
                <span className="confidence-label">Confidence</span>
                <span className="confidence-value" style={{ 
                  color: getScoreColor(result.data?.recommendation?.confidenceScore || 0) 
                }}>
                  {result.data?.recommendation?.confidenceScore || 0}%
                </span>
                <div className="confidence-bar-container">
                  <div 
                    className="confidence-bar-fill"
                    style={{ 
                      width: `${result.data?.recommendation?.confidenceScore || 0}%`,
                      background: getScoreColor(result.data?.recommendation?.confidenceScore || 0)
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="rec-summary">
              <p>{result.data?.recommendation?.summary || 'Analysis complete'}</p>
            </div>
          </div>

          {/* Analysis Grid */}
          <div className="analysis-grid-container">
            <div className="analysis-card-item">
              <div className="card-icon" style={{ color: 'var(--accent-primary)' }}>
                <BarChart3 size={20} />
              </div>
              <h4>Financial Health</h4>
              <div className="card-score" style={{ color: getScoreColor(result.data?.analysis?.financial?.score || 0) }}>
                {result.data?.analysis?.financial?.score || 0}%
              </div>
              <ul className="card-explanations">
                {(result.data?.analysis?.financial?.explanations || []).slice(0, 3).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="analysis-card-item">
              <div className="card-icon" style={{ color: 'var(--accent-success)' }}>
                <TrendingUp size={20} />
              </div>
              <h4>Growth</h4>
              <div className="card-score" style={{ color: getScoreColor(result.data?.analysis?.growth?.score || 0) }}>
                {result.data?.analysis?.growth?.score || 0}%
              </div>
              <ul className="card-explanations">
                {(result.data?.analysis?.growth?.explanations || []).slice(0, 3).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="analysis-card-item">
              <div className="card-icon" style={{ color: 'var(--accent-warning)' }}>
                <Target size={20} />
              </div>
              <h4>Profitability</h4>
              <div className="card-score" style={{ color: getScoreColor(result.data?.analysis?.profitability?.score || 0) }}>
                {result.data?.analysis?.profitability?.score || 0}%
              </div>
              <ul className="card-explanations">
                {(result.data?.analysis?.profitability?.explanations || []).slice(0, 3).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="analysis-card-item">
              <div className="card-icon" style={{ color: 'var(--accent-danger)' }}>
                <Shield size={20} />
              </div>
              <h4>Risk</h4>
              <div className="card-score" style={{ color: getScoreColor(result.data?.analysis?.risk?.score || 0) }}>
                {result.data?.analysis?.risk?.score || 0}%
              </div>
              <span className="risk-level-badge">{result.data?.analysis?.risk?.riskLevel || 'Medium'}</span>
              <ul className="card-explanations">
                {(result.data?.analysis?.risk?.explanations || []).slice(0, 3).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Detailed Reasoning */}
          <div className="detailed-reasoning">
            <h4>Key Reasoning</h4>
            <ul className="reasoning-list">
              {(result.data?.recommendation?.reasoning || []).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>

            <div className="reasoning-grid">
              <div className="reasoning-section">
                <h5>Key Drivers</h5>
                <ul>
                  {(result.data?.recommendation?.keyDrivers || []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="reasoning-section">
                <h5>Risks to Monitor</h5>
                <ul>
                  {(result.data?.recommendation?.risksToMonitor || []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {result.data?.recommendation?.targetPrice > 0 && (
              <div className="target-price-section">
                <h5>Target Price</h5>
                <span className="target-price-value">${result.data.recommendation.targetPrice}</span>
                <span className="time-horizon">Time Horizon: {result.data.recommendation.timeHorizon || 'N/A'}</span>
              </div>
            )}
          </div>

          {/* Agent Workflow Visualization */}
          <div className="workflow-visualization">
            <h4>Agent Workflow</h4>
            <div className="workflow-diagram">
              <div className="workflow-node completed">
                <span className="node-icon">📊</span>
                <span className="node-label">Parallel Analysis</span>
                <span className="node-check">✓</span>
              </div>
              <div className="workflow-arrow">→</div>
              <div className="workflow-node completed">
                <span className="node-icon">📰</span>
                <span className="node-label">Gather Data</span>
                <span className="node-check">✓</span>
              </div>
              <div className="workflow-arrow">→</div>
              <div className="workflow-node completed">
                <span className="node-icon">📈</span>
                <span className="node-label">Sentiment</span>
                <span className="node-check">✓</span>
              </div>
              <div className="workflow-arrow">→</div>
              <div className="workflow-node completed">
                <span className="node-icon">🎯</span>
                <span className="node-label">Recommendation</span>
                <span className="node-check">✓</span>
              </div>
              <div className="workflow-arrow">→</div>
              <div className="workflow-node completed">
                <span className="node-icon">✅</span>
                <span className="node-label">Final Output</span>
                <span className="node-check">✓</span>
              </div>
            </div>
          </div>

          {/* Errors (if any) */}
          {result.data?.errors && result.data.errors.length > 0 && (
            <div className="errors-section">
              <h5>Errors Encountered</h5>
              <ul>
                {result.data.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedAnalysis;
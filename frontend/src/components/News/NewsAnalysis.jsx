import React, { useState } from 'react';
import axios from 'axios';
import { 
  Newspaper, 
  Youtube, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  BarChart3,
  Brain,
  Search,
  RefreshCw,
  Filter,
  Calendar,
  Globe,
  Video,
  FileText,
  Zap,
  Target,
  Shield,
  Lightbulb
} from 'lucide-react';
import './NewsAnalysis.css';

const NewsAnalysis = () => {
  const [symbol, setSymbol] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchHistory, setSearchHistory] = useState([]);

  const runAnalysis = async () => {
    if (!symbol.trim()) {
      setError('Please enter a company symbol');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post('/api/news/analyze', {
        symbol: symbol.toUpperCase(),
        companyName: companyName || symbol.toUpperCase()
      });

      setAnalysis(response.data.data);
      
      // Add to search history
      setSearchHistory(prev => [
        { symbol: symbol.toUpperCase(), companyName: companyName || symbol.toUpperCase(), timestamp: new Date() },
        ...prev.slice(0, 9)
      ]);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      runAnalysis();
    }
  };

  const getSentimentColor = (score) => {
    if (score > 0.2) return 'var(--accent-success)';
    if (score < -0.2) return 'var(--accent-danger)';
    return 'var(--accent-warning)';
  };

  const getSentimentBadge = (score) => {
    if (score > 0.2) return { text: 'Bullish', color: 'var(--accent-success)' };
    if (score < -0.2) return { text: 'Bearish', color: 'var(--accent-danger)' };
    return { text: 'Neutral', color: 'var(--accent-warning)' };
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="news-page">
      <div className="news-page-header">
        <div className="news-page-title">
          <h1>News & Video Analysis</h1>
          <p>AI-powered analysis of company news and video content</p>
        </div>
      </div>

      {/* Search Section */}
      <div className="news-search-section">
        <div className="news-search-container">
          <div className="search-input-group">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Enter company symbol (e.g., AAPL, TSLA, MSFT)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyPress={handleKeyPress}
              className="news-search-input"
            />
            <button 
              onClick={runAnalysis}
              disabled={loading || !symbol.trim()}
              className="news-search-btn"
            >
              {loading ? <RefreshCw size={18} className="spinning" /> : <Zap size={18} />}
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          <div className="search-hint">
            <span>Try: AAPL, TSLA, MSFT, GOOGL, AMZN</span>
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
                  setTimeout(runAnalysis, 100);
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
        <div className="news-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">×</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="news-loading">
          <div className="news-loader-container">
            <div className="loader-spinner"></div>
            <p className="loader-text">AI Agents are analyzing news and videos...</p>
            <div className="agent-status-grid">
              <span className="agent-status-item active">
                <Newspaper size={14} /> Fetching News
              </span>
              <span className="agent-status-item active">
                <Youtube size={14} /> Fetching Videos
              </span>
              <span className="agent-status-item active">
                <Brain size={14} /> Analyzing Data
              </span>
              <span className="agent-status-item active">
                <FileText size={14} /> Generating Summary
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && !loading && (
        <div className="news-results fade-in">
          {/* Company Header */}
          <div className="news-company-header">
            <div className="company-info">
              <h2>{analysis.symbol}</h2>
              {analysis.analysis && (
                <span className="company-sentiment" style={{ 
                  color: getSentimentColor(
                    analysis.analysis.marketSentiment === 'bullish' ? 0.5 : 
                    analysis.analysis.marketSentiment === 'bearish' ? -0.5 : 0
                  )
                }}>
                  {analysis.analysis.marketSentiment?.toUpperCase() || 'Neutral'} Market
                </span>
              )}
            </div>
            <div className="company-stats">
              <span className="stat">
                <Newspaper size={14} />
                {analysis.news?.length || 0} Articles
              </span>
              <span className="stat">
                <Youtube size={14} />
                {analysis.videos?.length || 0} Videos
              </span>
              <span className="stat">
                <Clock size={14} />
                Updated: {formatDate(new Date())}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="news-tabs-container">
            <button 
              className={`news-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <BarChart3 size={16} />
              Overview
            </button>
            <button 
              className={`news-tab ${activeTab === 'news' ? 'active' : ''}`}
              onClick={() => setActiveTab('news')}
            >
              <Newspaper size={16} />
              News ({analysis.news?.length || 0})
            </button>
            <button 
              className={`news-tab ${activeTab === 'videos' ? 'active' : ''}`}
              onClick={() => setActiveTab('videos')}
            >
              <Youtube size={16} />
              Videos ({analysis.videos?.length || 0})
            </button>
            <button 
              className={`news-tab ${activeTab === 'sentiment' ? 'active' : ''}`}
              onClick={() => setActiveTab('sentiment')}
            >
              <TrendingUp size={16} />
              Sentiment
            </button>
          </div>

          {/* Content */}
          <div className="news-tab-content">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="overview-content">
                {/* Executive Summary */}
                {analysis.summary && (
                  <div className="executive-summary">
                    <h3>Executive Summary</h3>
                    <p>{analysis.summary.executiveSummary}</p>
                    
                    <div className="summary-grid">
                      {analysis.summary.keyTakeaways?.map((takeaway, i) => (
                        <div key={i} className="takeaway-card">
                          <span className="takeaway-number">{i + 1}</span>
                          <p>{takeaway}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analysis Metrics */}
                {analysis.analysis && (
                  <div className="analysis-metrics-grid">
                    <div className="metric-card">
                      <div className="metric-icon">
                        <Target size={20} />
                      </div>
                      <div className="metric-info">
                        <span className="metric-label">Market Sentiment</span>
                        <span className="metric-value" style={{ 
                          color: getSentimentColor(
                            analysis.analysis.marketSentiment === 'bullish' ? 0.5 : 
                            analysis.analysis.marketSentiment === 'bearish' ? -0.5 : 0
                          )
                        }}>
                          {analysis.analysis.marketSentiment?.toUpperCase() || 'Neutral'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-icon">
                        <Shield size={20} />
                      </div>
                      <div className="metric-info">
                        <span className="metric-label">Confidence</span>
                        <span className="metric-value">{analysis.analysis.confidence || 0}%</span>
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-icon">
                        <Newspaper size={20} />
                      </div>
                      <div className="metric-info">
                        <span className="metric-label">News Articles</span>
                        <span className="metric-value">{analysis.news?.length || 0}</span>
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-icon">
                        <Youtube size={20} />
                      </div>
                      <div className="metric-info">
                        <span className="metric-label">Videos</span>
                        <span className="metric-value">{analysis.videos?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Topics */}
                {analysis.analysis?.keyTopics && (
                  <div className="key-topics-section">
                    <h3>Key Topics</h3>
                    <div className="topics-cloud">
                      {analysis.analysis.keyTopics.map((topic, i) => (
                        <span key={i} className="topic-pill">{topic}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trends & Risks */}
                <div className="trends-risks-grid">
                  {analysis.analysis?.emergingTrends && (
                    <div className="trends-card">
                      <h4><TrendingUp size={18} /> Emerging Trends</h4>
                      <ul>
                        {analysis.analysis.emergingTrends.map((trend, i) => (
                          <li key={i}>{trend}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {analysis.analysis?.riskFactors && (
                    <div className="risks-card">
                      <h4><Shield size={18} /> Risk Factors</h4>
                      <ul>
                        {analysis.analysis.riskFactors.map((risk, i) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Opportunities */}
                {analysis.analysis?.opportunityFactors && analysis.analysis.opportunityFactors.length > 0 && (
                  <div className="opportunities-card">
                    <h4><Lightbulb size={18} /> Opportunities</h4>
                    <ul>
                      {analysis.analysis.opportunityFactors.map((opp, i) => (
                        <li key={i}>{opp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                {analysis.summary?.recommendation && (
                  <div className="recommendation-card">
                    <h4>Recommendation</h4>
                    <p>{analysis.summary.recommendation}</p>
                    <span className="confidence-badge">
                      Confidence: {analysis.summary.confidenceScore || 50}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* News Tab */}
            {activeTab === 'news' && (
              <div className="news-list-container">
                {analysis.news?.length > 0 ? (
                  analysis.news.map((item, i) => (
                    <div key={i} className="news-card-item">
                      {item.imageUrl && (
                        <div className="news-image">
                          <img src={item.imageUrl} alt={item.title} />
                        </div>
                      )}
                      <div className="news-content">
                        <div className="news-header-row">
                          <span className="news-source-badge">{item.source}</span>
                          <span className="news-date-badge">
                            <Clock size={12} />
                            {formatDate(item.publishedAt)}
                          </span>
                          <span 
                            className="news-sentiment-badge"
                            style={{ 
                              color: getSentimentColor(item.sentiment),
                              background: `${getSentimentColor(item.sentiment)}15`
                            }}
                          >
                            {item.sentiment > 0.1 && 'Positive'}
                            {item.sentiment < -0.1 && 'Negative'}
                            {item.sentiment >= -0.1 && item.sentiment <= 0.1 && 'Neutral'}
                          </span>
                        </div>
                        <h4>
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            {item.title}
                            <ExternalLink size={14} />
                          </a>
                        </h4>
                        <p>{item.summary}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Newspaper size={32} />
                    <p>No news articles found</p>
                  </div>
                )}
              </div>
            )}

            {/* Videos Tab */}
            {activeTab === 'videos' && (
              <div className="videos-grid-container">
                {analysis.videos?.length > 0 ? (
                  analysis.videos.map((video, i) => (
                    <div key={i} className="video-card-item">
                      <div className="video-thumbnail-wrapper">
                        <img src={video.thumbnail} alt={video.title} />
                        <div className="video-play-overlay">
                          <a href={video.url} target="_blank" rel="noopener noreferrer">
                            <div className="play-button">▶</div>
                          </a>
                        </div>
                      </div>
                      <div className="video-content">
                        <h4>
                          <a href={video.url} target="_blank" rel="noopener noreferrer">
                            {video.title}
                          </a>
                        </h4>
                        <div className="video-meta-row">
                          <span className="video-channel">{video.channelTitle}</span>
                          <span className="video-date">
                            <Clock size={12} />
                            {formatDate(video.publishedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Youtube size={32} />
                    <p>No videos found</p>
                  </div>
                )}
              </div>
            )}

            {/* Sentiment Tab */}
            {activeTab === 'sentiment' && analysis.sentiment && (
              <div className="sentiment-content">
                <div className="sentiment-overview">
                  <div className="sentiment-score-card">
                    <span className="sentiment-label">Overall Sentiment</span>
                    <div className="sentiment-value" style={{ 
                      color: getSentimentColor(analysis.sentiment.overallSentiment || 0)
                    }}>
                      {getSentimentBadge(analysis.sentiment.overallSentiment || 0).text}
                    </div>
                    <div className="sentiment-bar-container">
                      <div 
                        className="sentiment-bar-fill"
                        style={{ 
                          width: `${analysis.sentiment.sentimentScore || 50}%`,
                          background: getSentimentColor(analysis.sentiment.overallSentiment || 0)
                        }}
                      />
                    </div>
                    <span className="sentiment-score-text">
                      Score: {analysis.sentiment.sentimentScore || 50}/100
                    </span>
                  </div>

                  <div className="sentiment-stats">
                    <div className="sentiment-stat">
                      <span className="stat-value">{analysis.sentiment.bullCount || 0}</span>
                      <span className="stat-label">Bullish Articles</span>
                    </div>
                    <div className="sentiment-stat">
                      <span className="stat-value">{analysis.sentiment.neutralCount || 0}</span>
                      <span className="stat-label">Neutral Articles</span>
                    </div>
                    <div className="sentiment-stat">
                      <span className="stat-value">{analysis.sentiment.bearCount || 0}</span>
                      <span className="stat-label">Bearish Articles</span>
                    </div>
                    <div className="sentiment-stat">
                      <span className="stat-value">{analysis.sentiment.totalNews || 0}</span>
                      <span className="stat-label">Total Articles</span>
                    </div>
                  </div>
                </div>

                {/* Top Positive/Negative News */}
                <div className="sentiment-news">
                  <div className="positive-news">
                    <h4><TrendingUp size={16} style={{ color: 'var(--accent-success)' }} /> Top Positive</h4>
                    {analysis.sentiment.topPositive?.map((item, i) => (
                      <div key={i} className="sentiment-news-item positive">
                        <span className="sentiment-news-title">{item.title}</span>
                        <span className="sentiment-news-score">+{(item.sentiment * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="negative-news">
                    <h4><TrendingDown size={16} style={{ color: 'var(--accent-danger)' }} /> Top Negative</h4>
                    {analysis.sentiment.topNegative?.map((item, i) => (
                      <div key={i} className="sentiment-news-item negative">
                        <span className="sentiment-news-title">{item.title}</span>
                        <span className="sentiment-news-score">{(item.sentiment * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsAnalysis;
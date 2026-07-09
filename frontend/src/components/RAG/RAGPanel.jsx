import React, { useState, useEffect } from 'react';
import { useRAG } from '../../context/RAGContext';
import { 
  BookOpen, 
  Search, 
  FileText, 
  Brain, 
  Database, 
  Trash2,
  Send,
  Loader,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import './RAGPanel.css';

const RAGPanel = ({ symbol, companyData }) => {
  const {
    loading,
    error,
    documents,
    processedReport,
    qaHistory,
    recommendation,
    vectorStoreStatus,
    processAnnualReport,
    getDocuments,
    askQuestion,
    getEvidenceRecommendation,
    getVectorStoreStatus,
    clearVectorStore
  } = useRAG();

  const [question, setQuestion] = useState('');
  const [activeTab, setActiveTab] = useState('qa');
  const [processingReport, setProcessingReport] = useState(false);
  const [chunkSearchQuery, setChunkSearchQuery] = useState('');
  const [expandedChunks, setExpandedChunks] = useState({});
  const currentChunkCount = documents?.documents?.length || 0;
  const hasCurrentReport = currentChunkCount > 0;

  useEffect(() => {
    getVectorStoreStatus();
  }, [getVectorStoreStatus]);

  useEffect(() => {
    if (symbol) {
      getDocuments(symbol);
    }
  }, [symbol, activeTab, getDocuments]);

  const handleProcessReport = async () => {
    if (!symbol) {
      alert('Please select a company first');
      return;
    }
    
    setProcessingReport(true);
    try {
      const result = await processAnnualReport(symbol);
      await getVectorStoreStatus();
      alert(`Annual report for ${symbol} processed successfully. ${result.chunksProcessed || 0} chunks are ready for Q&A.`);
    } catch (error) {
      alert(`Failed to process report: ${error.response?.data?.message || error.message}`);
    } finally {
      setProcessingReport(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    try {
      await askQuestion(question, symbol);
      setQuestion('');
    } catch (error) {
      // Error handled by context
    }
  };

  const handleGetRecommendation = async () => {
    if (!symbol || !companyData) {
      alert('Please search for a company first');
      return;
    }
    
    try {
      await getEvidenceRecommendation(symbol, companyData);
    } catch (error) {
      // Error handled by context
    }
  };

  const toggleChunk = (id) => {
    setExpandedChunks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getFilteredChunks = () => {
    if (!documents || !documents.documents) return [];
    
    return documents.documents.map((text, idx) => ({ text, idx }))
      .filter(item => item.text.toLowerCase().includes(chunkSearchQuery.toLowerCase()))
      .map(item => item.idx);
  };

  const filteredChunks = getFilteredChunks();

  return (
    <div className="rag-panel">
      <div className="rag-header">
        <h3><BookOpen size={20} /> RAG Knowledge Base</h3>
        <div className="rag-status">
          <span className={`status-dot ${vectorStoreStatus.initialized ? 'active' : 'inactive'}`} />
          <span>{vectorStoreStatus.documentCount || 0} documents</span>
        </div>
      </div>

      <div className="rag-tabs">
        <button 
          className={`tab-btn ${activeTab === 'qa' ? 'active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          <Brain size={16} /> Q&A
        </button>
        <button 
          className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <FileText size={16} /> Documents
        </button>
        <button 
          className={`tab-btn ${activeTab === 'recommendation' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendation')}
        >
          <TrendingUp size={16} /> Recommendation
        </button>
      </div>

      <div className="rag-content">
        {/* Q&A Tab */}
        {activeTab === 'qa' && (
          <div className="qa-section">
            <div className="qa-controls">
              <button 
                onClick={handleProcessReport} 
                className="process-btn"
                disabled={processingReport || !symbol}
              >
                {processingReport ? (
                  <Loader size={16} className="spinning" />
                ) : (
                  <Database size={16} />
                )}
                {processingReport ? 'Processing...' : 'Process Annual Report'}
              </button>
              
              {hasCurrentReport && (
                <button 
                  onClick={handleGetRecommendation}
                  className="recommend-btn"
                  disabled={loading}
                >
                  <TrendingUp size={16} />
                  Get Recommendation
                </button>
              )}
            </div>

            <form onSubmit={handleAskQuestion} className="qa-form">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about the company..."
                disabled={loading || !hasCurrentReport}
              />
              <button type="submit" disabled={loading || !question.trim() || !hasCurrentReport}>
                {loading ? <Loader size={18} className="spinning" /> : <Send size={18} />}
              </button>
            </form>

            {error && (
              <div className="rag-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {!hasCurrentReport && (
              <div className="rag-empty">
                <BookOpen size={32} />
                <p>No report processed for {symbol || 'this company'} yet</p>
                <p className="rag-hint">Click "Process Annual Report" to ingest company filings</p>
              </div>
            )}

            <div className="qa-history">
              {qaHistory.map((item) => (
                <div key={item.id} className="qa-item">
                  <div className="qa-question">
                    <span className="qa-icon">Q</span>
                    <span>{item.query}</span>
                  </div>
                  <div className="qa-answer">
                    <span className="qa-icon">A</span>
                    <div className="qa-answer-content">
                      <p>{item.answer}</p>
                      {item.sources && item.sources.length > 0 && (
                        <div className="qa-sources">
                          <small>Sources:</small>
                          {item.sources.map((source, i) => (
                            <span key={i} className="source-tag">
                              {source.symbol} - {source.source}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="documents-section">
            <div className="documents-controls">
              <button 
                onClick={handleProcessReport}
                className="process-btn"
                disabled={processingReport || !symbol}
              >
                {processingReport ? (
                  <Loader size={16} className="spinning" />
                ) : (
                  <Database size={16} />
                )}
                {processingReport ? 'Processing...' : 'Process Annual Report'}
              </button>
              
              {vectorStoreStatus.documentCount > 0 && (
                <button 
                  onClick={clearVectorStore}
                  className="clear-btn"
                  disabled={loading}
                >
                  <Trash2 size={16} />
                  Clear All
                </button>
              )}
            </div>

            <div className="documents-stats">
              <div className="stat-card">
                <span className="stat-value">{vectorStoreStatus.documentCount}</span>
                <span className="stat-label">Documents in Vector Store</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{currentChunkCount}</span>
                <span className="stat-label">Current Report Chunks</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{symbol || 'N/A'}</span>
                <span className="stat-label">Current Company</span>
              </div>
            </div>

            <div className="documents-info">
              <h4>How RAG Works</h4>
              <ol>
                <li>Annual reports are fetched from SEC EDGAR</li>
                <li>Documents are split into semantic chunks</li>
                <li>Chunks are embedded using Gemini AI</li>
                <li>Embedded chunks are stored in vector database</li>
                <li>Questions are answered with relevant context</li>
                <li>Recommendations are evidence-based</li>
              </ol>
            </div>

            {/* Document Content Chunks Viewer */}
            <div className="report-viewer-section">
              <h4><FileText size={18} /> Processed Report Chunks</h4>
              
              <div className="chunk-search">
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Filter chunks by keyword..." 
                  value={chunkSearchQuery}
                  onChange={(e) => setChunkSearchQuery(e.target.value)}
                />
              </div>

              {!documents || !documents.documents || documents.documents.length === 0 ? (
                <div className="no-chunks-found">
                  {processedReport?.symbol === symbol && processedReport?.textPreview ? (
                    <>
                      <p>Report processed, but stored chunks could not be loaded. Preview:</p>
                      <p className="report-preview">{processedReport.textPreview}</p>
                    </>
                  ) : (
                    <p>No document content loaded. Please click "Process Annual Report" to ingest company filings.</p>
                  )}
                </div>
              ) : filteredChunks.length === 0 ? (
                <div className="no-chunks-found">
                  <p>No chunks matching your search criteria.</p>
                </div>
              ) : (
                <div className="chunks-list">
                  {filteredChunks.map((chunkIndex) => {
                    const text = documents.documents[chunkIndex];
                    const metadata = documents.metadatas[chunkIndex];
                    const id = documents.ids[chunkIndex];
                    const isExpanded = expandedChunks[id];

                    return (
                      <div key={id} className={`chunk-card ${isExpanded ? 'expanded' : ''}`}>
                        <div className="chunk-card-header" onClick={() => toggleChunk(id)}>
                          <span className="chunk-badge">Chunk #{chunkIndex + 1}</span>
                          <span className="chunk-source">
                            {(metadata && metadata.source) || 'SEC EDGAR'} ({ (metadata && metadata.type) || '10-K' })
                          </span>
                          <button className="expand-toggle-btn">
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        </div>
                        <div className="chunk-card-body">
                          <p className="chunk-text">
                            {isExpanded ? text : `${text.substring(0, 300)}...`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommendation Tab */}
        {activeTab === 'recommendation' && (
          <div className="recommendation-section">
            {!recommendation ? (
              <div className="rag-empty">
                <TrendingUp size={32} />
                <p>No recommendation generated yet</p>
                <button 
                  onClick={handleGetRecommendation}
                  className="generate-rec-btn"
                  disabled={loading || !symbol}
                >
                  {loading ? <Loader size={16} className="spinning" /> : 'Generate Recommendation'}
                </button>
              </div>
            ) : (
              <div className="recommendation-result">
                <div className={`rec-header ${recommendation.recommendation?.toLowerCase() || 'hold'}`}>
                  <h4>
                    {recommendation.recommendation || 'Hold'}
                  </h4>
                  <span>Confidence: {recommendation.confidenceScore || 0}%</span>
                </div>

                <div className="rec-content">
                  <div className="rec-reasoning">
                    <h5>Key Reasoning</h5>
                    <ul>
                      {recommendation.reasoning?.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  {recommendation.evidence && recommendation.evidence.length > 0 && (
                    <div className="rec-evidence">
                      <h5>Evidence</h5>
                      <ul>
                        {recommendation.evidence.map((item, i) => (
                          <li key={i}>
                            <strong>{item.claim}</strong>
                            <p>{item.evidence}</p>
                            <small>Source: {item.source}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rec-risks">
                    <h5>Risks</h5>
                    <ul>
                      {recommendation.risks?.map((risk, i) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  </div>

                  {recommendation.keyMetrics && (
                    <div className="rec-metrics">
                      <h5>Key Metrics</h5>
                      <div className="metrics-grid">
                        {Object.entries(recommendation.keyMetrics).map(([key, value]) => (
                          <div key={key} className="metric-item">
                            <span className="metric-label">{key}</span>
                            <span className="metric-value">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendation.sources && recommendation.sources.length > 0 && (
                    <div className="rec-sources">
                      <h5>Sources</h5>
                      <div className="source-list">
                        {recommendation.sources.map((source, i) => (
                          <span key={i} className="source-tag">
                            {source.symbol} - {source.source}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RAGPanel;

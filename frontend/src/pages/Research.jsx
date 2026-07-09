import React, { useState } from 'react';
import { BarChart3, Brain, Database, Gauge } from 'lucide-react';
import { useResearch } from '../context/ResearchContext';
import CompanySearch from '../components/Research/CompanySearch';
import CompanyProfile from '../components/Research/CompanyProfile';
import FinancialMetrics from '../components/Research/FinancialMetrics';
import TrendsChart from '../components/Research/TrendsChart';
import AIAnalysis from '../components/Research/AIAnalysis';
import RAGPanel from '../components/RAG/RAGPanel';
import ScoreCard from '../components/Scoring/ScoreCard';
import './Research.css';

const Research = () => {
  const {
    companyData,
    companyLoading,
    error,
    getCompanyData,
    saveResearch,
    getResearchHistory
  } = useResearch();

  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [showRAG, setShowRAG] = useState(false);
  const [showScore, setShowScore] = useState(false);

  const buildRecommendation = (data) => {
    let score = 50;
    const latestRevenue = data.revenueTrends?.[0]?.revenueGrowth || 0;
    const ratios = data.ratios || {};
    const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

    if (isNumber(ratios.pe) && ratios.pe > 0 && ratios.pe <= 25) score += 10;
    if (isNumber(ratios.pe) && ratios.pe > 40) score -= 10;
    if (isNumber(ratios.roe) && ratios.roe >= 0.15) score += 10;
    if (isNumber(ratios.roe) && ratios.roe < 0.05) score -= 5;
    if (isNumber(ratios.currentRatio) && ratios.currentRatio >= 1.2) score += 5;
    if (isNumber(ratios.debtToEquity) && ratios.debtToEquity > 2) score -= 10;
    if (latestRevenue >= 10) score += 10;
    if (latestRevenue < 0) score -= 10;

    const confidenceScore = Math.max(0, Math.min(100, Math.round(score)));
    const decision = confidenceScore >= 70 ? 'Invest' : confidenceScore >= 45 ? 'Hold' : 'Pass';

    return {
      decision,
      confidenceScore,
      summary: `${decision} based on current valuation, profitability, balance sheet, and growth metrics.`
    };
  };

  const handleCompanySelect = async (symbol) => {
    setSelectedSymbol(symbol);
    setShowAI(false);
    setShowRAG(false);
    setShowScore(false);
    const data = await getCompanyData(symbol);

    if (data?.profile?.name) {
      await saveResearch({
        companyName: data.profile.name,
        companySymbol: data.profile.symbol || symbol,
        companyProfile: data.profile,
        financialData: data.financials,
        ratios: data.ratios,
        recommendation: buildRecommendation(data)
      });
      await getResearchHistory();
    }
  };

  const handleAIAnalysisComplete = () => {
    getResearchHistory();
  };

  return (
    <div className="research-page">
      <div className="research-header">
        <div>
          <span className="research-eyebrow">Research workspace</span>
          <h1>Company Research</h1>
          <p>Search, score, and analyze public companies with structured financial intelligence.</p>
        </div>
        <div className="research-header-metrics">
          <span><Database size={16} /> Financials</span>
          <span><Brain size={16} /> AI analysis</span>
          <span><Gauge size={16} /> Scoring</span>
        </div>
      </div>

      <CompanySearch onSelect={handleCompanySelect} />

      {companyLoading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Fetching company data...</p>
        </div>
      )}

      {error && (
        <div className="error-container">
          <p className="error-text">{error}</p>
        </div>
      )}

      {companyData && !companyLoading && (
        <div className="research-results fade-in">
          <CompanyProfile profile={companyData.profile} />

          {companyData.dataErrors && Object.keys(companyData.dataErrors).length > 0 && (
            <div className="data-warning">
              <strong>Some financial sections could not load.</strong>
              <ul>
                {Object.entries(companyData.dataErrors).map(([section, message]) => (
                  <li key={section}>
                    <span>{section}:</span> {message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="metrics-grid">
            <FinancialMetrics 
              ratios={companyData.ratios}
              cashFlow={companyData.cashFlow}
              balanceSheet={companyData.balanceSheet}
            />
            <TrendsChart 
              revenueTrends={companyData.revenueTrends}
              cashFlow={companyData.cashFlow}
            />
          </div>

          {/* AI Analysis Section */}
          <div className="ai-section">
            <div className="ai-toggle">
              <button 
                onClick={() => setShowAI(!showAI)}
                className="ai-toggle-btn"
              >
                <Brain size={18} />
                {showAI ? 'Hide AI Analysis' : 'Show AI Analysis'}
                <span className="ai-badge">AI</span>
              </button>
            </div>
            
            {showAI && selectedSymbol && (
              <AIAnalysis 
                symbol={selectedSymbol}
                companyData={companyData}
                onAnalysisComplete={handleAIAnalysisComplete}
              />
            )}
          </div>
          <div className="score-section">
            <div className="score-toggle">
              <button 
                onClick={() => setShowScore(!showScore)}
                className="score-toggle-btn"
              >
                <BarChart3 size={18} />
                {showScore ? 'Hide Investment Score' : 'Show Investment Score'}
                <span className="score-badge">Score</span>
              </button>
            </div>
            
            {showScore && selectedSymbol && (
              <ScoreCard 
                symbol={selectedSymbol}
                companyData={companyData}
              />
            )}
          </div>

          {/* RAG Section */}
          <div className="rag-section">
            <div className="rag-toggle">
              <button 
                onClick={() => setShowRAG(!showRAG)}
                className="rag-toggle-btn"
              >
                <Database size={18} />
                {showRAG ? 'Hide RAG Knowledge Base' : 'Show RAG Knowledge Base'}
                <span className="rag-badge">RAG</span>
              </button>
            </div>
            
            {showRAG && selectedSymbol && (
              <RAGPanel 
                symbol={selectedSymbol}
                companyData={companyData}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Research;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Brain, BriefcaseBusiness, RefreshCcw, Rocket, ShieldAlert, TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle, Loader, WalletCards } from 'lucide-react';
import './AIAnalysis.css';

const AIAnalysis = ({ symbol, companyData, onAnalysisComplete }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const hasTextItems = (value) => Array.isArray(value) && value.some((item) => String(item || '').trim());

  const hasMeaningfulAnalysis = (data) => {
    if (!data) return false;

    return Boolean(
      hasTextItems(data?.analysis?.financial?.strengths) ||
      hasTextItems(data?.analysis?.financial?.weaknesses) ||
      hasTextItems(data?.analysis?.swot?.strengths) ||
      hasTextItems(data?.analysis?.swot?.weaknesses) ||
      hasTextItems(data?.analysis?.businessModel?.revenueStreams) ||
      hasTextItems(data?.analysis?.businessModel?.customerSegments) ||
      hasTextItems(data?.analysis?.risk?.keyRisks)
    );
  };

  // Run AI Analysis
  const runAIAnalysis = async (force = false) => {
    try {
      setIsAnalyzing(true);
      setLoading(true);
      setError(null);

      console.log('Running AI Analysis for:', symbol);
      console.log('Company Data:', companyData);

      const response = await axios.post('/api/ai/analyze', {
        symbol: symbol,
        force
      });

      console.log('AI Analysis Response:', response.data);

      if (response.data.success && response.data.data) {
        // Ensure the data has the expected structure
        const analysisData = response.data.data;

        if (!hasMeaningfulAnalysis(analysisData)) {
          setError('Gemini returned an incomplete analysis. Please try regenerating.');
          return;
        }
        
        // If the data doesn't have the expected structure, create it
        const formattedData = {
          analysis: analysisData.analysis || {
            financial: {
              score: 0,
              assessment: 'Analysis in progress',
              strengths: ['Data being processed'],
              weaknesses: ['Data being processed'],
              redFlags: [],
              recommendations: []
            },
            swot: {
              strengths: ['Analyzing...'],
              weaknesses: ['Analyzing...'],
              opportunities: ['Analyzing...'],
              threats: ['Analyzing...']
            },
            businessModel: {
              description: 'Analysis in progress',
              revenueStreams: ['Processing data...'],
              customerSegments: ['Processing data...'],
              competitiveAdvantage: 'Being analyzed',
              economicMoat: 'Being evaluated',
              strengthScore: 50
            },
            risk: {
              riskScores: {
                financial: 5,
                business: 5,
                market: 5,
                regulatory: 5,
                competitive: 5,
                operational: 5
              },
              overallRiskScore: 50,
              keyRisks: ['Analysis in progress'],
              mitigationStrategies: ['Being developed']
            }
          },
          recommendation: analysisData.recommendation || {
            recommendation: 'Hold',
            confidenceScore: 50,
            reasoning: ['Analysis in progress'],
            keyDrivers: ['Being identified'],
            risksToMonitor: ['Being evaluated']
          },
          company: analysisData.company || {
            name: companyData?.profile?.name || 'Unknown',
            symbol: symbol || 'N/A'
          },
          errors: analysisData.errors || [],
          generatedAt: analysisData.generatedAt || new Date().toISOString()
        };

        setAnalysis(formattedData);
        
        if (onAnalysisComplete) {
          onAnalysisComplete(formattedData);
        }
      } else {
        setError('No analysis data received');
      }
    } catch (err) {
      console.error('AI Analysis Error:', err);
      setError(err.response?.data?.message || 'AI analysis failed. Please try again.');
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  // Helper to safely get nested data
  const safeGet = (obj, path, fallback = null) => {
    try {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current === undefined || current === null) return fallback;
        current = current[part];
      }
      return current !== undefined && current !== null ? current : fallback;
    } catch {
      return fallback;
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
      case 'Invest': return <CheckCircle size={24} />;
      case 'Hold': return <AlertCircle size={24} />;
      case 'Pass': return <XCircle size={24} />;
      default: return null;
    }
  };

  // Auto-run analysis when component mounts if we have company data
  useEffect(() => {
    if (companyData && !analysis && !isAnalyzing) {
      // Check if we already have analysis in the data
      const hasAnalysis = companyData.aiAnalysis || companyData.analysis;
      if (hasAnalysis) {
        console.log('Using existing analysis data');
        // Format existing data
        const existingData = companyData.aiAnalysis || companyData.analysis;
        if (hasMeaningfulAnalysis(existingData)) {
          setAnalysis(existingData);
        } else {
          runAIAnalysis(true);
        }
      } else {
        // Run analysis automatically
        runAIAnalysis();
      }
    }
  }, [companyData]);

  if (!companyData) {
    return (
      <div className="ai-analysis-placeholder">
        <div className="ai-prompt">
          <Brain size={32} />
          <h3>Search for a company first</h3>
          <p>Please search and select a company to run AI analysis</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ai-analysis-loading">
        <div className="ai-loader">
          <div className="loader-spinner"></div>
          <p>AI Agents are analyzing {companyData?.profile?.name || 'the company'}...</p>
          <div className="agent-status">
            <span className="agent-dot active"><WalletCards size={14} /> Financial Analysis</span>
            <span className="agent-dot active"><TrendingUp size={14} /> SWOT Analysis</span>
            <span className="agent-dot active"><BriefcaseBusiness size={14} /> Business Model</span>
            <span className="agent-dot active"><ShieldAlert size={14} /> Risk Assessment</span>
            <span className="agent-dot active"><CheckCircle size={14} /> Final Recommendation</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-analysis-error">
        <AlertCircle size={24} />
        <p>{error}</p>
        <button onClick={() => runAIAnalysis(true)} className="retry-btn">Retry Analysis</button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="ai-analysis-placeholder">
        <div className="ai-prompt">
          <Brain size={32} />
          <h3>Ready for AI Analysis</h3>
          <p>Get comprehensive AI-powered analysis of {companyData?.profile?.name || 'this company'}</p>
          <button onClick={() => runAIAnalysis()} className="ai-analyze-btn">
            <Rocket size={18} />
            Run AI Analysis
          </button>
        </div>
      </div>
    );
  }

  // Extract data safely with fallbacks
  const recommendation = safeGet(analysis, 'recommendation', {});
  const analysisData = safeGet(analysis, 'analysis', {});
  const financial = safeGet(analysisData, 'financial', {});
  const swot = safeGet(analysisData, 'swot', {});
  const businessModel = safeGet(analysisData, 'businessModel', {});
  const risk = safeGet(analysisData, 'risk', {});

  console.log('Rendering Analysis:', { recommendation, financial, swot, businessModel, risk });

  return (
    <div className="ai-analysis-results fade-in">
      <div className="ai-header">
        <h3><Brain size={20} /> AI Multi-Agent Analysis</h3>
        <span className="ai-badge">Powered by Gemini</span>
      </div>

      {/* Recommendation Card */}
      <div className="recommendation-card" style={{ 
        borderColor: getRecommendationColor(recommendation?.recommendation) 
      }}>
        <div className="recommendation-header">
          <div className="recommendation-badge">
            {getRecommendationIcon(recommendation?.recommendation)}
            <span style={{ color: getRecommendationColor(recommendation?.recommendation) }}>
              {recommendation?.recommendation || 'Hold'}
            </span>
          </div>
          <div className="confidence-score">
            <span>Confidence: {recommendation?.confidenceScore || 0}%</span>
            <div className="confidence-bar">
              <div 
                className="confidence-fill"
                style={{ 
                  width: `${recommendation?.confidenceScore || 0}%`,
                  background: (recommendation?.confidenceScore || 0) >= 70 
                    ? 'var(--accent-success)' 
                    : (recommendation?.confidenceScore || 0) >= 45 
                    ? 'var(--accent-warning)' 
                    : 'var(--accent-danger)'
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="recommendation-reasoning">
          <h4>Key Reasoning</h4>
          <ul>
            {(recommendation?.reasoning || ['Analysis in progress']).map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
        
        <div className="recommendation-drivers">
          <div className="drivers">
            <h4>Key Drivers</h4>
            <ul>
              {(recommendation?.keyDrivers || ['Being analyzed']).map((driver, i) => (
                <li key={i}>{driver}</li>
              ))}
            </ul>
          </div>
          <div className="risks">
            <h4>Risks to Monitor</h4>
            <ul>
              {(recommendation?.risksToMonitor || ['Being evaluated']).map((riskItem, i) => (
                <li key={i}>{riskItem}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Analysis Details */}
      <div className="analysis-details">
        <div className="analysis-section financial">
          <h4><WalletCards size={18} /> Financial Health</h4>
          <div className="score-badge">
            Score: {financial?.score || 'N/A'}/100
          </div>
          <p>{financial?.assessment || 'Financial analysis in progress'}</p>
          <div className="strengths-weaknesses">
            <div className="strengths">
              <TrendingUp size={16} />
              <span>Strengths</span>
              <ul>
                {(financial?.strengths || ['Being evaluated']).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="weaknesses">
              <TrendingDown size={16} />
              <span>Weaknesses</span>
              <ul>
                {(financial?.weaknesses || ['Being evaluated']).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="analysis-section swot">
          <h4><TrendingUp size={18} /> SWOT Analysis</h4>
          <div className="swot-grid">
            <div className="swot-strengths">
              <span className="swot-label">Strengths</span>
              <ul>
                {(swot?.strengths || ['N/A']).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="swot-weaknesses">
              <span className="swot-label">Weaknesses</span>
              <ul>
                {(swot?.weaknesses || ['N/A']).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
            <div className="swot-opportunities">
              <span className="swot-label">Opportunities</span>
              <ul>
                {(swot?.opportunities || ['N/A']).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
            <div className="swot-threats">
              <span className="swot-label">Threats</span>
              <ul>
                {(swot?.threats || ['N/A']).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="analysis-section business">
          <h4><BriefcaseBusiness size={18} /> Business Model</h4>
          <p><strong>Moat:</strong> {businessModel?.economicMoat || 'N/A'}</p>
          <p><strong>Strength Score:</strong> {businessModel?.strengthScore || 'N/A'}/100</p>
          <p>{businessModel?.description || 'Business model analysis in progress'}</p>
          <div className="revenue-streams">
            <span>Revenue Streams:</span>
            <ul>
              {(businessModel?.revenueStreams || ['N/A']).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="analysis-section risk">
          <h4><AlertTriangle size={18} /> Risk Assessment</h4>
          <div className="risk-scores">
            {risk?.riskScores ? (
              <>
                <div className="risk-item">
                  <span>Financial</span>
                  <span className={`risk-value ${risk.riskScores.financial > 7 ? 'high' : risk.riskScores.financial > 4 ? 'medium' : 'low'}`}>
                    {risk.riskScores.financial || 0}/10
                  </span>
                </div>
                <div className="risk-item">
                  <span>Business</span>
                  <span className={`risk-value ${risk.riskScores.business > 7 ? 'high' : risk.riskScores.business > 4 ? 'medium' : 'low'}`}>
                    {risk.riskScores.business || 0}/10
                  </span>
                </div>
                <div className="risk-item">
                  <span>Market</span>
                  <span className={`risk-value ${risk.riskScores.market > 7 ? 'high' : risk.riskScores.market > 4 ? 'medium' : 'low'}`}>
                    {risk.riskScores.market || 0}/10
                  </span>
                </div>
                <div className="risk-item">
                  <span>Overall Risk</span>
                  <span className={`risk-value ${risk.overallRiskScore > 60 ? 'high' : risk.overallRiskScore > 30 ? 'medium' : 'low'}`}>
                    {risk.overallRiskScore || 0}%
                  </span>
                </div>
              </>
            ) : (
              <p>Risk analysis in progress</p>
            )}
          </div>
          <div className="key-risks">
            <h5>Key Risks to Monitor</h5>
            <ul>
              {(risk?.keyRisks || ['No risks identified']).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Regenerate Button */}
      <div className="regenerate-section">
        <button onClick={() => runAIAnalysis(true)} className="regenerate-btn">
          <RefreshCcw size={16} />
          Regenerate Analysis
        </button>
      </div>
    </div>
  );
};

export default AIAnalysis;

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Annotation, StateGraph, END } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// Initialize Gemini AI
const getLLM = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in backend/.env');
  }

  return new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    temperature: 0.3,
    maxOutputTokens: 2048,
    apiKey: process.env.GEMINI_API_KEY,
  });
};

const parseJsonResponse = (content, agentName) => {
  const rawContent = Array.isArray(content)
    ? content.map((part) => part?.text || '').join('\n')
    : String(content || '');

  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        // Fall through to the clearer error below.
      }
    }

    throw new Error(`${agentName} returned invalid JSON: ${error.message}`);
  }
};

const appendAgentError = (state, agentName, error) => {
  const message = `${agentName} Error: ${error.message}`;
  console.error(message);

  return [...state.errors, message];
};

const asArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatMillions = (value) => {
  const parsed = toNumberOrNull(value);
  return parsed === null ? 'N/A' : `$${(parsed / 1e6).toFixed(2)}M`;
};

const formatPercent = (value) => {
  const parsed = toNumberOrNull(value);
  return parsed === null ? 'N/A' : `${parsed.toFixed(2)}%`;
};

const toText = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = toText(item);
        return text ? `${key}: ${text}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }

  return String(value).trim();
};

const normalizeRecommendation = (value) => {
  const recommendation = toText(value).toLowerCase();

  if (['invest', 'buy', 'strong buy', 'accumulate', 'outperform'].includes(recommendation)) {
    return 'Invest';
  }

  if (['hold', 'neutral', 'watch', 'wait'].includes(recommendation)) {
    return 'Hold';
  }

  if (['pass', 'sell', 'avoid', 'underperform', 'reduce'].includes(recommendation)) {
    return 'Pass';
  }

  return 'Pass';
};

const toStringArray = (value) => {
  if (value === undefined || value === null) return [];

  if (Array.isArray(value)) {
    return value.flatMap(toStringArray).filter(Boolean);
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .flatMap(([key, item]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
        const values = Array.isArray(item) ? item : [item];

        return values
          .map(nestedItem => {
            const text = toText(nestedItem);
            return text ? `${label}: ${text}` : '';
          })
          .filter(Boolean);
      });
  }

  const text = toText(value);
  return text ? [text] : [];
};

const normalizeRiskScores = (riskScores = {}) => ({
  financial: toNumberOrNull(riskScores.financial ?? riskScores.financialRisk),
  business: toNumberOrNull(riskScores.business ?? riskScores.businessRisk),
  market: toNumberOrNull(riskScores.market ?? riskScores.marketRisk),
  regulatory: toNumberOrNull(riskScores.regulatory ?? riskScores.regulatoryRisk),
  competitive: toNumberOrNull(riskScores.competitive ?? riskScores.competitiveRisk),
  operational: toNumberOrNull(riskScores.operational ?? riskScores.operationalRisk)
});

const normalizeCompanyData = (companyData = {}) => ({
  ...companyData,
  revenueTrends: asArray(companyData.revenueTrends),
  cashFlow: asArray(companyData.cashFlow),
  balanceSheet: asArray(companyData.balanceSheet)
});

const sanitizeInvestmentAnalysis = (output) => {
  const analysis = output?.analysis || {};
  const businessModel = analysis.businessModel || {};
  const risk = analysis.risk || {};

  return {
    ...output,
    company: {
      name: toText(output?.company?.name) || 'Unknown',
      symbol: toText(output?.company?.symbol) || 'N/A',
      industry: toText(output?.company?.industry) || 'N/A',
      description: toText(output?.company?.description) || 'N/A'
    },
    analysis: {
      financial: {
        ...analysis.financial,
        strengths: toStringArray(analysis.financial?.strengths),
        weaknesses: toStringArray(analysis.financial?.weaknesses),
        redFlags: toStringArray(analysis.financial?.redFlags),
        assessment: toText(analysis.financial?.assessment),
        recommendations: toStringArray(analysis.financial?.recommendations)
      },
      swot: {
        strengths: toStringArray(analysis.swot?.strengths),
        weaknesses: toStringArray(analysis.swot?.weaknesses),
        opportunities: toStringArray(analysis.swot?.opportunities),
        threats: toStringArray(analysis.swot?.threats)
      },
      businessModel: {
        description: toText(businessModel.description),
        revenueStreams: toStringArray(businessModel.revenueStreams),
        customerSegments: toStringArray(businessModel.customerSegments),
        competitiveAdvantage: toText(businessModel.competitiveAdvantage),
        economicMoat: toText(businessModel.economicMoat),
        strengthScore: toNumberOrNull(businessModel.strengthScore)
      },
      risk: {
        riskScores: normalizeRiskScores(risk.riskScores),
        overallRiskScore: toNumberOrNull(risk.overallRiskScore),
        keyRisks: toStringArray(risk.keyRisks),
        mitigationStrategies: toStringArray(risk.mitigationStrategies)
      }
    },
    recommendation: {
      recommendation: normalizeRecommendation(output?.recommendation?.recommendation),
      confidenceScore: toNumberOrNull(output?.recommendation?.confidenceScore) || 0,
      reasoning: toStringArray(output?.recommendation?.reasoning),
      keyDrivers: toStringArray(output?.recommendation?.keyDrivers),
      risksToMonitor: toStringArray(output?.recommendation?.risksToMonitor)
    },
    errors: toStringArray(output?.errors),
    generatedAt: output?.generatedAt || new Date().toISOString()
  };
};

const hasAnalysisSection = (finalOutput) => {
  const analysis = finalOutput?.analysis || {};

  return Boolean(
    analysis.financial && !analysis.financial.error ||
    analysis.swot && !analysis.swot.error ||
    analysis.businessModel && !analysis.businessModel.error ||
    analysis.risk && !analysis.risk.error
  );
};

const getCompanyName = (companyData) => companyData.profile?.name || companyData.profile?.symbol || 'This company';

const getLatestRevenueGrowth = (companyData) => toNumberOrNull(companyData.revenueTrends?.[0]?.revenueGrowth);

const getLatestFreeCashFlow = (companyData) => toNumberOrNull(companyData.cashFlow?.[0]?.freeCashFlow);

const estimateFinancialScore = (companyData) => {
  const ratios = companyData.ratios || {};
  const revenueGrowth = getLatestRevenueGrowth(companyData);
  const freeCashFlow = getLatestFreeCashFlow(companyData);
  let score = 50;

  if (toNumberOrNull(ratios.roe) !== null) score += ratios.roe >= 15 ? 12 : ratios.roe >= 8 ? 6 : -6;
  if (toNumberOrNull(ratios.netMargin) !== null) score += ratios.netMargin >= 15 ? 10 : ratios.netMargin >= 5 ? 4 : -6;
  if (revenueGrowth !== null) score += revenueGrowth >= 10 ? 10 : revenueGrowth >= 0 ? 4 : -8;
  if (freeCashFlow !== null) score += freeCashFlow > 0 ? 8 : -8;
  if (toNumberOrNull(ratios.debtToEquity) !== null) score += ratios.debtToEquity <= 1 ? 8 : ratios.debtToEquity <= 2 ? 2 : -8;
  if (toNumberOrNull(ratios.currentRatio) !== null) score += ratios.currentRatio >= 1.5 ? 6 : ratios.currentRatio >= 1 ? 2 : -6;

  return Math.round(clamp(score, 20, 90));
};

const buildFallbackFinancialAnalysis = (companyData) => {
  const ratios = companyData.ratios || {};
  const revenueGrowth = getLatestRevenueGrowth(companyData);
  const freeCashFlow = getLatestFreeCashFlow(companyData);
  const score = estimateFinancialScore(companyData);
  const strengths = [];
  const weaknesses = [];
  const redFlags = [];

  if (toNumberOrNull(ratios.roe) !== null && ratios.roe >= 15) strengths.push(`ROE is healthy at ${formatPercent(ratios.roe)}`);
  if (toNumberOrNull(ratios.netMargin) !== null && ratios.netMargin >= 10) strengths.push(`Net margin is solid at ${formatPercent(ratios.netMargin)}`);
  if (revenueGrowth !== null && revenueGrowth >= 0) strengths.push(`Latest revenue growth is positive at ${formatPercent(revenueGrowth)}`);
  if (freeCashFlow !== null && freeCashFlow > 0) strengths.push(`Latest free cash flow is positive at ${formatMillions(freeCashFlow)}`);

  if (toNumberOrNull(ratios.debtToEquity) !== null && ratios.debtToEquity > 2) weaknesses.push(`Debt-to-equity is elevated at ${ratios.debtToEquity}`);
  if (revenueGrowth !== null && revenueGrowth < 0) weaknesses.push(`Latest revenue growth is negative at ${formatPercent(revenueGrowth)}`);
  if (freeCashFlow !== null && freeCashFlow < 0) weaknesses.push(`Latest free cash flow is negative at ${formatMillions(freeCashFlow)}`);
  if (toNumberOrNull(ratios.currentRatio) !== null && ratios.currentRatio < 1) redFlags.push(`Current ratio is below 1.0 at ${ratios.currentRatio}`);

  return {
    score,
    strengths: strengths.length ? strengths : ['Financial data is available for baseline analysis'],
    weaknesses: weaknesses.length ? weaknesses : ['No major financial weakness detected from the available ratios'],
    redFlags,
    assessment: `${getCompanyName(companyData)} has an estimated financial health score of ${score}/100 based on available ratios, revenue trend, and cash flow data.`,
    recommendations: ['Review the latest filings and compare margins, growth, and leverage against direct peers before making an investment decision']
  };
};

const buildFallbackSWOTAnalysis = (companyData) => ({
  strengths: [
    `${getCompanyName(companyData)} has an established operating profile in ${companyData.profile?.industry || 'its industry'}`,
    'Available financial data supports a baseline review of profitability, growth, and balance sheet risk'
  ],
  weaknesses: [
    'AI-generated qualitative detail was unavailable, so this SWOT uses only cached company and financial data',
    'Limited provider data can reduce confidence in trend interpretation'
  ],
  opportunities: [
    'Revenue growth, margin expansion, and stronger free cash flow could improve the investment case',
    'Industry tailwinds may create upside if execution remains strong'
  ],
  threats: [
    'Competitive pressure can weaken growth and margins',
    'Macroeconomic, regulatory, and market valuation changes can affect returns'
  ]
});

const buildFallbackBusinessModelAnalysis = (companyData) => ({
  description: companyData.profile?.description || `${getCompanyName(companyData)} generates revenue through its core operations in ${companyData.profile?.industry || 'its reported industry'}.`,
  revenueStreams: ['Core products and services', 'Related recurring or complementary business lines where applicable'],
  customerSegments: ['Consumers', 'Businesses and institutional customers where applicable'],
  competitiveAdvantage: 'Competitive position should be verified against direct peers using market share, margins, retention, brand strength, and product differentiation.',
  economicMoat: estimateFinancialScore(companyData) >= 70 ? 'medium' : 'weak',
  strengthScore: estimateFinancialScore(companyData)
});

const buildFallbackRiskAssessment = (companyData) => {
  const ratios = companyData.ratios || {};
  const beta = toNumberOrNull(ratios.beta);
  const debtToEquity = toNumberOrNull(ratios.debtToEquity);
  const revenueGrowth = getLatestRevenueGrowth(companyData);

  const financialRisk = debtToEquity === null ? 5 : debtToEquity > 2 ? 8 : debtToEquity > 1 ? 6 : 4;
  const marketRisk = beta === null ? 5 : beta > 1.3 ? 7 : beta < 0.8 ? 4 : 5;
  const businessRisk = revenueGrowth === null ? 5 : revenueGrowth < 0 ? 7 : 4;

  return {
    riskScores: {
      financial: financialRisk,
      business: businessRisk,
      market: marketRisk,
      regulatory: 5,
      competitive: 6,
      operational: 5
    },
    overallRiskScore: Math.round(((financialRisk + businessRisk + marketRisk + 5 + 6 + 5) / 60) * 100),
    keyRisks: ['Execution and competitive pressure', 'Market valuation volatility', 'Data provider gaps or stale financial data'],
    mitigationStrategies: ['Compare against peers before investing', 'Use position sizing and valuation discipline', 'Refresh research after new earnings or filings']
  };
};

const buildFallbackRecommendation = (state) => {
  const financialScore = toNumberOrNull(state.financialAnalysis?.score) || estimateFinancialScore(state.companyData);
  const riskScore = toNumberOrNull(state.riskAssessment?.overallRiskScore) || 50;
  const recommendation = financialScore >= 72 && riskScore <= 60 ? 'Invest' : financialScore >= 55 ? 'Hold' : 'Pass';

  return {
    recommendation,
    confidenceScore: 55,
    reasoning: [
      `Fallback recommendation based on financial score ${financialScore}/100 and risk score ${riskScore}/100`,
      'Gemini analysis was unavailable or incomplete, so confidence is intentionally conservative'
    ],
    keyDrivers: ['Financial health estimate', 'Risk estimate', 'Availability of cached research data'],
    risksToMonitor: ['Provider quota or API availability', 'Latest earnings changes', 'Valuation and competitive pressure']
  };
};

// State definition for LangGraph
const createInitialState = (companyData) => ({
  companyData: normalizeCompanyData(companyData),
  financialAnalysis: null,
  swotAnalysis: null,
  businessModelAnalysis: null,
  riskAssessment: null,
  recommendation: null,
  finalOutput: null,
  errors: [],
  currentStep: 'start'
});

const InvestmentAnalysisState = Annotation.Root({
  companyData: Annotation({
    default: () => ({})
  }),
  financialAnalysis: Annotation({
    default: () => null
  }),
  swotAnalysis: Annotation({
    default: () => null
  }),
  businessModelAnalysis: Annotation({
    default: () => null
  }),
  riskAssessment: Annotation({
    default: () => null
  }),
  recommendation: Annotation({
    default: () => null
  }),
  finalOutput: Annotation({
    default: () => null
  }),
  errors: Annotation({
    default: () => []
  }),
  currentStep: Annotation({
    default: () => 'start'
  })
});

// Agent Node Functions

// 1. Financial Analysis Agent
const financialAnalysisAgent = async (state) => {
  try {
    const llm = getLLM();
    const { companyData } = state;
    
    const prompt = `
You are a Financial Analysis Expert. Analyze the following company's financial data and provide a comprehensive analysis.

Company: ${companyData.profile?.name || 'Unknown'} (${companyData.profile?.symbol || 'N/A'})

Financial Ratios:
- P/E Ratio: ${companyData.ratios?.pe || 'N/A'}
- P/B Ratio: ${companyData.ratios?.pb || 'N/A'}
- ROE: ${companyData.ratios?.roe || 'N/A'}%
- ROA: ${companyData.ratios?.roa || 'N/A'}%
- Current Ratio: ${companyData.ratios?.currentRatio || 'N/A'}
- Debt to Equity: ${companyData.ratios?.debtToEquity || 'N/A'}
- Gross Margin: ${companyData.ratios?.grossMargin || 'N/A'}%
- Net Margin: ${companyData.ratios?.netMargin || 'N/A'}%
- Beta: ${companyData.ratios?.beta || 'N/A'}

Revenue Trends (last 5 years):
${companyData.revenueTrends?.map(t => 
  `Year ${t.year || 'N/A'}: Revenue: ${formatMillions(t.revenue)}, Growth: ${formatPercent(t.revenueGrowth)}`
).join('\n') || 'No revenue data available'}

Cash Flow:
${companyData.cashFlow?.map(t =>
  `Year ${t.year || 'N/A'}: Free Cash Flow: ${formatMillions(t.freeCashFlow)}`
).join('\n') || 'No cash flow data available'}

Provide:
1. Financial Health Score (0-100)
2. Key Strengths in Financials
3. Key Weaknesses in Financials
4. Financial Red Flags (if any)
5. Overall Financial Assessment
6. Specific Recommendations based on financials

Format your response as JSON with keys: score, strengths, weaknesses, redFlags, assessment, recommendations.
`;

    const response = await llm.invoke([
      new SystemMessage('You are a financial analyst expert. Always respond in valid JSON format.'),
      new HumanMessage(prompt)
    ]);

    const analysis = parseJsonResponse(response.content, 'Financial analysis agent');
    
    return {
      ...state,
      financialAnalysis: analysis,
      currentStep: 'swot'
    };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'Financial Analysis', error),
      financialAnalysis: buildFallbackFinancialAnalysis(state.companyData),
      currentStep: 'swot'
    };
  }
};

// 2. SWOT Analysis Agent
const swotAnalysisAgent = async (state) => {
  try {
    const llm = getLLM();
    const { companyData } = state;
    
    const prompt = `
You are a Strategic Analyst. Perform a SWOT Analysis for the following company.

Company: ${companyData.profile?.name || 'Unknown'}
Industry: ${companyData.profile?.industry || 'N/A'}
Description: ${companyData.profile?.description || 'N/A'}

Financial Context:
- Revenue Growth: ${formatPercent(companyData.revenueTrends?.[0]?.revenueGrowth)}
- Profit Margin: ${companyData.ratios?.netMargin || 'N/A'}%
- Debt to Equity: ${companyData.ratios?.debtToEquity || 'N/A'}
- ROE: ${companyData.ratios?.roe || 'N/A'}%

Based on this information and general market knowledge:
1. Identify STRENGTHS (internal positive factors)
2. Identify WEAKNESSES (internal negative factors)
3. Identify OPPORTUNITIES (external positive factors)
4. Identify THREATS (external negative factors)

Format your response as JSON with arrays: strengths, weaknesses, opportunities, threats.
Each item should be a string with clear, actionable insight.
`;

    const response = await llm.invoke([
      new SystemMessage('You are a strategic analyst. Always respond in valid JSON format.'),
      new HumanMessage(prompt)
    ]);

    const swot = parseJsonResponse(response.content, 'SWOT analysis agent');
    
    return {
      ...state,
      swotAnalysis: swot,
      currentStep: 'businessModel'
    };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'SWOT Analysis', error),
      swotAnalysis: buildFallbackSWOTAnalysis(state.companyData),
      currentStep: 'businessModel'
    };
  }
};

// 3. Business Model Agent
const businessModelAgent = async (state) => {
  try {
    const llm = getLLM();
    const { companyData } = state;
    
    const prompt = `
You are a Business Model Analyst. Analyze the business model of the following company.

Company: ${companyData.profile?.name || 'Unknown'}
Industry: ${companyData.profile?.industry || 'N/A'}
Description: ${companyData.profile?.description || 'N/A'}

Provide:
1. Business Model Description (how they make money)
2. Revenue Streams (primary and secondary)
3. Customer Segments (who they serve)
4. Competitive Advantage (what makes them unique)
5. Economic Moat (strong/medium/weak/none)
6. Business Model Strength Score (0-100)

Format your response as JSON with keys: description, revenueStreams, customerSegments, competitiveAdvantage, economicMoat, strengthScore.
Use only strings for description, competitiveAdvantage, and economicMoat. Use flat arrays of strings for revenueStreams and customerSegments. Do not return nested objects or nested arrays.
`;

    const response = await llm.invoke([
      new SystemMessage('You are a business model analyst. Always respond in valid JSON format.'),
      new HumanMessage(prompt)
    ]);

    const businessModel = parseJsonResponse(response.content, 'Business model agent');
    
    return {
      ...state,
      businessModelAnalysis: businessModel,
      currentStep: 'risk'
    };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'Business Model', error),
      businessModelAnalysis: buildFallbackBusinessModelAnalysis(state.companyData),
      currentStep: 'risk'
    };
  }
};

// 4. Risk Assessment Agent
const riskAssessmentAgent = async (state) => {
  try {
    const llm = getLLM();
    const { companyData } = state;
    
    const prompt = `
You are a Risk Analyst. Assess the risks associated with investing in the following company.

Company: ${companyData.profile?.name || 'Unknown'}
Industry: ${companyData.profile?.industry || 'N/A'}

Financial Indicators:
- Debt to Equity: ${companyData.ratios?.debtToEquity || 'N/A'}
- Current Ratio: ${companyData.ratios?.currentRatio || 'N/A'}
- Beta: ${companyData.ratios?.beta || 'N/A'}
- Revenue Growth: ${formatPercent(companyData.revenueTrends?.[0]?.revenueGrowth)}

Identify and score the following risks (1-10, where 10 is highest risk):
1. Financial Risk
2. Business Risk
3. Market Risk
4. Regulatory Risk
5. Competitive Risk
6. Operational Risk

Provide:
1. Risk Scores for each category
2. Overall Risk Score (0-100)
3. Top 3 key risks to monitor
4. Mitigation strategies

Format your response as JSON with keys: riskScores, overallRiskScore, keyRisks, mitigationStrategies.
Use riskScores keys exactly: financial, business, market, regulatory, competitive, operational. Use flat arrays of strings for keyRisks and mitigationStrategies.
`;

    const response = await llm.invoke([
      new SystemMessage('You are a risk analyst. Always respond in valid JSON format.'),
      new HumanMessage(prompt)
    ]);

    const riskAssessment = parseJsonResponse(response.content, 'Risk assessment agent');
    
    return {
      ...state,
      riskAssessment: riskAssessment,
      currentStep: 'recommendation'
    };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'Risk Assessment', error),
      riskAssessment: buildFallbackRiskAssessment(state.companyData),
      currentStep: 'recommendation'
    };
  }
};

// 5. Recommendation Agent (Final Decision Maker)
const recommendationAgent = async (state) => {
  try {
    const llm = getLLM();
    const { 
      companyData, 
      financialAnalysis, 
      swotAnalysis, 
      businessModelAnalysis, 
      riskAssessment 
    } = state;
    
    const prompt = `
You are the Chief Investment Officer. Based on all the analysis provided, make a final investment recommendation.

Company: ${companyData.profile?.name || 'Unknown'} (${companyData.profile?.symbol || 'N/A'})

Financial Analysis:
- Score: ${financialAnalysis?.score || 'N/A'}
- Assessment: ${financialAnalysis?.assessment || 'N/A'}

SWOT Analysis:
- Strengths: ${swotAnalysis?.strengths?.join(', ') || 'N/A'}
- Weaknesses: ${swotAnalysis?.weaknesses?.join(', ') || 'N/A'}

Business Model:
- Strength Score: ${businessModelAnalysis?.strengthScore || 'N/A'}
- Economic Moat: ${businessModelAnalysis?.economicMoat || 'N/A'}

Risk Assessment:
- Overall Risk Score: ${riskAssessment?.overallRiskScore || 'N/A'}
- Key Risks: ${riskAssessment?.keyRisks?.join(', ') || 'N/A'}

Provide:
1. Recommendation: "Invest", "Hold", or "Pass"
2. Confidence Score: 0-100
3. 3-5 bullet points of key reasoning
4. Key drivers for the decision
5. Risks to monitor going forward

Format your response as JSON with keys: recommendation, confidenceScore, reasoning (array), keyDrivers (array), risksToMonitor (array).
The recommendation value must be exactly one of: Invest, Hold, Pass.
`;

    const response = await llm.invoke([
      new SystemMessage('You are a chief investment officer making final decisions. Always respond in valid JSON format.'),
      new HumanMessage(prompt)
    ]);

    const recommendation = parseJsonResponse(response.content, 'Recommendation agent');
    
    return {
      ...state,
      recommendation: recommendation,
      currentStep: 'complete'
    };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'Recommendation', error),
      recommendation: buildFallbackRecommendation(state),
      currentStep: 'complete'
    };
  }
};

// 6. Final Output Formatter
const finalOutputAgent = async (state) => {
  const { 
    companyData, 
    financialAnalysis, 
    swotAnalysis, 
    businessModelAnalysis, 
    riskAssessment, 
    recommendation,
    errors 
  } = state;

  const output = {
    company: {
      name: companyData.profile?.name || 'Unknown',
      symbol: companyData.profile?.symbol || 'N/A',
      industry: companyData.profile?.industry || 'N/A',
      description: companyData.profile?.description || 'N/A'
    },
    analysis: {
      financial: financialAnalysis || { error: 'Analysis failed' },
      swot: swotAnalysis || { error: 'Analysis failed' },
      businessModel: businessModelAnalysis || { error: 'Analysis failed' },
      risk: riskAssessment || { error: 'Analysis failed' }
    },
    recommendation: recommendation || { 
      recommendation: 'Pass', 
      confidenceScore: 0,
      reasoning: ['Unable to generate recommendation'],
      keyDrivers: [],
      risksToMonitor: []
    },
    errors: errors,
    generatedAt: new Date().toISOString()
  };

  return {
    ...state,
    finalOutput: sanitizeInvestmentAnalysis(output)
  };
};

// Build the LangGraph
export const buildInvestmentAgent = () => {
  const workflow = new StateGraph(InvestmentAnalysisState);

  // Add nodes
  workflow.addNode('financialAnalysisNode', financialAnalysisAgent);
  workflow.addNode('swotAnalysisNode', swotAnalysisAgent);
  workflow.addNode('businessModelNode', businessModelAgent);
  workflow.addNode('riskAssessmentNode', riskAssessmentAgent);
  workflow.addNode('recommendationNode', recommendationAgent);
  workflow.addNode('finalOutputNode', finalOutputAgent);

  // Define edges
  workflow.setEntryPoint('financialAnalysisNode');
  workflow.addEdge('financialAnalysisNode', 'swotAnalysisNode');
  workflow.addEdge('swotAnalysisNode', 'businessModelNode');
  workflow.addEdge('businessModelNode', 'riskAssessmentNode');
  workflow.addEdge('riskAssessmentNode', 'recommendationNode');
  workflow.addEdge('recommendationNode', 'finalOutputNode');
  workflow.addEdge('finalOutputNode', END);

  return workflow.compile();
};

// Main function to run the agent
export const runInvestmentAnalysis = async (companyData) => {
  try {
    const app = buildInvestmentAgent();
    const initialState = createInitialState(companyData);
    const finalState = await app.invoke(initialState);

    if (!finalState.finalOutput) {
      throw new Error('AI workflow completed without final output');
    }

    if (!hasAnalysisSection(finalState.finalOutput)) {
      const errorDetails = finalState.finalOutput.errors?.length
        ? finalState.finalOutput.errors.join('; ')
        : 'No analysis sections were generated';

      throw new Error(`Gemini analysis failed: ${errorDetails}`);
    }

    return finalState.finalOutput;
  } catch (error) {
    console.error('Investment analysis error:', error);
    throw new Error(`AI Analysis failed: ${error.message}`);
  }
};

// Individual agent functions for direct use
export const getFinancialAnalysis = async (companyData) => {
  try {
    const state = createInitialState(companyData);
    const result = await financialAnalysisAgent(state);
    return result.financialAnalysis;
  } catch (error) {
    throw new Error(`Financial analysis failed: ${error.message}`);
  }
};

export const getSWOTAnalysis = async (companyData) => {
  try {
    const state = createInitialState(companyData);
    const result = await swotAnalysisAgent(state);
    return result.swotAnalysis;
  } catch (error) {
    throw new Error(`SWOT analysis failed: ${error.message}`);
  }
};

export const getBusinessModelAnalysis = async (companyData) => {
  try {
    const state = createInitialState(companyData);
    const result = await businessModelAgent(state);
    return result.businessModelAnalysis;
  } catch (error) {
    throw new Error(`Business model analysis failed: ${error.message}`);
  }
};

export const getRiskAssessment = async (companyData) => {
  try {
    const state = createInitialState(companyData);
    const result = await riskAssessmentAgent(state);
    return result.riskAssessment;
  } catch (error) {
    throw new Error(`Risk assessment failed: ${error.message}`);
  }
};

export const getInvestmentRecommendation = async (companyData) => {
  try {
    const state = createInitialState(companyData);
    const result = await recommendationAgent(state);
    return result.recommendation;
  } catch (error) {
    throw new Error(`Investment recommendation failed: ${error.message}`);
  }
};

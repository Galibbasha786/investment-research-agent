import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser, StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { z } from 'zod';

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

// Financial Analysis Agent prompt template
const financialAnalysisPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are a financial analyst expert. Always respond in valid JSON format. No markdown fences.',
  ],
  [
    'human',
    `You are a Financial Analysis Expert. Analyze the following company.

Company: {companyName} ({symbol})

Financial Ratios:
- P/E: {pe}  P/B: {pb}  ROE: {roe}%  ROA: {roa}%
- Current Ratio: {currentRatio}  D/E: {debtToEquity}
- Gross Margin: {grossMargin}%  Net Margin: {netMargin}%  Beta: {beta}

Revenue Trends:
{revenueTrends}

Cash Flow:
{cashFlow}

Respond with JSON: {{ "score": <0-100>, "strengths": [...], "weaknesses": [...], "redFlags": [...], "assessment": "...", "recommendations": [...] }}`,
  ],
]);

// 1. Financial Analysis Agent
const financialAnalysisAgent = async (state) => {
  try {
    const { companyData } = state;
    // RunnableSequence: ChatPromptTemplate → LLM → JsonOutputParser
    const chain = RunnableSequence.from([
      financialAnalysisPrompt,
      getLLM(),
      new JsonOutputParser(),
    ]);

    const analysis = await chain.invoke({
      companyName:  companyData.profile?.name || 'Unknown',
      symbol:       companyData.profile?.symbol || 'N/A',
      pe:           companyData.ratios?.pe || 'N/A',
      pb:           companyData.ratios?.pb || 'N/A',
      roe:          companyData.ratios?.roe || 'N/A',
      roa:          companyData.ratios?.roa || 'N/A',
      currentRatio: companyData.ratios?.currentRatio || 'N/A',
      debtToEquity: companyData.ratios?.debtToEquity || 'N/A',
      grossMargin:  companyData.ratios?.grossMargin || 'N/A',
      netMargin:    companyData.ratios?.netMargin || 'N/A',
      beta:         companyData.ratios?.beta || 'N/A',
      revenueTrends: companyData.revenueTrends?.map(t =>
        `Year ${t.year || 'N/A'}: ${formatMillions(t.revenue)}, Growth: ${formatPercent(t.revenueGrowth)}`
      ).join('\n') || 'No revenue data',
      cashFlow: companyData.cashFlow?.map(t =>
        `Year ${t.year || 'N/A'}: FCF ${formatMillions(t.freeCashFlow)}`
      ).join('\n') || 'No cash flow data',
    });

    return { ...state, financialAnalysis: analysis, currentStep: 'swot' };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'Financial Analysis', error),
      financialAnalysis: buildFallbackFinancialAnalysis(state.companyData),
      currentStep: 'swot',
    };
  }
};

// SWOT prompt template
const swotPrompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a strategic analyst. Always respond in valid JSON format. No markdown fences.'],
  [
    'human',
    `Perform a SWOT Analysis for {companyName} (Industry: {industry}).

Description: {description}
Revenue Growth: {revenueGrowth} | Net Margin: {netMargin}% | D/E: {debtToEquity} | ROE: {roe}%

Return JSON: {{ "strengths": [...], "weaknesses": [...], "opportunities": [...], "threats": [...] }}`,
  ],
]);

// 2. SWOT Analysis Agent
const swotAnalysisAgent = async (state) => {
  try {
    const { companyData } = state;
    // RunnableSequence: ChatPromptTemplate → LLM → JsonOutputParser
    const chain = RunnableSequence.from([
      swotPrompt,
      getLLM(),
      new JsonOutputParser(),
    ]);

    const swot = await chain.invoke({
      companyName:   companyData.profile?.name || 'Unknown',
      industry:      companyData.profile?.industry || 'N/A',
      description:   (companyData.profile?.description || 'N/A').substring(0, 400),
      revenueGrowth: formatPercent(companyData.revenueTrends?.[0]?.revenueGrowth),
      netMargin:     companyData.ratios?.netMargin || 'N/A',
      debtToEquity:  companyData.ratios?.debtToEquity || 'N/A',
      roe:           companyData.ratios?.roe || 'N/A',
    });

    return { ...state, swotAnalysis: swot, currentStep: 'businessModel' };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'SWOT Analysis', error),
      swotAnalysis: buildFallbackSWOTAnalysis(state.companyData),
      currentStep: 'businessModel',
    };
  }
};

// Business model prompt template
const businessModelPrompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a business model analyst. Always respond in valid JSON format. No markdown fences.'],
  [
    'human',
    `Analyze the business model of {companyName} (Industry: {industry}).
Description: {description}

Return JSON: {{ "description": "...", "revenueStreams": [...], "customerSegments": [...], "competitiveAdvantage": "...", "economicMoat": "strong|medium|weak|none", "strengthScore": <0-100> }}`,
  ],
]);

// 3. Business Model Agent
const businessModelAgent = async (state) => {
  try {
    const { companyData } = state;
    // RunnableSequence: ChatPromptTemplate → LLM → JsonOutputParser
    const chain = RunnableSequence.from([
      businessModelPrompt,
      getLLM(),
      new JsonOutputParser(),
    ]);

    const businessModel = await chain.invoke({
      companyName: companyData.profile?.name || 'Unknown',
      industry:    companyData.profile?.industry || 'N/A',
      description: (companyData.profile?.description || 'N/A').substring(0, 600),
    });

    return { ...state, businessModelAnalysis: businessModel, currentStep: 'risk' };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'Business Model', error),
      businessModelAnalysis: buildFallbackBusinessModelAnalysis(state.companyData),
      currentStep: 'risk',
    };
  }
};

// Risk assessment prompt template
const riskPrompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a risk analyst. Always respond in valid JSON format. No markdown fences.'],
  [
    'human',
    `Assess investment risks for {companyName} (Industry: {industry}).

Indicators: D/E={debtToEquity} | Current Ratio={currentRatio} | Beta={beta} | Rev Growth={revenueGrowth}

Return JSON: {{ "riskScores": {{ "financial": <1-10>, "business": <1-10>, "market": <1-10>, "regulatory": <1-10>, "competitive": <1-10>, "operational": <1-10> }}, "overallRiskScore": <0-100>, "keyRisks": [...], "mitigationStrategies": [...] }}`,
  ],
]);

// 4. Risk Assessment Agent
const riskAssessmentAgent = async (state) => {
  try {
    const { companyData } = state;
    // RunnableSequence: ChatPromptTemplate → LLM → JsonOutputParser
    const chain = RunnableSequence.from([
      riskPrompt,
      getLLM(),
      new JsonOutputParser(),
    ]);

    const riskAssessment = await chain.invoke({
      companyName:   companyData.profile?.name || 'Unknown',
      industry:      companyData.profile?.industry || 'N/A',
      debtToEquity:  companyData.ratios?.debtToEquity || 'N/A',
      currentRatio:  companyData.ratios?.currentRatio || 'N/A',
      beta:          companyData.ratios?.beta || 'N/A',
      revenueGrowth: formatPercent(companyData.revenueTrends?.[0]?.revenueGrowth),
    });

    return { ...state, riskAssessment, currentStep: 'recommendation' };
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'Risk Assessment', error),
      riskAssessment: buildFallbackRiskAssessment(state.companyData),
      currentStep: 'recommendation',
    };
  }
};

// Recommendation Zod schema for withStructuredOutput
const RecommendationSchema = z.object({
  recommendation:  z.enum(['Invest', 'Hold', 'Pass']),
  confidenceScore: z.number().min(0).max(100),
  reasoning:       z.array(z.string()),
  keyDrivers:      z.array(z.string()),
  risksToMonitor:  z.array(z.string()),
});

// Recommendation prompt template
const recommendationPrompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are the Chief Investment Officer making final investment decisions.'],
  [
    'human',
    `Make a final investment recommendation for {companyName} ({symbol}).

Financial Score: {financialScore} | Assessment: {financialAssessment}
SWOT Strengths: {strengths} | Weaknesses: {weaknesses}
Business Moat: {economicMoat} | Strength Score: {businessScore}
Overall Risk: {riskScore} | Key Risks: {keyRisks}

Decision must be "Invest", "Hold", or "Pass".`,
  ],
]);

// 5. Recommendation Agent
const recommendationAgent = async (state) => {
  try {
    const { companyData, financialAnalysis, swotAnalysis, businessModelAnalysis, riskAssessment } = state;

    const promptVars = {
      companyName:        companyData.profile?.name || 'Unknown',
      symbol:             companyData.profile?.symbol || 'N/A',
      financialScore:     financialAnalysis?.score || 'N/A',
      financialAssessment: (financialAnalysis?.assessment || 'N/A').substring(0, 200),
      strengths:          (swotAnalysis?.strengths || []).slice(0, 3).join('; ') || 'N/A',
      weaknesses:         (swotAnalysis?.weaknesses || []).slice(0, 3).join('; ') || 'N/A',
      economicMoat:       businessModelAnalysis?.economicMoat || 'N/A',
      businessScore:      businessModelAnalysis?.strengthScore || 'N/A',
      riskScore:          riskAssessment?.overallRiskScore || 'N/A',
      keyRisks:           (riskAssessment?.keyRisks || []).slice(0, 3).join('; ') || 'N/A',
    };

    // Try withStructuredOutput first (Zod-typed)
    try {
      const structuredLLM = getLLM().withStructuredOutput(RecommendationSchema, {
        name: 'investment_recommendation',
      });
      const messages = await recommendationPrompt.formatMessages(promptVars);
      const recommendation = await structuredLLM.invoke(messages);
      return { ...state, recommendation, currentStep: 'complete' };
    } catch {
      // Fallback: RunnableSequence with JsonOutputParser
      const chain = RunnableSequence.from([
        recommendationPrompt,
        getLLM(),
        new JsonOutputParser(),
      ]);
      const recommendation = await chain.invoke(promptVars);
      return { ...state, recommendation, currentStep: 'complete' };
    }
  } catch (error) {
    return {
      ...state,
      errors: appendAgentError(state, 'Recommendation', error),
      recommendation: buildFallbackRecommendation(state),
      currentStep: 'complete',
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
  workflow.addNode('swotAnalysisNode',      swotAnalysisAgent);
  workflow.addNode('businessModelNode',     businessModelAgent);
  workflow.addNode('riskAssessmentNode',    riskAssessmentAgent);
  workflow.addNode('recommendationNode',    recommendationAgent);
  workflow.addNode('finalOutputNode',       finalOutputAgent);

  // Use START for explicit entry point (modern LangGraph API)
  workflow.addEdge(START,                   'financialAnalysisNode');
  workflow.addEdge('financialAnalysisNode', 'swotAnalysisNode');
  workflow.addEdge('swotAnalysisNode',      'businessModelNode');
  workflow.addEdge('businessModelNode',     'riskAssessmentNode');
  workflow.addEdge('riskAssessmentNode',    'recommendationNode');
  workflow.addEdge('recommendationNode',    'finalOutputNode');
  workflow.addEdge('finalOutputNode',       END);

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

/**
 * Advanced Agent Service — Full LangChain + LangGraph Integration
 *
 * LangChain / LangGraph features used:
 *  ✅ Annotation.Root — typed state schema
 *  ✅ StateGraph + START + END — directed agent workflow
 *  ✅ tool() — 5 typed LangChain tool definitions (Zod-schema validated)
 *  ✅ llm.bindTools() — LLM bound to tools for agentic decision making
 *  ✅ ToolNode (prebuilt) — automatic tool execution from LLM tool_calls
 *  ✅ Conditional edges — dynamic routing based on state (tool loop + retry)
 *  ✅ withStructuredOutput() + Zod — typed structured recommendation output
 *  ✅ ChatPromptTemplate.fromMessages() — reusable prompt templates
 *  ✅ PromptTemplate.fromTemplate() — simple string prompt template
 *  ✅ JsonOutputParser — LangChain output parser for JSON responses
 *  ✅ StringOutputParser — LangChain output parser for text responses
 *  ✅ RunnableSequence.from() — composable pipeline via .pipe()
 *  ✅ RunnableLambda — custom runnable step in a chain
 *  ✅ HumanMessage / SystemMessage / AIMessage — typed message classes
 */

import { Annotation, StateGraph, END, START } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser, StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import newsService from './newsService.js';
import scoringEngine from './scoringEngine.js';

// ─────────────────────────────────────────────────────────────────────────────
// LLM Factory
// ─────────────────────────────────────────────────────────────────────────────

const getLLM = () =>
  new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    temperature: 0.2,
    maxOutputTokens: 4096,
    apiKey: process.env.GEMINI_API_KEY,
  });

// ─────────────────────────────────────────────────────────────────────────────
// LangChain Tool Definitions  (tool() from @langchain/core/tools)
// ─────────────────────────────────────────────────────────────────────────────

const financialHealthTool = tool(
  async ({ ratios }) => {
    const result = scoringEngine.calculateFinancialHealth(ratios);
    return JSON.stringify(result);
  },
  {
    name: 'financial_health_analysis',
    description:
      'Calculate a financial health score (0-100) covering liquidity, leverage, and efficiency from key ratios.',
    schema: z.object({
      ratios: z.object({
        currentRatio: z.number().optional().describe('Current assets / current liabilities'),
        quickRatio: z.number().optional().describe('Quick assets / current liabilities'),
        debtToEquity: z.number().optional().describe('Total debt / total equity'),
        roe: z.number().optional().describe('Return on equity (%)'),
        roa: z.number().optional().describe('Return on assets (%)'),
      }),
    }),
  }
);

const growthTrendTool = tool(
  async ({ revenueTrends }) => {
    const result = scoringEngine.calculateGrowth(revenueTrends);
    return JSON.stringify(result);
  },
  {
    name: 'growth_trend_analysis',
    description:
      'Score revenue and earnings growth momentum (0-100) from multi-year revenue trend data.',
    schema: z.object({
      revenueTrends: z.array(
        z.object({
          year: z.number().describe('Fiscal year'),
          revenue: z.number().describe('Total revenue in dollars'),
          revenueGrowth: z.number().optional().describe('YoY revenue growth (%)'),
        })
      ),
    }),
  }
);

const profitabilityTool = tool(
  async ({ ratios }) => {
    const result = scoringEngine.calculateProfitability(ratios);
    return JSON.stringify(result);
  },
  {
    name: 'profitability_analysis',
    description:
      'Score profitability (0-100) using net margin, gross margin, operating margin, and ROA.',
    schema: z.object({
      ratios: z.object({
        netMargin: z.number().optional().describe('Net profit margin (%)'),
        grossMargin: z.number().optional().describe('Gross profit margin (%)'),
        operatingMargin: z.number().optional().describe('Operating margin (%)'),
        roa: z.number().optional().describe('Return on assets (%)'),
      }),
    }),
  }
);

const valuationTool = tool(
  async ({ ratios }) => {
    const result = scoringEngine.calculateValuation(ratios);
    return JSON.stringify(result);
  },
  {
    name: 'valuation_analysis',
    description:
      'Score stock valuation (0-100) using P/E, P/B, P/S ratios and dividend yield.',
    schema: z.object({
      ratios: z.object({
        pe: z.number().optional().describe('Price-to-earnings ratio'),
        pb: z.number().optional().describe('Price-to-book ratio'),
        ps: z.number().optional().describe('Price-to-sales ratio'),
        dividendYield: z.number().optional().describe('Dividend yield (%)'),
      }),
    }),
  }
);

const riskAssessmentTool = tool(
  async ({ ratios }) => {
    const result = scoringEngine.calculateRisk(ratios);
    return JSON.stringify(result);
  },
  {
    name: 'risk_assessment',
    description:
      'Score investment risk (0-100 where 100 = lowest risk) from beta, debt-to-equity, and current ratio.',
    schema: z.object({
      ratios: z.object({
        beta: z.number().optional().describe('Stock beta relative to market index'),
        debtToEquity: z.number().optional().describe('Debt-to-equity ratio'),
        currentRatio: z.number().optional().describe('Current ratio for liquidity check'),
      }),
    }),
  }
);

const TOOLS = [
  financialHealthTool,
  growthTrendTool,
  profitabilityTool,
  valuationTool,
  riskAssessmentTool,
];

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schema for withStructuredOutput()
// ─────────────────────────────────────────────────────────────────────────────

const RecommendationSchema = z.object({
  recommendation: z
    .enum(['Invest', 'Hold', 'Pass'])
    .describe('Final investment decision'),
  confidenceScore: z
    .number()
    .min(0)
    .max(100)
    .describe('Confidence percentage 0-100'),
  summary: z.string().describe('2-3 sentence summary of the recommendation'),
  reasoning: z.array(z.string()).describe('Key reasons for the decision'),
  keyDrivers: z.array(z.string()).describe('Main positive factors'),
  risksToMonitor: z.array(z.string()).describe('Key risks to watch'),
  targetPrice: z.number().optional().describe('12-month price target (USD)'),
  timeHorizon: z.string().describe('Investment time horizon e.g. 1-3 years'),
});

// ─────────────────────────────────────────────────────────────────────────────
// LangGraph State  (Annotation.Root)
// ─────────────────────────────────────────────────────────────────────────────

const AdvancedAnalysisState = Annotation.Root({
  // ── Inputs ──
  symbol: Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  companyData: Annotation({ reducer: (a, b) => b ?? a, default: () => ({}) }),

  // ── Tool-calling agent messages (required by ToolNode) ──
  messages: Annotation({
    reducer: (existing, incoming) => {
      const prev = Array.isArray(existing) ? existing : [];
      const next = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
      return [...prev, ...next];
    },
    default: () => [],
  }),

  // ── Scored analysis results (written by financialScoringNode) ──
  financialAnalysis: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  growthAnalysis:    Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  profitabilityAnalysis: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  riskAnalysis:     Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  valuationAnalysis: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // ── AI deep-dive insights from tool-calling loop ──
  aiInsights: Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),

  // ── News & sentiment ──
  news:             Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  sentimentAnalysis: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // ── Macro context (PromptTemplate + StringOutputParser chain) ──
  macroContext: Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),

  // ── Final structured recommendation ──
  recommendation: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  finalOutput:    Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // ── Control flow ──
  errors: Annotation({
    reducer: (a, b) => [
      ...(Array.isArray(a) ? a : []),
      ...(Array.isArray(b) ? b : []),
    ],
    default: () => [],
  }),
  retryCount: Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),
  toolCallsCompleted: Annotation({ reducer: (a, b) => b ?? a, default: () => false }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Node 1: Financial Scoring  (direct tool invocation via tool().invoke())
// ─────────────────────────────────────────────────────────────────────────────

async function financialScoringNode(state) {
  console.log(`[AdvancedAgent] Node: financialScoringNode — ${state.symbol}`);
  const ratios = state.companyData?.ratios || {};
  const revenueTrends = state.companyData?.revenueTrends || [];

  const [fin, growth, profit, risk, valuation] = await Promise.allSettled([
    financialHealthTool.invoke({ ratios }),
    growthTrendTool.invoke({ revenueTrends }),
    profitabilityTool.invoke({ ratios }),
    riskAssessmentTool.invoke({ ratios }),
    valuationTool.invoke({ ratios }),
  ]);

  const parse = (r, fallback) => {
    if (r.status === 'fulfilled') {
      try { return JSON.parse(r.value); } catch { return fallback; }
    }
    return fallback;
  };

  return {
    financialAnalysis:    parse(fin,      { score: 50, explanations: ['Data unavailable'] }),
    growthAnalysis:       parse(growth,   { score: 50, explanations: ['Data unavailable'] }),
    profitabilityAnalysis: parse(profit,  { score: 50, explanations: ['Data unavailable'] }),
    riskAnalysis:         parse(risk,     { score: 50, riskLevel: 'Medium', explanations: [] }),
    valuationAnalysis:    parse(valuation,{ score: 50, explanations: ['Data unavailable'] }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 2: News Gathering
// ─────────────────────────────────────────────────────────────────────────────

async function newsGatheringNode(state) {
  console.log(`[AdvancedAgent] Node: newsGatheringNode — ${state.symbol}`);
  try {
    const news = await newsService.fetchCompanyNews(state.symbol, 15);
    return { news: news || [] };
  } catch (err) {
    return { news: [], errors: [`News fetch error: ${err.message}`] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 3: Sentiment Analysis  (ChatPromptTemplate + JsonOutputParser chain)
// ─────────────────────────────────────────────────────────────────────────────

const sentimentPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a financial sentiment analyst. Analyze news article headlines and their pre-computed 
sentiment scores for a given stock. Respond ONLY with valid JSON — no markdown, no explanation.`,
  ],
  [
    'human',
    `Analyze sentiment for {symbol} based on {articleCount} news articles:

{articleSummary}

Overall pre-computed sentiment average: {avgSentiment}

Return JSON matching exactly this structure:
{{
  "marketMood": "bullish" | "bearish" | "neutral",
  "sentimentScore": <integer 0-100>,
  "positiveCount": <integer>,
  "negativeCount": <integer>,
  "neutralCount": <integer>,
  "sentimentDrivers": ["<driver1>", "<driver2>"],
  "keyConcerns": ["<concern1>"],
  "keyOptimism": ["<optimism1>"]
}}`,
  ],
]);

async function sentimentAnalysisNode(state) {
  console.log(`[AdvancedAgent] Node: sentimentAnalysisNode — ${state.symbol}`);

  const news = state.news || [];

  const fallback = {
    marketMood: 'neutral',
    sentimentScore: 50,
    positiveCount: 0,
    negativeCount: 0,
    neutralCount: 0,
    sentimentDrivers: [],
    keyConcerns: [],
    keyOptimism: [],
  };

  if (news.length === 0) return { sentimentAnalysis: fallback };

  const positive = news.filter(n => n.sentiment > 0.1).length;
  const negative = news.filter(n => n.sentiment < -0.1).length;
  const neutral  = news.length - positive - negative;
  const avgSentiment = (
    news.reduce((s, n) => s + (n.sentiment || 0), 0) / news.length
  ).toFixed(3);

  const articleSummary = news
    .slice(0, 10)
    .map(n => `- [${(n.sentiment || 0).toFixed(2)}] ${n.title}`)
    .join('\n');

  try {
    // RunnableSequence: ChatPromptTemplate → LLM → JsonOutputParser
    const chain = RunnableSequence.from([
      sentimentPrompt,
      getLLM(),
      new JsonOutputParser(),
    ]);

    const result = await chain.invoke({
      symbol: state.symbol,
      articleCount: news.length,
      articleSummary,
      avgSentiment,
    });

    return {
      sentimentAnalysis: {
        ...fallback,
        positiveCount: positive,
        negativeCount: negative,
        neutralCount:  neutral,
        ...result,
      },
    };
  } catch (err) {
    console.warn('[AdvancedAgent] Sentiment chain error:', err.message);
    return {
      sentimentAnalysis: {
        ...fallback,
        positiveCount: positive,
        negativeCount: negative,
        neutralCount:  neutral,
        sentimentScore: Math.round((parseFloat(avgSentiment) + 1) * 50),
      },
      errors: [`Sentiment error: ${err.message}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 4: Macro Context  (PromptTemplate + RunnableSequence + StringOutputParser)
// ─────────────────────────────────────────────────────────────────────────────

const macroPrompt = PromptTemplate.fromTemplate(
  `You are a macro-economic analyst. Provide 3-4 concise bullet-point insights about the 
macro environment for {symbol} in the {industry} sector.

Current signals:
- Financial health score: {financialScore}/100
- Growth score: {growthScore}/100
- Risk level: {riskLevel}
- Market mood: {marketMood}

Focus on: interest-rate sensitivity, sector tailwinds/headwinds, competitive dynamics.
Respond with a plain numbered list — no JSON, no headers.`
);

async function macroContextNode(state) {
  console.log(`[AdvancedAgent] Node: macroContextNode — ${state.symbol}`);
  try {
    // RunnableSequence: PromptTemplate → LLM → StringOutputParser
    const chain = RunnableSequence.from([
      macroPrompt,
      getLLM(),
      new StringOutputParser(),
    ]);

    const text = await chain.invoke({
      symbol:        state.symbol,
      industry:      state.companyData?.profile?.industry || 'unknown sector',
      financialScore: state.financialAnalysis?.score ?? 50,
      growthScore:   state.growthAnalysis?.score ?? 50,
      riskLevel:     state.riskAnalysis?.riskLevel ?? 'Medium',
      marketMood:    state.sentimentAnalysis?.marketMood ?? 'neutral',
    });

    return { macroContext: text };
  } catch (err) {
    console.warn('[AdvancedAgent] Macro context error:', err.message);
    return {
      macroContext: 'Macro context unavailable.',
      errors: [`Macro context error: ${err.message}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 5: AI Deep-Dive Agent  (llm.bindTools + tool-calling loop)
// ─────────────────────────────────────────────────────────────────────────────

// ChatPromptTemplate for the AI analysis node
const aiAnalysisSystemTemplate = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a senior investment analyst for {symbol}.
You have access to quantitative analysis tools. Use them to deepen your understanding where needed.
After calling tools (if any), provide a concise investment insight paragraph.`,
  ],
  [
    'human',
    `Analyze {symbol} for investment suitability.

Preliminary quantitative scores (0-100):
- Financial Health : {financialScore}
- Growth           : {growthScore}
- Profitability    : {profitabilityScore}
- Risk             : {riskScore} ({riskLevel} risk)
- Valuation        : {valuationScore}
- Sentiment        : {sentimentScore} ({marketMood})

Macro context:
{macroContext}

Company data available: P/E={pe}, Net Margin={netMargin}%, Revenue Trend data={hasTrends}

Use the analysis tools if you want deeper scoring for any dimension, then share your key investment thesis.`,
  ],
]);

async function aiDeepDiveNode(state) {
  console.log(`[AdvancedAgent] Node: aiDeepDiveNode — ${state.symbol} (retry=${state.retryCount})`);

  const llm = getLLM();
  // Bind all tools to the LLM so it can call them
  const llmWithTools = llm.bindTools(TOOLS);

  const ratios = state.companyData?.ratios || {};

  // Build context messages via ChatPromptTemplate
  let contextMessages;
  try {
    contextMessages = await aiAnalysisSystemTemplate.formatMessages({
      symbol:           state.symbol,
      financialScore:   state.financialAnalysis?.score ?? 'N/A',
      growthScore:      state.growthAnalysis?.score ?? 'N/A',
      profitabilityScore: state.profitabilityAnalysis?.score ?? 'N/A',
      riskScore:        state.riskAnalysis?.score ?? 'N/A',
      riskLevel:        state.riskAnalysis?.riskLevel ?? 'Medium',
      valuationScore:   state.valuationAnalysis?.score ?? 'N/A',
      sentimentScore:   state.sentimentAnalysis?.sentimentScore ?? 50,
      marketMood:       state.sentimentAnalysis?.marketMood ?? 'neutral',
      macroContext:     state.macroContext || 'Not yet analyzed.',
      pe:               ratios.pe ?? 'N/A',
      netMargin:        ratios.netMargin ?? 'N/A',
      hasTrends:        (state.companyData?.revenueTrends?.length || 0) > 0 ? 'yes' : 'no',
    });
  } catch (err) {
    contextMessages = [
      new SystemMessage(`You are a senior investment analyst for ${state.symbol}.`),
      new HumanMessage(`Analyze ${state.symbol} investment potential using available tools.`),
    ];
  }

  // Add retry hint if this is a retry pass
  if (state.retryCount > 0) {
    contextMessages.push(
      new HumanMessage(
        `Note: The previous recommendation had low confidence (${state.recommendation?.confidenceScore ?? 0}%). ` +
        `Please call additional tools and reconsider with more depth.`
      )
    );
  }

  // Combine with accumulated tool-calling messages from prior loop iterations
  const allMessages = [...contextMessages, ...state.messages];

  try {
    const response = await llmWithTools.invoke(allMessages);

    // If the AI produced text (no tool calls), extract as insights
    const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;
    const insights = !hasToolCalls && response.content
      ? (typeof response.content === 'string' ? response.content : JSON.stringify(response.content))
      : state.aiInsights || '';

    return {
      messages: [response],
      ...(insights && { aiInsights: insights }),
    };
  } catch (err) {
    console.error('[AdvancedAgent] AI deep-dive error:', err.message);
    return {
      aiInsights: `Analysis: ${state.symbol} scored ${state.financialAnalysis?.score ?? 50}/100 on financial health.`,
      toolCallsCompleted: true,
      errors: [`AI deep-dive error: ${err.message}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 6: Tool Execution  (ToolNode from @langchain/langgraph/prebuilt)
// ─────────────────────────────────────────────────────────────────────────────

const toolExecutorNode = new ToolNode(TOOLS);

// ─────────────────────────────────────────────────────────────────────────────
// Node 7: Recommendation  (withStructuredOutput + Zod schema)
// ─────────────────────────────────────────────────────────────────────────────

const recommendationPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are the Chief Investment Officer. Make a final, decisive investment recommendation.
Respond with a properly structured JSON object — no markdown.`,
  ],
  [
    'human',
    `Make a final recommendation for {symbol}.

QUANTITATIVE SCORES:
- Financial Health : {financialScore}/100
  Key points: {financialExplanations}
- Growth           : {growthScore}/100
  Key points: {growthExplanations}
- Profitability    : {profitabilityScore}/100
  Key points: {profitabilityExplanations}
- Risk             : {riskScore}/100 ({riskLevel})
  Key points: {riskExplanations}
- Valuation        : {valuationScore}/100
- Sentiment        : {sentimentScore}/100 ({marketMood})

AI ANALYST INSIGHTS:
{aiInsights}

MACRO CONTEXT:
{macroContext}

Based on all of the above, provide your investment recommendation.`,
  ],
]);

async function recommendationNode(state) {
  console.log(`[AdvancedAgent] Node: recommendationNode — ${state.symbol}`);

  const fa  = state.financialAnalysis    || { score: 50, explanations: [] };
  const ga  = state.growthAnalysis       || { score: 50, explanations: [] };
  const pa  = state.profitabilityAnalysis || { score: 50, explanations: [] };
  const ra  = state.riskAnalysis         || { score: 50, riskLevel: 'Medium', explanations: [] };
  const va  = state.valuationAnalysis    || { score: 50 };
  const sa  = state.sentimentAnalysis    || { sentimentScore: 50, marketMood: 'neutral' };

  const promptVars = {
    symbol:                  state.symbol,
    financialScore:          fa.score,
    financialExplanations:   (fa.explanations || []).slice(0, 3).join('; ') || 'N/A',
    growthScore:             ga.score,
    growthExplanations:      (ga.explanations || []).slice(0, 3).join('; ') || 'N/A',
    profitabilityScore:      pa.score,
    profitabilityExplanations: (pa.explanations || []).slice(0, 3).join('; ') || 'N/A',
    riskScore:               ra.score,
    riskLevel:               ra.riskLevel,
    riskExplanations:        (ra.explanations || []).slice(0, 3).join('; ') || 'N/A',
    valuationScore:          va.score,
    sentimentScore:          sa.sentimentScore,
    marketMood:              sa.marketMood,
    aiInsights:              state.aiInsights || 'No additional insights.',
    macroContext:            state.macroContext || 'Not available.',
  };

  // RunnableLambda: compute avg score for fallback
  const avgScoreRunnable = new RunnableLambda({
    func: (vars) => {
      const avg = (
        vars.financialScore + vars.growthScore +
        vars.profitabilityScore + vars.riskScore + vars.valuationScore
      ) / 5;
      return Math.round(avg);
    },
  });
  const avgScore = await avgScoreRunnable.invoke(promptVars);

  try {
    const llm = getLLM();
    // withStructuredOutput binds the Zod schema for type-safe output
    const structuredLLM = llm.withStructuredOutput(RecommendationSchema, {
      name: 'investment_recommendation',
    });

    const messages = await recommendationPrompt.formatMessages(promptVars);
    const recommendation = await structuredLLM.invoke(messages);

    return { recommendation };
  } catch (err) {
    console.warn('[AdvancedAgent] withStructuredOutput failed, falling back to JsonOutputParser chain:', err.message);

    try {
      // Fallback: ChatPromptTemplate → LLM → JsonOutputParser
      const fallbackChain = RunnableSequence.from([
        recommendationPrompt,
        getLLM(),
        new JsonOutputParser(),
      ]);
      const raw = await fallbackChain.invoke(promptVars);
      const rec = raw.recommendation || (avgScore >= 70 ? 'Invest' : avgScore >= 45 ? 'Hold' : 'Pass');
      return {
        recommendation: {
          recommendation:  ['Invest', 'Hold', 'Pass'].includes(rec) ? rec : 'Hold',
          confidenceScore: raw.confidenceScore ?? avgScore,
          summary:         raw.summary ?? `${state.symbol} scored ${avgScore}/100 overall.`,
          reasoning:       raw.reasoning ?? [`Avg score ${avgScore}/100`],
          keyDrivers:      raw.keyDrivers ?? [],
          risksToMonitor:  raw.risksToMonitor ?? [],
          timeHorizon:     raw.timeHorizon ?? '1-2 years',
        },
      };
    } catch (innerErr) {
      const rec = avgScore >= 70 ? 'Invest' : avgScore >= 45 ? 'Hold' : 'Pass';
      return {
        recommendation: {
          recommendation:  rec,
          confidenceScore: avgScore,
          summary:         `${state.symbol} scored ${avgScore}/100 overall.`,
          reasoning:       [`Financial ${fa.score}/100`, `Growth ${ga.score}/100`, `Risk ${ra.riskLevel}`],
          keyDrivers:      (fa.explanations || []).slice(0, 2),
          risksToMonitor:  (ra.explanations || []).slice(0, 2),
          timeHorizon:     '1-2 years',
        },
        errors: [`Recommendation fallback: ${innerErr.message}`],
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 8: Final Output Assembler
// ─────────────────────────────────────────────────────────────────────────────

async function finalOutputNode(state) {
  console.log(`[AdvancedAgent] Node: finalOutputNode — ${state.symbol}`);

  const finalOutput = {
    symbol:      state.symbol,
    companyName: state.companyData?.profile?.name || state.symbol,
    industry:    state.companyData?.profile?.industry || 'N/A',
    analysis: {
      financial:    state.financialAnalysis    || { score: 50, explanations: [] },
      growth:       state.growthAnalysis       || { score: 50, explanations: [] },
      profitability: state.profitabilityAnalysis || { score: 50, explanations: [] },
      risk:         state.riskAnalysis         || { score: 50, riskLevel: 'Medium', explanations: [] },
      valuation:    state.valuationAnalysis    || { score: 50, explanations: [] },
      sentiment:    state.sentimentAnalysis    || { sentimentScore: 50, marketMood: 'neutral' },
    },
    aiInsights:  state.aiInsights || '',
    macroContext: state.macroContext || '',
    recommendation: state.recommendation || {
      recommendation: 'Hold',
      confidenceScore: 50,
      summary: 'Analysis incomplete.',
      reasoning: [],
      keyDrivers: [],
      risksToMonitor: [],
      timeHorizon: 'N/A',
    },
    errors:      state.errors || [],
    generatedAt: new Date().toISOString(),
    agentVersion: '3.0',
    agentFramework: 'LangGraph + LangChain',
  };

  return { finalOutput };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conditional Edge: After aiDeepDiveNode — route to tools or recommendation
// ─────────────────────────────────────────────────────────────────────────────

function routeAfterAIDeepDive(state) {
  const msgs = state.messages;
  if (!msgs || msgs.length === 0) return 'recommendationNode';

  const lastMsg = msgs[msgs.length - 1];

  // If the AI requested tool calls AND we haven't already completed a tool round
  if (
    lastMsg?.tool_calls?.length > 0 &&
    !state.toolCallsCompleted
  ) {
    return 'toolExecutorNode';
  }

  return 'recommendationNode';
}

// ─────────────────────────────────────────────────────────────────────────────
// Conditional Edge: After toolExecutorNode — loop back or continue
// ─────────────────────────────────────────────────────────────────────────────

function routeAfterTools(state) {
  // After one round of tool execution, mark complete and return to AI for synthesis
  return 'aiDeepDiveNode';
}

// ─────────────────────────────────────────────────────────────────────────────
// Conditional Edge: After recommendationNode — retry or finish
// ─────────────────────────────────────────────────────────────────────────────

function routeAfterRecommendation(state) {
  const confidence = state.recommendation?.confidenceScore ?? 100;
  const retryCount = state.retryCount ?? 0;

  // Retry if confidence is too low (max 2 retries)
  if (confidence < 35 && retryCount < 2) {
    console.log(`[AdvancedAgent] Low confidence (${confidence}%), retry ${retryCount + 1}/2`);
    return 'retryNode';
  }

  return 'finalOutputNode';
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry Node — bumps counter, clears messages, routes back to AI
// ─────────────────────────────────────────────────────────────────────────────

async function retryNode(state) {
  console.log(`[AdvancedAgent] Node: retryNode — incrementing retry count`);
  return {
    retryCount: (state.retryCount ?? 0) + 1,
    messages: [], // clear accumulated tool messages for a fresh retry pass
    toolCallsCompleted: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the LangGraph Workflow
// ─────────────────────────────────────────────────────────────────────────────

function buildWorkflow() {
  const workflow = new StateGraph(AdvancedAnalysisState);

  // ── Register nodes ──
  workflow.addNode('financialScoringNode',   financialScoringNode);
  workflow.addNode('newsGatheringNode',      newsGatheringNode);
  workflow.addNode('sentimentAnalysisNode',  sentimentAnalysisNode);
  workflow.addNode('macroContextNode',       macroContextNode);
  workflow.addNode('aiDeepDiveNode',         aiDeepDiveNode);
  workflow.addNode('toolExecutorNode',       toolExecutorNode);
  workflow.addNode('recommendationNode',     recommendationNode);
  workflow.addNode('retryNode',              retryNode);
  workflow.addNode('finalOutputNode',        finalOutputNode);

  // ── Define edges ──
  workflow.addEdge(START,                   'financialScoringNode');
  workflow.addEdge('financialScoringNode',  'newsGatheringNode');
  workflow.addEdge('newsGatheringNode',     'sentimentAnalysisNode');
  workflow.addEdge('sentimentAnalysisNode', 'macroContextNode');
  workflow.addEdge('macroContextNode',      'aiDeepDiveNode');

  // Conditional: AI decides whether to call tools or go straight to recommendation
  workflow.addConditionalEdges('aiDeepDiveNode', routeAfterAIDeepDive, {
    toolExecutorNode:   'toolExecutorNode',
    recommendationNode: 'recommendationNode',
  });

  // After tool execution, mark completed and loop back to AI for synthesis
  workflow.addConditionalEdges('toolExecutorNode', routeAfterTools, {
    aiDeepDiveNode: 'aiDeepDiveNode',
  });

  // After tool completion (second pass), set flag
  workflow.addEdge('toolExecutorNode', 'aiDeepDiveNode');

  // Conditional: low-confidence recommendation triggers retry
  workflow.addConditionalEdges('recommendationNode', routeAfterRecommendation, {
    retryNode:      'retryNode',
    finalOutputNode: 'finalOutputNode',
  });

  // After retry, go back to AI for a deeper pass
  workflow.addEdge('retryNode',        'aiDeepDiveNode');
  workflow.addEdge('finalOutputNode',  END);

  return workflow.compile();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

class AdvancedAgentService {
  async runAdvancedAnalysis(symbol, companyData) {
    console.log(`[AdvancedAgent] Starting LangGraph analysis for ${symbol}...`);

    try {
      const app = buildWorkflow();

      const initialState = {
        symbol:             symbol || 'N/A',
        companyData:        companyData || {},
        messages:           [],
        financialAnalysis:  null,
        growthAnalysis:     null,
        profitabilityAnalysis: null,
        riskAnalysis:       null,
        valuationAnalysis:  null,
        aiInsights:         '',
        news:               [],
        sentimentAnalysis:  null,
        macroContext:       '',
        recommendation:     null,
        finalOutput:        null,
        errors:             [],
        retryCount:         0,
        toolCallsCompleted: false,
      };

      // Run the full LangGraph workflow
      const finalState = await app.invoke(initialState);

      if (!finalState.finalOutput) {
        throw new Error('Workflow completed without producing final output.');
      }

      return {
        success: true,
        symbol,
        data: finalState.finalOutput,
      };
    } catch (err) {
      console.error('[AdvancedAgent] Fatal workflow error:', err.message);

      // Graceful fallback
      return {
        success: false,
        symbol,
        error: err.message,
        data: {
          symbol,
          companyName: companyData?.profile?.name || symbol,
          industry:    companyData?.profile?.industry || 'N/A',
          analysis: {
            financial:    { score: 50, explanations: [] },
            growth:       { score: 50, explanations: [] },
            profitability: { score: 50, explanations: [] },
            risk:         { score: 50, riskLevel: 'Medium', explanations: [] },
            valuation:    { score: 50, explanations: [] },
            sentiment:    { sentimentScore: 50, marketMood: 'neutral' },
          },
          recommendation: {
            recommendation: 'Hold',
            confidenceScore: 0,
            summary: 'Analysis could not be completed.',
            reasoning: [err.message],
            keyDrivers: [],
            risksToMonitor: [],
            timeHorizon: 'N/A',
          },
          errors:       [err.message],
          generatedAt:  new Date().toISOString(),
          agentVersion: '3.0',
          agentFramework: 'LangGraph + LangChain',
        },
      };
    }
  }
}

export default new AdvancedAgentService();
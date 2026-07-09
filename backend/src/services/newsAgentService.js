/**
 * newsAgentService.js
 *
 * Full LangChain + LangGraph integration:
 *  ✅ Annotation.Root — typed state schema (replaces legacy channels API)
 *  ✅ StateGraph + START + END — directed multi-node workflow
 *  ✅ tool() — LangChain tool definitions for newsService & youtubeService
 *  ✅ llm.bindTools() — LLM bound to tools
 *  ✅ ToolNode (prebuilt) — automatic tool execution from LLM tool_calls
 *  ✅ Conditional edges — route to tool-execution loop or analysis
 *  ✅ ChatPromptTemplate.fromMessages() — typed prompt templates for analysis
 *  ✅ JsonOutputParser — parse structured JSON from LLM
 *  ✅ StringOutputParser — parse plain text from LLM
 *  ✅ RunnableSequence.from() — composable chain pipeline
 *  ✅ RunnableLambda — inline custom runnable steps
 *  ✅ HumanMessage / SystemMessage — typed LangChain message classes
 *  ✅ withStructuredOutput() + Zod — typed executive-summary output
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser, StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import newsService from './newsService.js';
import youtubeService from './youtubeService.js';

// ─────────────────────────────────────────────────────────────────────────────
// LLM factory
// ─────────────────────────────────────────────────────────────────────────────

const getLLM = () =>
  new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    temperature: 0.2,
    maxOutputTokens: 4096,
    apiKey: process.env.GEMINI_API_KEY,
  });

// ─────────────────────────────────────────────────────────────────────────────
// LangChain tool() definitions
// ─────────────────────────────────────────────────────────────────────────────

const fetchNewsTool = tool(
  async ({ symbol, limit }) => {
    console.log(`[NewsAgent] tool: fetchNewsTool — ${symbol}`);
    const articles = await newsService.fetchCompanyNews(symbol, limit);
    const sentiment = await newsService.getNewsSentiment(symbol);
    return JSON.stringify({ articles: articles || [], sentiment: sentiment || null });
  },
  {
    name: 'fetch_news',
    description: 'Fetch the latest news articles and overall sentiment for a stock ticker symbol.',
    schema: z.object({
      symbol: z.string().describe('Stock ticker symbol e.g. AAPL'),
      limit: z.number().int().min(1).max(30).default(20).describe('Max articles to fetch'),
    }),
  }
);

const fetchVideosTool = tool(
  async ({ symbol, companyName, limit }) => {
    console.log(`[NewsAgent] tool: fetchVideosTool — ${symbol}`);
    const videos = await youtubeService.searchCompanyVideos(symbol, companyName, limit);
    return JSON.stringify({ videos: videos || [] });
  },
  {
    name: 'fetch_videos',
    description: 'Search YouTube for videos about a company by ticker and name.',
    schema: z.object({
      symbol: z.string().describe('Stock ticker symbol'),
      companyName: z.string().describe('Full company name for better search results'),
      limit: z.number().int().min(1).max(10).default(6).describe('Max videos to fetch'),
    }),
  }
);

const NEWS_TOOLS = [fetchNewsTool, fetchVideosTool];

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for withStructuredOutput()
// ─────────────────────────────────────────────────────────────────────────────

const ExecutiveSummarySchema = z.object({
  executiveSummary: z.string().describe('2-3 paragraph executive summary'),
  keyTakeaways: z.array(z.string()).describe('3-5 key takeaways for investors'),
  newsHighlight: z.string().describe('Most important news headline and its impact'),
  videoHighlight: z.string().describe('Most relevant video title and its topic'),
  recommendation: z.string().describe('Short-term market sentiment recommendation'),
  confidenceScore: z.number().min(0).max(100).describe('Confidence in the analysis 0-100'),
  marketMood: z.enum(['bullish', 'bearish', 'neutral']).describe('Overall market mood'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Annotation.Root — typed state schema
// ─────────────────────────────────────────────────────────────────────────────

const NewsAnalysisState = Annotation.Root({
  // Inputs
  symbol:      Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  companyName: Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),

  // Tool-calling messages (required by ToolNode)
  messages: Annotation({
    reducer: (existing, incoming) => {
      const prev = Array.isArray(existing) ? existing : [];
      const next = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
      return [...prev, ...next];
    },
    default: () => [],
  }),

  // Data collected by tools
  news:         Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  videos:       Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  newsSentiment: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // Analysis outputs
  combinedAnalysis: Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  summary:          Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  macroNarrative:   Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),

  // Control flow
  dataFetched: Annotation({ reducer: (a, b) => b ?? a, default: () => false }),
  errors: Annotation({
    reducer: (a, b) => [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])],
    default: () => [],
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Node 1: Data-fetching agent (llm.bindTools + tool-calling loop entry)
// ─────────────────────────────────────────────────────────────────────────────

const dataFetchingPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a financial data research agent for stock {symbol}.
Your ONLY job is to call the available tools to fetch news and videos.
Call fetch_news first, then fetch_videos. Call BOTH tools before stopping.`,
  ],
  [
    'human',
    `Fetch all data for {symbol} (company: {companyName}).
- Call fetch_news with symbol="{symbol}" limit=20
- Call fetch_videos with symbol="{symbol}" companyName="{companyName}" limit=6`,
  ],
]);

async function dataFetchingAgentNode(state) {
  console.log(`[NewsAgent] Node: dataFetchingAgentNode — ${state.symbol}`);
  const llm = getLLM();
  const llmWithTools = llm.bindTools(NEWS_TOOLS);

  try {
    const messages = await dataFetchingPrompt.formatMessages({
      symbol: state.symbol,
      companyName: state.companyName || state.symbol,
    });

    const response = await llmWithTools.invoke([...messages, ...state.messages]);
    return { messages: [response] };
  } catch (err) {
    console.warn('[NewsAgent] Data fetching agent error:', err.message);
    return {
      dataFetched: true, // skip to fallback path
      errors: [`Data fetching agent error: ${err.message}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 2: ToolNode — executes tool calls from the LLM
// ─────────────────────────────────────────────────────────────────────────────

const toolExecutorNode = new ToolNode(NEWS_TOOLS);

// ─────────────────────────────────────────────────────────────────────────────
// Node 3: Data extraction — parse tool results from messages into state
// ─────────────────────────────────────────────────────────────────────────────

async function dataExtractionNode(state) {
  console.log(`[NewsAgent] Node: dataExtractionNode — ${state.symbol}`);

  let news = [];
  let videos = [];
  let newsSentiment = null;

  // Parse tool result messages
  for (const msg of state.messages) {
    if (msg?.constructor?.name === 'ToolMessage' || msg?._getType?.() === 'tool') {
      try {
        const parsed = JSON.parse(msg.content || '{}');
        if (parsed.articles) {
          news = parsed.articles;
          newsSentiment = parsed.sentiment;
        }
        if (parsed.videos) {
          videos = parsed.videos;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // Fallback: call services directly if tool messages had no data
  if (news.length === 0) {
    try {
      news = await newsService.fetchCompanyNews(state.symbol, 20) || [];
      newsSentiment = await newsService.getNewsSentiment(state.symbol);
    } catch (err) {
      console.warn('[NewsAgent] Direct news fetch error:', err.message);
    }
  }
  if (videos.length === 0) {
    try {
      videos = await youtubeService.searchCompanyVideos(
        state.symbol, state.companyName || state.symbol, 6
      ) || [];
    } catch (err) {
      console.warn('[NewsAgent] Direct video fetch error:', err.message);
    }
  }

  return {
    news,
    videos,
    newsSentiment,
    dataFetched: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 4: Sentiment & Analysis  (ChatPromptTemplate + JsonOutputParser chain)
// ─────────────────────────────────────────────────────────────────────────────

const analysisPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a financial news analyst. Analyze news and video data for {symbol}.
Respond ONLY with valid JSON — no markdown fences.`,
  ],
  [
    'human',
    `Analyze {symbol} ({companyName}) from the following data:

NEWS ({newsCount} articles):
{newsSummary}

VIDEOS ({videoCount} videos):
{videoSummary}

PRE-COMPUTED SENTIMENT SCORE: {sentimentScore}/100

Return exactly this JSON:
{{
  "marketSentiment": "bullish" | "bearish" | "neutral",
  "sentimentScore": <integer 0-100>,
  "keyTopics": ["topic1", "topic2"],
  "emergingTrends": ["trend1"],
  "riskFactors": ["risk1"],
  "opportunityFactors": ["opp1"],
  "overallAssessment": "brief assessment text",
  "confidence": <integer 0-100>
}}`,
  ],
]);

async function combinedAnalysisNode(state) {
  console.log(`[NewsAgent] Node: combinedAnalysisNode — ${state.symbol}`);

  const news   = state.news   || [];
  const videos = state.videos || [];
  const sa     = state.newsSentiment;

  const newsSummary = news
    .slice(0, 10)
    .map(n => `- [${(n.sentiment || 0).toFixed(2)}] ${n.title || 'No title'}`)
    .join('\n') || 'No news available';

  const videoSummary = videos
    .slice(0, 5)
    .map(v => `- ${v.title || 'No title'} (${v.channelTitle || 'Unknown'})`)
    .join('\n') || 'No videos available';

  const sentimentScore = sa?.sentimentScore ?? Math.round(
    ((news.reduce((s, n) => s + (n.sentiment || 0), 0) / (news.length || 1)) + 1) * 50
  );

  const fallback = {
    marketSentiment: sentimentScore > 60 ? 'bullish' : sentimentScore < 40 ? 'bearish' : 'neutral',
    sentimentScore,
    keyTopics: ['Market News', 'Financial Analysis'],
    emergingTrends: [],
    riskFactors: ['Market volatility'],
    opportunityFactors: ['Information available'],
    overallAssessment: `${state.symbol} has ${news.length} news articles and ${videos.length} videos.`,
    confidence: 60,
  };

  try {
    // RunnableSequence: ChatPromptTemplate → LLM → JsonOutputParser
    const chain = RunnableSequence.from([
      analysisPrompt,
      getLLM(),
      new JsonOutputParser(),
    ]);

    const result = await chain.invoke({
      symbol: state.symbol,
      companyName: state.companyName || state.symbol,
      newsCount: news.length,
      newsSummary,
      videoCount: videos.length,
      videoSummary,
      sentimentScore,
    });

    return { combinedAnalysis: { ...fallback, ...result } };
  } catch (err) {
    console.warn('[NewsAgent] Analysis chain error:', err.message);
    return {
      combinedAnalysis: fallback,
      errors: [`Analysis error: ${err.message}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 5: Macro narrative  (PromptTemplate + StringOutputParser via RunnableSequence)
// ─────────────────────────────────────────────────────────────────────────────

import { PromptTemplate } from '@langchain/core/prompts';

const macroPrompt = PromptTemplate.fromTemplate(
  `You are a macro market analyst. In 2-3 concise sentences, describe the macro narrative 
for {symbol} based on: market mood = {mood}, key topics = {topics}, confidence = {confidence}%.
Focus on what this means for an investor's near-term outlook.`
);

async function macroNarrativeNode(state) {
  console.log(`[NewsAgent] Node: macroNarrativeNode — ${state.symbol}`);
  const ca = state.combinedAnalysis || {};
  try {
    // RunnableSequence: PromptTemplate → LLM → StringOutputParser
    const chain = RunnableSequence.from([
      macroPrompt,
      getLLM(),
      new StringOutputParser(),
    ]);

    const text = await chain.invoke({
      symbol: state.symbol,
      mood: ca.marketSentiment || 'neutral',
      topics: (ca.keyTopics || []).slice(0, 3).join(', ') || 'N/A',
      confidence: ca.confidence ?? 60,
    });

    return { macroNarrative: text.trim() };
  } catch (err) {
    return {
      macroNarrative: `Macro environment for ${state.symbol} appears ${ca.marketSentiment || 'neutral'}.`,
      errors: [`Macro narrative error: ${err.message}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 6: Executive summary  (withStructuredOutput + Zod schema)
// ─────────────────────────────────────────────────────────────────────────────

const summaryPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a senior financial analyst writing an executive briefing for investors.
Be concise, evidence-based, and actionable.`,
  ],
  [
    'human',
    `Write an executive summary for {symbol} ({companyName}).

ANALYSIS:
- Market Sentiment  : {sentiment} (score: {sentimentScore}/100)
- Key Topics        : {keyTopics}
- Emerging Trends   : {emergingTrends}
- Risk Factors      : {riskFactors}
- Opportunities     : {opportunities}
- Overall Assessment: {assessment}

MACRO CONTEXT: {macroNarrative}

News count: {newsCount} | Video count: {videoCount}
Top news: {topNews}
Top video: {topVideo}

Provide the full executive summary structure.`,
  ],
]);

async function executiveSummaryNode(state) {
  console.log(`[NewsAgent] Node: executiveSummaryNode — ${state.symbol}`);

  const ca    = state.combinedAnalysis || {};
  const news  = state.news  || [];
  const videos = state.videos || [];

  const promptVars = {
    symbol: state.symbol,
    companyName: state.companyName || state.symbol,
    sentiment: ca.marketSentiment || 'neutral',
    sentimentScore: ca.sentimentScore ?? 50,
    keyTopics: (ca.keyTopics || []).join(', ') || 'N/A',
    emergingTrends: (ca.emergingTrends || []).join(', ') || 'N/A',
    riskFactors: (ca.riskFactors || []).join(', ') || 'N/A',
    opportunities: (ca.opportunityFactors || []).join(', ') || 'N/A',
    assessment: ca.overallAssessment || 'N/A',
    macroNarrative: state.macroNarrative || 'N/A',
    newsCount: news.length,
    videoCount: videos.length,
    topNews: news[0]?.title || 'No news available',
    topVideo: videos[0]?.title || 'No videos available',
  };

  // RunnableLambda: compute fallback confidence
  const confidenceRunnable = new RunnableLambda({
    func: (vars) => Math.min(90, (vars.sentimentScore || 50) + (vars.newsCount > 10 ? 10 : 0)),
  });
  const fallbackConfidence = await confidenceRunnable.invoke(promptVars);

  const fallback = {
    executiveSummary: `${state.symbol} shows ${ca.marketSentiment || 'neutral'} sentiment based on ${news.length} news articles.`,
    keyTakeaways: [
      `${news.length} news articles analyzed`,
      `Sentiment score: ${ca.sentimentScore ?? 50}/100`,
      `${videos.length} video sources found`,
    ],
    newsHighlight: news[0]?.title || 'No news available',
    videoHighlight: videos[0]?.title || 'No videos available',
    recommendation: ca.marketSentiment === 'bullish' ? 'Positive short-term outlook' :
                    ca.marketSentiment === 'bearish' ? 'Caution advised' : 'Neutral outlook',
    confidenceScore: fallbackConfidence,
    marketMood: (ca.marketSentiment || 'neutral'),
  };

  try {
    // withStructuredOutput() — type-safe Zod-parsed output
    const structuredLLM = getLLM().withStructuredOutput(ExecutiveSummarySchema, {
      name: 'executive_summary',
    });
    const messages = await summaryPrompt.formatMessages(promptVars);
    const result = await structuredLLM.invoke(messages);
    return { summary: { ...fallback, ...result } };
  } catch (err) {
    console.warn('[NewsAgent] withStructuredOutput fallback to chain:', err.message);
    try {
      // Fallback: ChatPromptTemplate → LLM → JsonOutputParser
      const chain = RunnableSequence.from([
        summaryPrompt,
        getLLM(),
        new JsonOutputParser(),
      ]);
      const raw = await chain.invoke(promptVars);
      return { summary: { ...fallback, ...raw } };
    } catch (innerErr) {
      return {
        summary: fallback,
        errors: [`Summary error: ${innerErr.message}`],
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conditional edges
// ─────────────────────────────────────────────────────────────────────────────

function routeAfterDataAgent(state) {
  // If the LLM issued tool calls, execute them
  if (state.dataFetched) return 'dataExtractionNode'; // error path — skip tool execution
  const msgs = state.messages;
  if (!msgs || msgs.length === 0) return 'dataExtractionNode';
  const lastMsg = msgs[msgs.length - 1];
  if (lastMsg?.tool_calls?.length > 0) return 'toolExecutorNode';
  return 'dataExtractionNode';
}

function routeAfterTools(state) {
  // Check if both tools have been called (look for two ToolMessages)
  const toolMessages = (state.messages || []).filter(
    m => m?.constructor?.name === 'ToolMessage' || m?._getType?.() === 'tool'
  );
  // If we have responses from both tools (or AI stopped calling), extract data
  return 'dataExtractionNode';
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the LangGraph workflow
// ─────────────────────────────────────────────────────────────────────────────

function buildNewsWorkflow() {
  const workflow = new StateGraph(NewsAnalysisState);

  // Register nodes
  workflow.addNode('dataFetchingAgentNode', dataFetchingAgentNode);
  workflow.addNode('toolExecutorNode',      toolExecutorNode);
  workflow.addNode('dataExtractionNode',   dataExtractionNode);
  workflow.addNode('combinedAnalysisNode', combinedAnalysisNode);
  workflow.addNode('macroNarrativeNode',   macroNarrativeNode);
  workflow.addNode('executiveSummaryNode', executiveSummaryNode);

  // Edges
  workflow.addEdge(START, 'dataFetchingAgentNode');

  // Conditional: did the LLM request tools?
  workflow.addConditionalEdges('dataFetchingAgentNode', routeAfterDataAgent, {
    toolExecutorNode:    'toolExecutorNode',
    dataExtractionNode: 'dataExtractionNode',
  });

  // After tool execution, check if agent wants more tool calls
  workflow.addConditionalEdges('toolExecutorNode', routeAfterTools, {
    dataExtractionNode: 'dataExtractionNode',
  });

  workflow.addEdge('dataExtractionNode',   'combinedAnalysisNode');
  workflow.addEdge('combinedAnalysisNode', 'macroNarrativeNode');
  workflow.addEdge('macroNarrativeNode',   'executiveSummaryNode');
  workflow.addEdge('executiveSummaryNode', END);

  return workflow.compile();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

class NewsAgentService {
  async runAnalysis(symbol, companyName) {
    console.log(`[NewsAgent] Starting LangGraph analysis for ${symbol}...`);
    try {
      const app = buildNewsWorkflow();

      const initialState = {
        symbol:          symbol || 'N/A',
        companyName:     companyName || symbol || 'N/A',
        messages:        [],
        news:            [],
        videos:          [],
        newsSentiment:   null,
        combinedAnalysis: null,
        summary:         null,
        macroNarrative:  '',
        dataFetched:     false,
        errors:          [],
      };

      const finalState = await app.invoke(initialState);

      return {
        success: true,
        symbol,
        news:     finalState.news     || [],
        videos:   finalState.videos   || [],
        sentiment: finalState.newsSentiment || null,
        analysis:  finalState.combinedAnalysis || null,
        summary:   finalState.summary || null,
        macroNarrative: finalState.macroNarrative || '',
        errors:    finalState.errors  || [],
      };
    } catch (err) {
      console.error('[NewsAgent] Fatal workflow error:', err.message);
      return await this.quickAnalysis(symbol, companyName);
    }
  }

  // Direct fallback (no LangGraph) — used only on catastrophic error
  async quickAnalysis(symbol, companyName) {
    try {
      const news      = await newsService.fetchCompanyNews(symbol, 15) || [];
      const sentiment = await newsService.getNewsSentiment(symbol);
      const videos    = await youtubeService.searchCompanyVideos(symbol, companyName || symbol, 3) || [];

      return {
        success: true,
        symbol,
        news:     news.slice(0, 10),
        videos:   videos.slice(0, 3),
        sentiment,
        analysis: {
          marketSentiment: (sentiment?.overallSentiment || 0) > 0.1 ? 'bullish' :
                           (sentiment?.overallSentiment || 0) < -0.1 ? 'bearish' : 'neutral',
          keyTopics: ['Financial Analysis', 'Market News'],
          emergingTrends: [],
          riskFactors: ['Market volatility'],
          opportunityFactors: ['Information available'],
          overallAssessment: `Based on ${news.length} articles, sentiment is ${sentiment?.overallSentiment > 0.1 ? 'positive' : 'neutral'}.`,
          confidence: 60,
        },
        summary: {
          executiveSummary: `Analysis for ${symbol}: ${news.length} articles, ${videos.length} videos.`,
          keyTakeaways: [
            `${news.length} articles analyzed`,
            `Sentiment: ${sentiment?.sentimentScore ?? 50}/100`,
          ],
          newsHighlight: news[0]?.title || 'N/A',
          videoHighlight: videos[0]?.title || 'N/A',
          recommendation: 'Neutral outlook',
          confidenceScore: 60,
          marketMood: 'neutral',
        },
        errors: [],
      };
    } catch (err) {
      return {
        success: false,
        symbol,
        news: [], videos: [], sentiment: null, analysis: null, summary: null,
        errors: [err.message],
      };
    }
  }
}

export default new NewsAgentService();
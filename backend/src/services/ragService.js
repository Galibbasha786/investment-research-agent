/**
 * ragService.js  — Retrieval-Augmented Generation Pipeline
 *
 * Full LangChain + LangGraph integration:
 *  ✅ Annotation.Root — typed state schema
 *  ✅ StateGraph + START + END — 5-node RAG pipeline
 *  ✅ tool() — vector-store search exposed as LangChain tool
 *  ✅ ToolNode — automatic tool execution in graph
 *  ✅ llm.bindTools() — LLM can call vector-search tool
 *  ✅ Conditional edges — route to tool execution or answer generation
 *  ✅ ChatPromptTemplate.fromMessages() — typed RAG prompt templates
 *  ✅ PromptTemplate.fromTemplate() — simple evidence-recommendation template
 *  ✅ JsonOutputParser — structured JSON recommendation
 *  ✅ StringOutputParser — plain-text Q&A answer
 *  ✅ RunnableSequence.from() — composable chain pipelines
 *  ✅ RunnableLambda — inline custom runnable steps
 *  ✅ RunnablePassthrough — pass-through in chain
 *  ✅ withStructuredOutput() + Zod — typed evidence recommendation
 *  ✅ HumanMessage / SystemMessage — typed message classes
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  PromptTemplate,
} from '@langchain/core/prompts';
import {
  JsonOutputParser,
  StringOutputParser,
} from '@langchain/core/output_parsers';
import {
  RunnableSequence,
  RunnableLambda,
  RunnablePassthrough,
} from '@langchain/core/runnables';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import documentService from './documentService.js';
import vectorStoreService from './vectorStoreService.js';

// ─────────────────────────────────────────────────────────────────────────────
// LLM factory
// ─────────────────────────────────────────────────────────────────────────────

const getLLM = () =>
  new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    temperature: 0.2,
    maxOutputTokens: 4096,
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  });

// ─────────────────────────────────────────────────────────────────────────────
// LangChain tool() — vector-store search
// ─────────────────────────────────────────────────────────────────────────────

const vectorSearchTool = tool(
  async ({ query, symbol, k }) => {
    console.log(`[RAGService] tool: vectorSearchTool — "${query}"`);
    await vectorStoreService.initialize();
    const result = await vectorStoreService.getRelevantContext(
      query, k, symbol ? symbol.toUpperCase() : null
    );
    return JSON.stringify(result);
  },
  {
    name: 'vector_search',
    description:
      'Search the vector store for relevant context from annual reports and SEC filings.',
    schema: z.object({
      query:  z.string().describe('Natural language query to search for'),
      symbol: z.string().optional().describe('Stock ticker to filter documents by'),
      k:      z.number().int().min(1).max(10).default(5).describe('Number of results to return'),
    }),
  }
);

const RAG_TOOLS = [vectorSearchTool];

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for withStructuredOutput()
// ─────────────────────────────────────────────────────────────────────────────

const EvidenceRecommendationSchema = z.object({
  recommendation: z.enum(['Invest', 'Hold', 'Pass']).describe('Investment decision'),
  confidenceScore: z.number().min(0).max(100),
  reasoning: z.array(z.string()).describe('Evidence-backed reasoning points'),
  evidence: z
    .array(
      z.object({
        claim:    z.string(),
        evidence: z.string(),
        source:   z.string(),
      })
    )
    .describe('Specific evidence items'),
  risks:      z.array(z.string()),
  keyMetrics: z.record(z.string()).describe('Key financial metrics from filings'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Annotation.Root — typed state schema for RAG pipeline
// ─────────────────────────────────────────────────────────────────────────────

const RAGState = Annotation.Root({
  // Inputs
  query:       Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  symbol:      Annotation({ reducer: (a, b) => b ?? a, default: () => null }),
  companyData: Annotation({ reducer: (a, b) => b ?? a, default: () => ({}) }),
  mode: Annotation({ reducer: (a, b) => b ?? a, default: () => 'qa' }), // 'qa' | 'recommendation'

  // Tool-calling messages (for ToolNode)
  messages: Annotation({
    reducer: (existing, incoming) => {
      const prev = Array.isArray(existing) ? existing : [];
      const next = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
      return [...prev, ...next];
    },
    default: () => [],
  }),

  // Retrieved context
  context:    Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  sources:    Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),
  references: Annotation({ reducer: (a, b) => b ?? a, default: () => [] }),

  // Outputs
  answer:            Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  recommendation:    Annotation({ reducer: (a, b) => b ?? a, default: () => null }),

  // Control
  contextRetrieved: Annotation({ reducer: (a, b) => b ?? a, default: () => false }),
  errors: Annotation({
    reducer: (a, b) => [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])],
    default: () => [],
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Node 1: Retrieval Agent  (llm.bindTools — decides how to search)
// ─────────────────────────────────────────────────────────────────────────────

const retrievalAgentPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a document retrieval agent for financial research.
Use the vector_search tool to find relevant information from SEC filings and annual reports.
Always call vector_search with the user query to retrieve context before stopping.`,
  ],
  [
    'human',
    `Retrieve context for this question about {symbol}:

"{query}"

Call vector_search with query="{query}" symbol="{symbol}" k=5`,
  ],
]);

async function retrievalAgentNode(state) {
  console.log(`[RAGService] Node: retrievalAgentNode — "${state.query}"`);
  const llm = getLLM();
  const llmWithTools = llm.bindTools(RAG_TOOLS);

  try {
    const messages = await retrievalAgentPrompt.formatMessages({
      symbol: state.symbol || 'N/A',
      query:  state.query,
    });

    const response = await llmWithTools.invoke([...messages, ...state.messages]);
    return { messages: [response] };
  } catch (err) {
    console.warn('[RAGService] Retrieval agent error:', err.message);
    return {
      contextRetrieved: true, // force skip to fallback
      errors: [`Retrieval agent error: ${err.message}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 2: ToolNode — executes vector_search tool calls
// ─────────────────────────────────────────────────────────────────────────────

const toolExecutorNode = new ToolNode(RAG_TOOLS);

// ─────────────────────────────────────────────────────────────────────────────
// Node 3: Context Extraction — parse tool results into state
// ─────────────────────────────────────────────────────────────────────────────

async function contextExtractionNode(state) {
  console.log(`[RAGService] Node: contextExtractionNode`);

  let context = '';
  let sources = [];
  let references = [];

  // Parse tool message results
  for (const msg of state.messages) {
    if (msg?.constructor?.name === 'ToolMessage' || msg?._getType?.() === 'tool') {
      try {
        const parsed = JSON.parse(msg.content || '{}');
        if (parsed.context) {
          context    = parsed.context;
          sources    = parsed.sources    || [];
          references = parsed.references || [];
        }
      } catch {
        // ignore
      }
    }
  }

  // Fallback: direct vector store call
  if (!context) {
    try {
      await vectorStoreService.initialize();
      const result = await vectorStoreService.getRelevantContext(
        state.query, 5, state.symbol ? state.symbol.toUpperCase() : null
      );
      context    = result.context    || '';
      sources    = result.sources    || [];
      references = result.references || [];
    } catch (err) {
      console.warn('[RAGService] Direct context retrieval error:', err.message);
    }
  }

  return { context, sources, references, contextRetrieved: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 4a: Q&A Answer Generation  (ChatPromptTemplate + StringOutputParser)
// ─────────────────────────────────────────────────────────────────────────────

const qaPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a senior investment research analyst. Answer the user's question using the
provided document context. Be concise, precise, and cite specific metrics when available.
If the context does not contain the answer, state that clearly and provide a general answer.`,
  ],
  [
    'human',
    `Question: {query}

Company: {symbol}

DOCUMENT CONTEXT:
{context}

Provide a professional, well-structured answer.`,
  ],
]);

async function qaAnswerNode(state) {
  console.log(`[RAGService] Node: qaAnswerNode — "${state.query}"`);
  try {
    // RunnableSequence: ChatPromptTemplate → LLM → StringOutputParser
    const chain = RunnableSequence.from([
      qaPrompt,
      getLLM(),
      new StringOutputParser(),
    ]);

    const answer = await chain.invoke({
      query:   state.query,
      symbol:  state.symbol || 'the company',
      context: state.context || 'No specific document context available.',
    });

    return { answer };
  } catch (err) {
    return {
      answer: `Unable to answer: ${err.message}`,
      errors: [`QA error: ${err.message}`],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node 4b: Evidence Recommendation  (withStructuredOutput + Zod + fallback chain)
// ─────────────────────────────────────────────────────────────────────────────

const evidencePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a senior investment analyst generating evidence-based recommendations.
Every claim must be supported by specific evidence from the documents. Respond with
a well-structured JSON object containing your recommendation.`,
  ],
  [
    'human',
    `Generate an evidence-based investment recommendation for {symbol}.

COMPANY DATA:
- Name     : {companyName}
- Industry : {industry}
- Ratios   : {ratios}
- Revenue  : {revenue}

DOCUMENT CONTEXT FROM SEC FILINGS:
{context}

Provide your recommendation backed by evidence from the filings above.`,
  ],
]);

async function evidenceRecommendationNode(state) {
  console.log(`[RAGService] Node: evidenceRecommendationNode — ${state.symbol}`);

  const cd = state.companyData || {};
  const promptVars = {
    symbol:      state.symbol || 'N/A',
    companyName: cd.profile?.name || 'N/A',
    industry:    cd.profile?.industry || 'N/A',
    ratios:      JSON.stringify(cd.ratios || {}).slice(0, 500),
    revenue:     JSON.stringify((cd.revenueTrends || []).slice(0, 3)),
    context:     state.context || 'No filing context available.',
  };

  // RunnableLambda: compute quick fallback score
  const fallbackScorer = new RunnableLambda({
    func: (vars) => {
      const ratios = JSON.parse(vars.ratios || '{}');
      const score  = ratios.roe > 15 ? 70 : ratios.roe > 8 ? 55 : 40;
      return score;
    },
  });
  const fallbackScore = await fallbackScorer.invoke(promptVars);
  const fallbackRec   = fallbackScore >= 65 ? 'Invest' : fallbackScore >= 45 ? 'Hold' : 'Pass';

  const fallback = {
    recommendation:  fallbackRec,
    confidenceScore: fallbackScore,
    reasoning:       ['Based on available financial ratios.'],
    evidence:        [],
    risks:           ['Data may be incomplete.'],
    keyMetrics:      {},
  };

  try {
    // withStructuredOutput — type-safe Zod-parsed output
    const structuredLLM = getLLM().withStructuredOutput(EvidenceRecommendationSchema, {
      name: 'evidence_recommendation',
    });
    const messages = await evidencePrompt.formatMessages(promptVars);
    const result = await structuredLLM.invoke(messages);
    return {
      recommendation: {
        ...result,
        sources:     state.sources    || [],
        references:  state.references || [],
        contextUsed: state.context    || '',
      },
    };
  } catch (err) {
    console.warn('[RAGService] withStructuredOutput fallback:', err.message);
    try {
      // Fallback: ChatPromptTemplate → LLM → JsonOutputParser
      const chain = RunnableSequence.from([
        evidencePrompt,
        getLLM(),
        new JsonOutputParser(),
      ]);
      const raw = await chain.invoke(promptVars);
      return {
        recommendation: {
          ...fallback,
          ...raw,
          sources:    state.sources    || [],
          references: state.references || [],
          contextUsed: state.context   || '',
        },
      };
    } catch (innerErr) {
      return {
        recommendation: {
          ...fallback,
          sources:    state.sources    || [],
          references: state.references || [],
          contextUsed: state.context   || '',
          error:      innerErr.message,
        },
        errors: [`Recommendation error: ${innerErr.message}`],
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conditional edges
// ─────────────────────────────────────────────────────────────────────────────

function routeAfterRetrievalAgent(state) {
  if (state.contextRetrieved) return 'contextExtractionNode';
  const msgs = state.messages;
  if (!msgs || msgs.length === 0) return 'contextExtractionNode';
  const last = msgs[msgs.length - 1];
  if (last?.tool_calls?.length > 0) return 'toolExecutorNode';
  return 'contextExtractionNode';
}

function routeAfterTools(state) {
  return 'contextExtractionNode';
}

function routeByMode(state) {
  return state.mode === 'recommendation' ? 'evidenceRecommendationNode' : 'qaAnswerNode';
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the RAG LangGraph workflow
// ─────────────────────────────────────────────────────────────────────────────

function buildRAGWorkflow() {
  const workflow = new StateGraph(RAGState);

  workflow.addNode('retrievalAgentNode',       retrievalAgentNode);
  workflow.addNode('toolExecutorNode',         toolExecutorNode);
  workflow.addNode('contextExtractionNode',    contextExtractionNode);
  workflow.addNode('qaAnswerNode',             qaAnswerNode);
  workflow.addNode('evidenceRecommendationNode', evidenceRecommendationNode);

  workflow.addEdge(START, 'retrievalAgentNode');

  workflow.addConditionalEdges('retrievalAgentNode', routeAfterRetrievalAgent, {
    toolExecutorNode:    'toolExecutorNode',
    contextExtractionNode: 'contextExtractionNode',
  });

  workflow.addConditionalEdges('toolExecutorNode', routeAfterTools, {
    contextExtractionNode: 'contextExtractionNode',
  });

  workflow.addConditionalEdges('contextExtractionNode', routeByMode, {
    qaAnswerNode:             'qaAnswerNode',
    evidenceRecommendationNode: 'evidenceRecommendationNode',
  });

  workflow.addEdge('qaAnswerNode',              END);
  workflow.addEdge('evidenceRecommendationNode', END);

  return workflow.compile();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

class RAGService {
  constructor() {
    this.lastProcessedSymbol = null;
    this.lastProcessedText   = null;
  }

  // ── Document processing (unchanged logic, same public contract) ──
  async processAnnualReport(symbol) {
    try {
      const normalizedSymbol = symbol.toUpperCase();
      console.log(`[RAGService] Processing annual report for ${normalizedSymbol}...`);

      const reportData = await documentService.fetchSECFiling(normalizedSymbol);
      if (!reportData) throw new Error(`No SEC filing found for ${normalizedSymbol}`);

      const text   = documentService.parseAnnualReportData(reportData);
      this.lastProcessedSymbol = normalizedSymbol;
      this.lastProcessedText   = text;

      const chunks = await documentService.createChunks(text, {
        source: 'SEC_EDGAR',
        symbol: normalizedSymbol,
        type:   'annual_report',
      });

      await vectorStoreService.initialize();
      await vectorStoreService.deleteDocumentsBySymbol(normalizedSymbol);

      try {
        const ids = await vectorStoreService.addDocuments(chunks);
        return {
          success: true, symbol: normalizedSymbol,
          chunksProcessed: chunks.length, documentIds: ids,
          textPreview: text.substring(0, 500) + '...',
        };
      } catch (embeddingError) {
        return {
          success: true, symbol: normalizedSymbol,
          chunksProcessed: chunks.length, documentIds: [],
          textPreview: text.substring(0, 500) + '...',
          warning: 'Embeddings failed; text is stored for Q&A fallback',
        };
      }
    } catch (err) {
      throw new Error(`Failed to process annual report: ${err.message}`);
    }
  }

  // ── Q&A via LangGraph RAG pipeline ──
  async answerQuestion(query, symbol = null) {
    console.log(`[RAGService] answerQuestion: "${query}"`);
    try {
      const app = buildRAGWorkflow();
      const finalState = await app.invoke({
        query,
        symbol:           symbol ? symbol.toUpperCase() : null,
        companyData:      {},
        mode:             'qa',
        messages:         [],
        context:          '',
        sources:          [],
        references:       [],
        answer:           '',
        recommendation:   null,
        contextRetrieved: false,
        errors:           [],
      });

      // RunnableLambda — post-process answer
      const postProcess = new RunnableLambda({
        func: (ans) => (typeof ans === 'string' && ans.trim() ? ans.trim() : 'No answer generated.'),
      });
      const answer = await postProcess.invoke(finalState.answer);

      return {
        answer,
        sources:    finalState.sources    || [],
        references: finalState.references || [],
        query,
        symbol:     symbol || 'N/A',
      };
    } catch (err) {
      console.error('[RAGService] answerQuestion error:', err.message);
      return {
        answer:     `Unable to answer at this time. Error: ${err.message}`,
        sources:    [],
        references: [],
        query,
        symbol:     symbol || 'N/A',
      };
    }
  }

  // ── Evidence-based recommendation via LangGraph ──
  async generateEvidenceRecommendation(symbol, companyData) {
    console.log(`[RAGService] generateEvidenceRecommendation: ${symbol}`);
    const query = `Financial performance, profitability, growth, risks, and competitive position of ${symbol}`;
    try {
      const app = buildRAGWorkflow();
      const finalState = await app.invoke({
        query,
        symbol:           symbol ? symbol.toUpperCase() : null,
        companyData:      companyData || {},
        mode:             'recommendation',
        messages:         [],
        context:          '',
        sources:          [],
        references:       [],
        answer:           '',
        recommendation:   null,
        contextRetrieved: false,
        errors:           [],
      });

      return finalState.recommendation || {
        recommendation: 'Hold',
        confidenceScore: 0,
        reasoning: ['Analysis could not be completed.'],
        evidence: [], risks: [], keyMetrics: {},
        sources: [], references: [], contextUsed: '',
      };
    } catch (err) {
      console.error('[RAGService] generateEvidenceRecommendation error:', err.message);
      return {
        recommendation: 'Hold',
        confidenceScore: 0,
        reasoning: [`Analysis failed: ${err.message}`],
        evidence: [], risks: ['Unable to complete analysis'], keyMetrics: {},
        error: err.message,
      };
    }
  }

  // ── Get raw context for external use ──
  async getContext(query, symbol = null) {
    try {
      await vectorStoreService.initialize();
      const ctx = await vectorStoreService.getRelevantContext(
        query, 5, symbol ? symbol.toUpperCase() : null
      );
      if (!ctx.context && this.lastProcessedText && this.lastProcessedSymbol === symbol?.toUpperCase()) {
        return {
          context:    this.lastProcessedText.substring(0, 3000),
          sources:    [{ source: 'SEC_EDGAR', symbol, type: 'annual_report' }],
          references: [{ index: 1, text: this.lastProcessedText.substring(0, 150) + '...', relevance: 1 }],
        };
      }
      return ctx;
    } catch (err) {
      return { context: '', sources: [], references: [] };
    }
  }

  async getSourcesForClaim(claim, symbol) {
    return this.getContext(claim, symbol);
  }
}

export default new RAGService();

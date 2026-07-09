import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

async function generateDocumentationPDF() {
  const rootDir = '/Users/syedgalibbasha/ai-investment-agent';
  const outputPath = path.join(rootDir, 'AI_Investment_Agent_Documentation.pdf');

  console.log(`Starting PDF generation at: ${outputPath}`);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });

  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // ---------------------------------------------------------
  // Helper functions for layouts and formatting
  // ---------------------------------------------------------
  const printTitle = (text) => {
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(26).text(text, { align: 'center' });
    doc.moveDown(1);
  };

  const printSubtitle = (text) => {
    doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(14).text(text, { align: 'center' });
    doc.moveDown(2);
  };

  const printHeading1 = (text) => {
    doc.moveDown(1.5);
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(18).text(text);
    doc.moveDown(0.5);
  };

  const printHeading2 = (text) => {
    doc.moveDown(1);
    doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(14).text(text);
    doc.moveDown(0.4);
  };

  const printHeading3 = (text) => {
    doc.moveDown(0.8);
    doc.fillColor('#b45309').font('Helvetica-Bold').fontSize(11).text(text);
    doc.moveDown(0.2);
  };

  const printBody = (text) => {
    doc.fillColor('#334155').font('Helvetica').fontSize(10).text(text, { align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);
  };

  const printBullet = (text) => {
    doc.fillColor('#334155').font('Helvetica').fontSize(10).text(`•  ${text}`, { indent: 15, align: 'left', lineGap: 2 });
    doc.moveDown(0.3);
  };

  const printCodeBlock = (code) => {
    doc.moveDown(0.3);
    const codeLines = code.split('\n');
    doc.fillColor('#1e293b');
    
    // Draw background block
    const startY = doc.y;
    // Estimate height
    const blockHeight = codeLines.length * 12 + 10;
    
    doc.rect(50, startY, 495, blockHeight).fill('#f1f5f9');
    
    doc.fillColor('#0f172a').font('Courier').fontSize(8.5);
    doc.y = startY + 5;
    
    for (const line of codeLines) {
      doc.text(line, 60, doc.y, { lineGap: 2 });
    }
    
    doc.font('Helvetica').fontSize(10);
    doc.x = 50; // Restore margin
    doc.moveDown(1);
  };

  // ---------------------------------------------------------
  // COVER PAGE
  // ---------------------------------------------------------
  printTitle('AI INVESTMENT RESEARCH AGENT');
  printSubtitle('Comprehensive System Architecture, Design Workflows, and Technical Code Walkthrough');
  
  doc.moveDown(4);
  doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('Prepared For:', { align: 'center' });
  doc.font('Helvetica').fontSize(12).text('System Evaluation & Quality Assurance', { align: 'center' });
  doc.moveDown(1);
  doc.font('Helvetica-Bold').text('Framework Integration Stack:', { align: 'center' });
  doc.font('Helvetica').text('LangChain Core v1.2+, LangGraph Node & Edge Framework v1.4+, Gemini 1.5 Pro & Flash LLM Services', { align: 'center' });
  doc.moveDown(2);
  doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'center' });
  
  doc.addPage();

  // ---------------------------------------------------------
  // SECTION 1: EXECUTIVE SYSTEM ARCHITECTURE
  // ---------------------------------------------------------
  printHeading1('1. System Architecture Overview');
  printBody(
    'The AI Investment Research Agent is a multi-agent system built on top of LangChain and LangGraph ' +
    'designed to analyze financial reports (SEC EDGAR filings), real-time financial market news, YouTube market reports, ' +
    'and financial health ratios. The system orchestrates these flows using StateGraphs to guarantee deterministic execution, ' +
    'safety guardrails, structured JSON outputs, and conditional retry flows.'
  );

  printHeading2('System Flowchart & Information Stream');
  printBullet('Ingestion Stage: Uses documentService to fetch SEC EDGAR 10-K filings, parses the textual report content, splits it using LangChain RecursiveCharacterTextSplitter, and adds it to the vectorStoreService.');
  printBullet('Vector Store Stage: Embeds parsed chunks via GoogleGenerativeAIEmbeddings and loads them into a LangChain VectorStore-compliant in-memory database.');
  printBullet('Agents Aggregator (NewsAgentService): Uses LangGraph StateGraph, ToolNode, and Zod Structured Outputs to fetch and synthesize real-time news articles (via newsService) and YouTube analytical video transcripts (via youtubeService).');
  printBullet('Advanced Agent Stage (AdvancedAgentService): A deep multi-node StateGraph that calculates financial health, growth trends, profit margins, stock valuation scores, and risk profiles. Includes a conditional retry mechanism for low confidence results.');
  printBullet('RAG Q&A Engine (RAGService): A stateful LangGraph retrieval QA chain that allows users to ask questions about processed reports and returns answers complete with sources and references.');

  doc.addPage();

  // ---------------------------------------------------------
  // SECTION 2: VECTOR STORE & EMBEDDINGS
  // ---------------------------------------------------------
  printHeading1('2. Vector Store & Embeddings Integration');
  printBody(
    'File: src/services/vectorStoreService.js\n\n' +
    'Instead of hand-rolling database storage, the VectorStoreService subclasses the base VectorStore class from ' +
    '@langchain/core/vectorstores, making it native to the LangChain ecosystem. This enables compatibility with ' +
    'pre-built LangChain retriever sequences and tool chains.'
  );

  printHeading2('Key Syntax & API Implementation');
  printCodeBlock(
`import { VectorStore } from '@langchain/core/vectorstores';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

class LangChainInMemoryVectorStore extends VectorStore {
  // Overrides the base class methods to store vectors in memory
  async addVectors(vectors, documents, options) { ... }
  async similaritySearchVectorWithScore(queryVector, k, filter) { ... }
}`
  );

  printBody(
    'We use the GoogleGenerativeAIEmbeddings class initialized with the "embedding-001" model for generating document and query ' +
    'embeddings. We also export a LangChain text splitter using:'
  );
  printCodeBlock(
`import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
export const createTextSplitter = (chunkSize, chunkOverlap) =>
  new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });`
  );

  doc.addPage();

  // ---------------------------------------------------------
  // SECTION 3: STATE GRAPH IMPLEMENTATION (NEWS AGENT)
  // ---------------------------------------------------------
  printHeading1('3. Stateful Workflows — NewsAgentService');
  printBody(
    'File: src/services/newsAgentService.js\n\n' +
    'The NewsAgentService constructs a StateGraph containing 6 distinct nodes. It coordinates tool calling ' +
    'to aggregate, score, analyze, and summarize market news and video signals.'
  );

  printHeading2('Workflow Nodes & Structure');
  printBullet('dataFetchingAgentNode: Employs Gemini to decide which tool to execute (fetch_news or fetch_videos) by checking state message history.');
  printBullet('toolExecutorNode: A pre-built LangGraph ToolNode that executes registered tools and feeds results back to the graph.');
  printBullet('dataExtractionNode: Normalizes raw outputs from ToolMessages and writes them to final variables in the Graph State.');
  printBullet('combinedAnalysisNode: Processes summarized transcripts and headlines, executing a ChatPromptTemplate to output structured market sentiment indicators.');
  printBullet('macroNarrativeNode: Produces a 2-3 sentence macro outlook paragraph using PromptTemplate and StringOutputParser.');
  printBullet('executiveSummaryNode: Utilizes LLM.withStructuredOutput() bound to a Zod schema to compile the final formatted analysis.');

  printHeading3('LangGraph State Initialization Example');
  printCodeBlock(
`import { Annotation, StateGraph, START, END } from '@langchain/langgraph';

const NewsAnalysisState = Annotation.Root({
  symbol: Annotation({ reducer: (a, b) => b ?? a }),
  messages: Annotation({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => []
  }),
  news: Annotation({ reducer: (a, b) => b ?? a }),
  summary: Annotation({ reducer: (a, b) => b ?? a })
});`
  );

  doc.addPage();

  // ---------------------------------------------------------
  // SECTION 4: ADVANCED AGENT & RETRY FLOWS
  // ---------------------------------------------------------
  printHeading1('4. Multi-Agent Workflows — AdvancedAgentService');
  printBody(
    'File: src/services/advancedAgentService.js\n\n' +
    'The Advanced Agent workflow computes 5 financial scores (Financial Health, Growth, Profitability, ' +
    'Valuation, and Risk) using Zod-validated tools. It implements a conditional retry loop if ' +
    'the final recommendation confidence is less than 35%.'
  );

  printHeading2('Advanced Agent Node Layout');
  printBullet('financialScoringNode: Parallel execution of 5 tools using Tool.invoke() to fetch preliminary scoring metrics.');
  printBullet('newsGatheringNode: Gathers recent company news articles to feed the sentiment engine.');
  printBullet('sentimentAnalysisNode: An independent ChatPromptTemplate and JsonOutputParser sequence resolving market bias.');
  printBullet('macroContextNode: Generates a sectoral industry analysis.');
  printBullet('aiDeepDiveNode: An agent node that calls tools to resolve data anomalies.');
  printBullet('toolExecutorNode: ToolNode that executes intermediate quantitative calls.');
  printBullet('recommendationNode: Employs ChatPromptTemplate + withStructuredOutput(ZodSchema) to produce final structured output.');
  printBullet('retryNode: Increments retry counter and clears previous message buffers for a fresh pass.');

  printHeading3('Conditional Edge Definition & Code');
  printCodeBlock(
`function routeAfterRecommendation(state) {
  const confidence = state.recommendation?.confidenceScore ?? 100;
  const retryCount = state.retryCount ?? 0;

  if (confidence < 35 && retryCount < 2) {
    return 'retryNode';
  }
  return 'finalOutputNode';
}`
  );

  doc.addPage();

  // ---------------------------------------------------------
  // SECTION 5: STATEFUL RAG SERVICE
  // ---------------------------------------------------------
  printHeading1('5. Retrieval-Augmented Generation — RAGService');
  printBody(
    'File: src/services/ragService.js\n\n' +
    'The RAGService implements a modular retrieval workflow. It uses a LangGraph to find matching vectors ' +
    'and generate responses based on the selected mode: simple Q&A (qa) or evidence-based report creation (recommendation).'
  );

  printHeading2('RAG Workflow Graph Map');
  printBullet('retrievalAgentNode: Resolves key semantic queries and calls the vector_search tool.');
  printBullet('toolExecutorNode: The vectorStoreService search executor.');
  printBullet('contextExtractionNode: Collects document snippets, calculates matching distances, and assigns sources.');
  printBullet('qaAnswerNode: Resolves simple user questions using a StringOutputParser.');
  printBullet('evidenceRecommendationNode: Feeds financial figures, balance sheet highlights, and vector snippets into a structured recommendation engine powered by withStructuredOutput.');

  printHeading3('RAG State & Compile Code');
  printCodeBlock(
`const workflow = new StateGraph(RAGState);

workflow.addNode('retrievalAgentNode', retrievalAgentNode);
workflow.addNode('toolExecutorNode', toolExecutorNode);
workflow.addNode('contextExtractionNode', contextExtractionNode);
workflow.addNode('qaAnswerNode', qaAnswerNode);
workflow.addNode('evidenceRecommendationNode', evidenceRecommendationNode);

workflow.addEdge(START, 'retrievalAgentNode');
workflow.compile();`
  );

  printHeading2('Conclusion & Standards Alignment');
  printBody(
    'By standardizing on LangChain and LangGraph core libraries, the system ensures type safety ' +
    'across all agent nodes and state reducers. This design architecture eliminates parsing bugs, ' +
    'standardizes error handling, and enables deep analytical capabilities for financial markets research.'
  );

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log('PDF Generation complete.');
      resolve(outputPath);
    });
    writeStream.on('error', (err) => {
      console.error('PDF Generation stream error:', err);
      reject(err);
    });
  });
}

// Execute the generator
generateDocumentationPDF().then((p) => {
  console.log(`Success! File written at ${p}`);
}).catch((e) => {
  console.error('Execution failure:', e);
});

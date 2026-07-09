import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

async function generateDocumentationPDF() {
  const rootDir = '/Users/syedgalibbasha/ai-investment-agent';
  const outputPath = path.join(rootDir, 'AI_Investment_Agent_Interview_Masterclass.pdf');

  console.log(`Starting PDF generation at: ${outputPath}`);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });

  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Helper formatting functions
  const printTitle = (text) => {
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(24).text(text, { align: 'center' });
    doc.moveDown(1);
  };

  const printSubtitle = (text) => {
    doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(12).text(text, { align: 'center' });
    doc.moveDown(2);
  };

  const printHeading1 = (text) => {
    doc.moveDown(1.5);
    doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(16).text(text);
    doc.moveDown(0.5);
  };

  const printHeading2 = (text) => {
    doc.moveDown(1);
    doc.fillColor('#0f766e').font('Helvetica-Bold').fontSize(12).text(text);
    doc.moveDown(0.4);
  };

  const printBody = (text) => {
    doc.fillColor('#334155').font('Helvetica').fontSize(9.5).text(text, { align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);
  };

  const printBullet = (text) => {
    doc.fillColor('#334155').font('Helvetica').fontSize(9.5).text(`•  ${text}`, { indent: 15, align: 'left', lineGap: 2 });
    doc.moveDown(0.3);
  };

  const printCodeBlock = (code) => {
    doc.moveDown(0.3);
    const codeLines = code.split('\n');
    doc.fillColor('#1e293b');
    
    const startY = doc.y;
    const blockHeight = codeLines.length * 11 + 10;
    
    doc.rect(50, startY, 495, blockHeight).fill('#f8fafc');
    
    doc.fillColor('#0f172a').font('Courier').fontSize(8);
    doc.y = startY + 5;
    
    for (const line of codeLines) {
      doc.text(line, 60, doc.y, { lineGap: 1.5 });
    }
    
    doc.font('Helvetica').fontSize(9.5);
    doc.x = 50; 
    doc.moveDown(1);
  };

  // COVER PAGE
  printTitle('AI INVESTMENT RESEARCH AGENT');
  printSubtitle('Interview Preparation & Core Architecture Manual');
  doc.moveDown(4);
  
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('Table of Contents:', 50, doc.y);
  doc.moveDown(0.5);
  printBullet('1. System Architecture Overview (The Big Picture)');
  printBullet('2. Core Files & Services Analysis (Backend Code Walkthrough)');
  printBullet('3. LangChain & LangGraph Syntax Deep Dive (Line-by-Line explanations)');
  printBullet('4. Frontend Design & UI Integration Structure');
  printBullet('5. Key Design Patterns, Challenges, & Interview Answer Strategies');
  
  doc.addPage();

  // SECTION 1
  printHeading1('1. System Architecture Overview');
  printBody(
    'This project is a multi-agent system designed for automated equity research. ' +
    'It ingests SEC filings, aggregates news and social media sentiment, computes corporate scoring, ' +
    'and runs a Retrieval-Augmented Generation (RAG) query engine to answer analytical questions. ' +
    'Every pipeline is orchestrated by LangGraph StateGraphs, which replaced the previous ad-hoc chains ' +
    'to provide deterministic flow control, state tracking, and clear runtime isolation.'
  );
  printBullet('Ingestion Stream: Fetches 10-K filings from SEC EDGAR API, parses them, splits text using RecursiveCharacterTextSplitter, and indexes them.');
  printBullet('Vector Store Stream: Houses embedded chunks using GoogleGenerativeAIEmbeddings inside a custom InMemory VectorStore extending the base @langchain/core class.');
  printBullet('Stateful Agents: Separate Graphs for News Analysis, Core Investment Calculations, and RAG Q&A.');

  // SECTION 2
  printHeading1('2. Core Files & Backend Code Walkthrough');
  printHeading2('A. advancedAgentService.js (Quantitative Analysis Graph)');
  printBody(
    'This is an 8-node state machine that manages corporate scoring. It triggers five parallel LangChain tools ' +
    'to calculate financial health, growth, profit, risk, and valuation. It has a built-in agentic retry node ' +
    'that loops back to the LLM if final confidence falls below 35%.'
  );

  printHeading2('B. newsAgentService.js (Market Sentiment & Signals)');
  printBody(
    'A 6-node Graph that coordinates data collection. It binds a ToolNode exposing news and video fetching operations. ' +
    'It then processes the retrieved texts via ChatPromptTemplates combined with JsonOutputParser, ' +
    'and ends with a Zod-enforced structured executive summary.'
  );

  printHeading2('C. ragService.js (Stateful Report Q&A)');
  printBody(
    'A 5-node Graph mapping the classic retrieval flow. Instead of simple chains, it models retrieval as a StateGraph: ' +
    'Node 1 acts as a retrieval agent identifying semantic parameters, Node 2 runs vector search, Node 3 extracts context and sources, ' +
    'and Node 4 generates answers (Q&A mode) or files structured tables (Recommendation mode).'
  );

  printHeading2('D. vectorStoreService.js (Subclassed Retrieval Store)');
  printBody(
    'Inherits from @langchain/core/vectorstores. Rather than importing third-party libraries, we implement a ' +
    'custom VectorStore class that handles text indexing, cosine similarity scoring, and metadata filtering ' +
    'directly in JS, ensuring complete ecosystem type-safety.'
  );

  doc.addPage();

  // SECTION 3
  printHeading1('3. LangChain & LangGraph Syntax Deep Dive');
  printBody('Here is the syntax breakdown you need to explain during technical interviews:');

  printHeading2('A. Annotation.Root (Type-Safe State Definition)');
  printBody('Replaces legacy StateGraph channel-based definitions. Defines state structure and reducer behaviors:');
  printCodeBlock(
`const NewsAnalysisState = Annotation.Root({
  symbol: Annotation({ reducer: (a, b) => b ?? a, default: () => '' }),
  messages: Annotation({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => []
  })
});`
  );

  printHeading2('B. tool() with Zod Schema Validation');
  printBody('Declares structured arguments that the LLM can resolve and invoke:');
  printCodeBlock(
`const financialHealthTool = tool(
  async ({ ratios }) => { ... },
  {
    name: 'financial_health_analysis',
    description: 'Calculate financial health scores.',
    schema: z.object({ ratios: z.object({ pe: z.number() }) })
  }
);`
  );

  printHeading2('C. llm.bindTools() and ToolNode');
  printBody('Exposes tools directly to the model. The model outputs a tool_call array, which the prebuilt ToolNode executes:');
  printCodeBlock(
`const llmWithTools = llm.bindTools([myTool]);
const toolExecutorNode = new ToolNode([myTool]);`
  );

  printHeading2('D. withStructuredOutput() for Deterministic Output');
  printBody('Forces the LLM to output structured JSON matching a Zod schema, resolving parsing errors:');
  printCodeBlock(
`const structuredLLM = llm.withStructuredOutput(ZodSchema, {
  name: 'output_format'
});`
  );

  doc.addPage();

  // SECTION 4
  printHeading1('4. Frontend Design & UI Integration');
  printBody(
    'The frontend is built using React (Vite). The user interfaces (such as AdvancedAnalysis.jsx) are structured ' +
    'to communicate with endpoints like /api/advanced-analysis. When the frontend sends a company symbol, the backend ' +
    'invokes the Advanced Analysis LangGraph. Because the final output matches our strict Zod schemas, the frontend ' +
    'receives a clean, consistent JSON payload representing recommendations, scores, and risks, which it renders ' +
    'directly to the user interface.'
  );

  // SECTION 5
  printHeading1('5. Key Design Patterns & Interview Q&A Strategies');
  
  printHeading2('Q: Why did you use LangGraph instead of simple LangChain sequences?');
  printBody(
    'A: Simple chains (like RunnableSequence) are linear and cannot handle feedback loops, parallel tool execution, or ' +
    'stateful persistence. LangGraph allows us to define nodes as distinct actions, manage state updates using explicit ' +
    'reducers, and route executions dynamically using conditional edges (for example, triggering retries when output confidence is too low).'
  );

  printHeading2('Q: How did you implement vector storage and embedding generation?');
  printBody(
    'A: I subclassed the VectorStore base class from @langchain/core. This allowed me to override addVectors() and ' +
    'similaritySearchVectorWithScore() while retaining compatibility with other LangChain components. I utilized ' +
    'GoogleGenerativeAIEmbeddings for generating text vectors, and RecursiveCharacterTextSplitter for document chunking.'
  );

  printHeading2('Q: How does the retry mechanism work in the Advanced Analysis pipeline?');
  printBody(
    'A: After the recommendationNode generates a decision, a conditional edge inspects the confidence score. ' +
    'If the score is below 35% and we have not exceeded the retry limit, the graph routes the flow to a retryNode ' +
    'which increments the retry counter, clears intermediate message buffers, and sends the execution back to the ' +
    'aiDeepDiveNode to collect more data using tool calling.'
  );

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log('PDF Generation complete.');
      resolve(outputPath);
    });
    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}

generateDocumentationPDF().then((p) => {
  console.log(`Success! File written at ${p}`);
}).catch((e) => {
  console.error('Execution failure:', e);
});

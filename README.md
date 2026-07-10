# AI Investment Research Agent

An advanced, multi-agent financial equity research platform powered by **LangChain**, **LangGraph**, and **Google Gemini (1.5 Pro & Flash)** models. The platform automates the ingestion of SEC EDGAR annual reports (10-K), aggregates market news & video reports, computes dynamic corporate health scoring, and provides a conversational RAG Q&A interface.

---

## 1. Overview
The **AI Investment Research Agent** is a professional-grade stock analysis system that replaces basic keyword matching and simple linear LLM pipelines with **Stateful Agent Graphs**. 
* **SEC 10-K Ingestion**: Automatically pulls, parses, and splits corporate annual filings.
* **Semantic Vector Indexing**: Creates a vectorized context store utilizing `GoogleGenerativeAIEmbeddings` inside a LangChain-native `VectorStore` structure.
* **Sentiment & Signal Aggregator**: Harnesses LangGraph workflows to analyze real-time market articles and video updates.
* **Quantitative Corporate Scoring**: Employs mathematical formula-driven scoring engines validated by LLM agents.
* **Stateful Q&A (RAG)**: Offers an evidence-backed answering system that traces responses directly back to sourced snippets in annual reports.

---

## 2. How to Run It

### System Prerequisites
* **Node.js**: v18.x or higher
* **MongoDB**: A running MongoDB instance (Local or MongoDB Atlas)
* **API Keys**: Google Gemini API Key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5001
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/ai-investment-agent
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-1.5-flash
   EMBEDDING_MODEL=embedding-001
   JWT_SECRET=your_jwt_signature_secret_key
   FRONTEND_URL=http://localhost:5173
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend/` directory (optional for local run, as it defaults to port 5001):
   ```env
   VITE_API_URL=http://localhost:5001
   ```
4. Start the frontend Vite application:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:5173`.

---

## 3. How It Works (Approach & Architecture)

The platform is designed around **isolated state containers** and **deterministic execution graphs** built using LangGraph's new state annotations. 

```
                                    +-----------------------+
                                    |     User Interface    |
                                    +-----------+-----------+
                                                |
                       +------------------------+-----------------------+
                       v                                                v
           +-----------+-----------+                        +-----------+-----------+
           |   AdvancedAgent (Graph)|                        |    RAGService (Graph)  |
           +-----------+-----------+                        +-----------+-----------+
                       |                                                |
        +--------------+--------------+                  +--------------+--------------+
        v                             v                  v                             v
  [Scoring Node]             [Sentiment Node]      [Retrieval Node]              [Generator Node]
  Calculates ratios          Aggregates news       Queries local                 Generates evidence-
  and growth metrics         & YouTube videos      VectorStore                   backed analysis
```

### Flow Workflows
1. **Advanced Analysis (`advancedAgentService.js`)**: Runs an 8-node LangGraph that executes quantitative tools, checks output confidence, and runs an agentic retry node if confidence falls below 35%.
2. **Sentiment Engine (`newsAgentService.js`)**: Executes a tool-calling graph to collect news and YouTube videos, maps them into structured sentiments, and formats an executive summary using Zod-driven structured LLM outputs.
3. **Retrieval-Augmented Generation (`ragService.js`)**: Houses a stateful 5-node graph that queries the vector database, cleans metadata, scores document distance, and outputs answers citing sources.
4. **Subclassed Vector Storage (`vectorStoreService.js`)**: Extends LangChain's base `VectorStore` class to handle native operations (similarity search, indexing, formatting) inline, eliminating external DB dependencies.

---

## 4. Key Decisions & Trade-Offs

### Decisions Chosen
* **Extending LangChain's VectorStore Base Class**: Instead of importing heavy external database engines, we subclassed `@langchain/core/vectorstores`. This ensures type safety and integration with LangChain's `similaritySearchVectorWithScore` api, keeping the database in-memory for speed.
* **LangGraph `Annotation.Root` State Schema**: Migrated from old legacy channel-based dictionaries to robust `Annotation.Root` schemas. This enforces strict property typing and defines exact state reducer mergers.
* **LLM Tool Binding**: Enabled parallel tool invocation via `llm.bindTools()` and pre-built `ToolNode`. The agent is free to determine search parameters, yet operates inside a structured graph.

### Left Out / Deferred
* **Persistent Vector Databases (e.g. Chroma/Pinecone)**: Kept in-memory to keep deployment on Render lightweight and avoid cloud database maintenance costs.
* **Recursive LLM Summaries**: Currently, annual report texts are chunked and analyzed semantically instead of summarized recursively to fit within standard API rate limits.

---

## 5. Example Runs

### Example 1: Apple Inc. (AAPL) Analysis
* **Financial Health**: 85/100 (Strong current ratio, massive ROE).
* **Sentiment**: Bearish (Short-term regulatory headwinds and antitrust concerns).
* **Recommendation**: Hold
* **Reasoning**:
  1. Operating efficiency remains dominant with ROE exceeding 150%.
  2. Revenue growth has flattened to 1.5% YoY.
  3. Valuation (P/E ~ 31) remains high relative to current low-growth signals.

### Example 2: Microsoft Corporation (MSFT) Analysis
* **Financial Health**: 90/100 (Exceptional balance sheet, strong liquidity).
* **Sentiment**: Bullish (Strong commercial cloud momentum, AI cloud integrations).
* **Recommendation**: Invest
* **Reasoning**:
  1. Steady revenue growth above 15% YoY.
  2. Azure cloud infrastructure showing double-digit gains.
  3. Stable leverage profile (Debt-to-Equity < 0.6).

---

## 6. What We Would Improve With More Time
* **Persistent Vector Storage**: Migrate `vectorStoreService.js` to PostgreSQL using pgvector or MongoDB Atlas Vector Search.
* **Chunking Strategies**: Implement semantic chunking instead of simple character counts to preserve sentence integrity.
* **Live Streaming Node Updates**: Stream LangGraph node state updates to the frontend via Server-Sent Events (SSE) or WebSockets for better UI loading feedback.

---
/**
 * vectorStoreService.js
 *
 * Full LangChain integration:
 *  ✅ VectorStore (from @langchain/core/vectorstores) — extends LangChain base VectorStore
 *  ✅ GoogleGenerativeAIEmbeddings — LangChain embeddings class
 *  ✅ RecursiveCharacterTextSplitter — LangChain text splitter
 *  ✅ Document — LangChain document class
 *  ✅ RunnableSequence — composable retrieval chain
 *  ✅ RunnableLambda — inline retrieval runnable steps
 *  ✅ StringOutputParser — extract plain text from docs
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { VectorStore } from '@langchain/core/vectorstores';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { RunnableSequence, RunnableLambda } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// Custom LangChain-compatible InMemoryVectorStore
// Extends VectorStore from @langchain/core — making it a fully LangChain VectorStore
// ─────────────────────────────────────────────────────────────────────────────

class LangChainInMemoryVectorStore extends VectorStore {
  _vectorstoreType() { return 'in_memory'; }

  constructor(embeddings) {
    super(embeddings, {});
    this.memoryVectors = []; // { id, embedding, document, metadata }
  }

  // Required by VectorStore — add documents with embeddings
  async addVectors(vectors, documents, options = {}) {
    const ids = options.ids || documents.map(() => uuidv4());
    vectors.forEach((vec, i) => {
      this.memoryVectors.push({
        id:        ids[i],
        embedding: vec,
        content:   documents[i].pageContent,
        metadata:  documents[i].metadata,
      });
    });
    return ids;
  }

  // Required by VectorStore — add documents (auto-embeds)
  async addDocuments(documents, options = {}) {
    const texts = documents.map(d => d.pageContent);
    let vectors;
    try {
      vectors = await this.embeddings.embedDocuments(texts);
    } catch (err) {
      console.warn('[VectorStore] Embedding failed, using fallback zeros:', err.message);
      vectors = texts.map(() => new Array(768).fill(0.01));
    }
    return this.addVectors(vectors, documents, options);
  }

  // Required by VectorStore — similarity search with score
  async similaritySearchVectorWithScore(queryVector, k, filter) {
    let candidates = this.memoryVectors;
    if (filter) {
      candidates = candidates.filter(v => filter(new Document({ pageContent: v.content, metadata: v.metadata })));
    }

    const scored = candidates.map(v => ({
      score: this._cosineSimilarity(queryVector, v.embedding),
      doc:   new Document({ pageContent: v.content, metadata: v.metadata }),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(s => [s.doc, s.score]);
  }

  // Helper
  _cosineSimilarity(a, b) {
    if (!a?.length || !b?.length || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  // Static factory (LangChain convention)
  static async fromTexts(texts, metadatas, embeddings) {
    const store = new LangChainInMemoryVectorStore(embeddings);
    const docs  = texts.map((t, i) => new Document({ pageContent: t, metadata: metadatas[i] || {} }));
    await store.addDocuments(docs);
    return store;
  }

  static async fromDocuments(documents, embeddings) {
    const store = new LangChainInMemoryVectorStore(embeddings);
    await store.addDocuments(documents);
    return store;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Text splitter factory
// ─────────────────────────────────────────────────────────────────────────────

export const createTextSplitter = (chunkSize = 1000, chunkOverlap = 200) =>
  new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });

// ─────────────────────────────────────────────────────────────────────────────
// VectorStoreService
// ─────────────────────────────────────────────────────────────────────────────

class VectorStoreService {
  constructor() {
    this.vectorStore  = null;
    this.embeddings   = null;
    this.initialized  = false;
    this.docSymbolMap = new Map(); // id → symbol
  }

  // ── Initialize ──────────────────────────────────────────────────────────────

  async initialize() {
    if (this.initialized && this.vectorStore) return this;

    try {
      // LangChain GoogleGenerativeAIEmbeddings
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        model:      process.env.EMBEDDING_MODEL || 'embedding-001',
        apiKey:     process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        apiVersion: 'v1beta',
      });

      // LangChain-compatible VectorStore (extends @langchain/core VectorStore)
      this.vectorStore = new LangChainInMemoryVectorStore(this.embeddings);

      console.log('[VectorStore] LangChain InMemoryVectorStore (extends VectorStore) initialized');
      this.initialized = true;
    } catch (err) {
      console.error('[VectorStore] Init error:', err.message);
      this.vectorStore = new LangChainInMemoryVectorStore({ embedDocuments: async (t) => t.map(() => new Array(768).fill(0.01)), embedQuery: async () => new Array(768).fill(0.01) });
      this.initialized = true;
    }
    return this;
  }

  // ── Add Documents ─────────────────────────────────────────────────────────

  async addDocuments(documents) {
    if (!this.initialized) await this.initialize();

    const langchainDocs = documents.map(doc => {
      const id = uuidv4();
      this.docSymbolMap.set(id, doc.metadata?.symbol);
      return new Document({
        pageContent: doc.pageContent || '',
        metadata:    { ...doc.metadata, _id: id },
      });
    });

    try {
      const ids = await this.vectorStore.addDocuments(langchainDocs);
      console.log(`[VectorStore] Added ${langchainDocs.length} LangChain Documents`);
      return ids || langchainDocs.map(d => d.metadata._id);
    } catch (err) {
      console.error('[VectorStore] addDocuments error:', err.message);
      throw err;
    }
  }

  // ── Similarity Search ─────────────────────────────────────────────────────

  async search(query, k = 5, symbol = null) {
    if (!this.initialized) await this.initialize();

    try {
      let queryEmbedding;
      try {
        queryEmbedding = await this.embeddings.embedQuery(query);
      } catch {
        queryEmbedding = new Array(768).fill(0.01);
      }

      const filter = symbol
        ? (doc) => doc.metadata?.symbol === symbol.toUpperCase()
        : undefined;

      const results = await this.vectorStore.similaritySearchVectorWithScore(
        queryEmbedding, k, filter
      );

      return {
        documents: [results.map(([doc]) => doc.pageContent)],
        metadatas: [results.map(([doc]) => doc.metadata)],
        distances: [results.map(([, score]) => 1 - score)],
      };
    } catch (err) {
      console.error('[VectorStore] search error:', err.message);
      return { documents: [[]], metadatas: [[]], distances: [[]] };
    }
  }

  // ── Get Relevant Context — RunnableSequence pipeline ──────────────────────

  async getRelevantContext(query, k = 5, symbol = null) {
    if (!this.initialized) await this.initialize();

    // RunnableLambda: perform the vector search
    const searchStep = new RunnableLambda({
      func: async (input) => this.search(input.query, input.k, input.symbol),
    });

    // RunnableLambda: extract context string from search results
    const contextStep = new RunnableLambda({
      func: (searchResult) => {
        const docs = searchResult?.documents?.[0] || [];
        return docs.join('\n\n');
      },
    });

    // RunnableSequence: search → format context
    const contextChain = RunnableSequence.from([searchStep, contextStep]);

    try {
      const context = await contextChain.invoke({ query, k, symbol });
      if (!context) return { context: '', sources: [], references: [] };

      // Fetch metadata for sources separately
      const rawResults = await this.search(query, k, symbol);
      const sources = (rawResults.metadatas?.[0] || []).map(m => ({
        source:  m.source  || 'Unknown',
        symbol:  m.symbol  || 'N/A',
        type:    m.type    || 'document',
        snippet: m.snippet || '',
      }));
      const references = (rawResults.documents?.[0] || []).map((doc, i) => ({
        index:     i + 1,
        text:      doc.substring(0, 150) + '...',
        relevance: rawResults.distances?.[0]?.[i] ?? 0,
      }));

      return { context, sources, references };
    } catch (err) {
      console.error('[VectorStore] getRelevantContext error:', err.message);
      return { context: '', sources: [], references: [] };
    }
  }

  // ── Split Text — LangChain RecursiveCharacterTextSplitter ─────────────────

  async splitText(text, metadata = {}, chunkSize = 1000, chunkOverlap = 200) {
    const splitter = createTextSplitter(chunkSize, chunkOverlap);
    return splitter.createDocuments([text], [metadata]);
  }

  // ── Delete by Symbol ───────────────────────────────────────────────────────

  async deleteDocumentsBySymbol(symbol) {
    if (!this.initialized) await this.initialize();
    const upperSymbol = symbol.toUpperCase();
    this.vectorStore.memoryVectors = (this.vectorStore.memoryVectors || []).filter(
      v => v.metadata?.symbol !== upperSymbol
    );
    console.log(`[VectorStore] Cleared docs for ${upperSymbol}`);
  }

  // ── Count & Clear ──────────────────────────────────────────────────────────

  async getDocumentCount() {
    if (!this.initialized) await this.initialize();
    return this.vectorStore.memoryVectors?.length ?? 0;
  }

  async clearAll() {
    if (!this.initialized) await this.initialize();
    this.vectorStore.memoryVectors = [];
    this.docSymbolMap.clear();
    console.log('[VectorStore] Cleared all documents');
  }
}

export default new VectorStoreService();

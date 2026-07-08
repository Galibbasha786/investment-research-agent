import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { v4 as uuidv4 } from 'uuid';

// In-memory vector store
class InMemoryVectorStore {
  constructor() {
    this.documents = [];
    this.embeddings = [];
    this.metadatas = [];
    this.ids = [];
  }

  async add({ ids, embeddings, metadatas, documents }) {
    this.ids.push(...ids);
    this.embeddings.push(...embeddings);
    this.metadatas.push(...metadatas);
    this.documents.push(...documents);
  }

  async query({ queryEmbeddings, nResults, where = null }) {
    const results = [];
    for (let i = 0; i < this.embeddings.length; i++) {
      if (where) {
        const matchesFilter = Object.entries(where).every(([key, value]) => this.metadatas[i]?.[key] === value);
        if (!matchesFilter) {
          continue;
        }
      }

      const similarity = this.cosineSimilarity(queryEmbeddings[0], this.embeddings[i]);
      results.push({
        index: i,
        similarity: similarity,
        document: this.documents[i],
        metadata: this.metadatas[i],
        id: this.ids[i]
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, nResults);
    
    return {
      ids: [topResults.map(r => r.id)],
      documents: [topResults.map(r => r.document)],
      metadatas: [topResults.map(r => r.metadata)],
      distances: [topResults.map(r => 1 - r.similarity)]
    };
  }

  cosineSimilarity(a, b) {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return normA && normB ? dotProduct / (normA * normB) : 0;
  }

  async delete({ ids }) {
    for (const id of ids) {
      const index = this.ids.indexOf(id);
      if (index !== -1) {
        this.ids.splice(index, 1);
        this.embeddings.splice(index, 1);
        this.metadatas.splice(index, 1);
        this.documents.splice(index, 1);
      }
    }
  }

  async get({ where }) {
    const filteredIds = [];
    const filteredDocs = [];
    const filteredMetadatas = [];
    
    for (let i = 0; i < this.documents.length; i++) {
      let match = true;
      for (const [key, value] of Object.entries(where)) {
        if (this.metadatas[i][key] !== value) {
          match = false;
          break;
        }
      }
      if (match) {
        filteredIds.push(this.ids[i]);
        filteredDocs.push(this.documents[i]);
        filteredMetadatas.push(this.metadatas[i]);
      }
    }
    
    return {
      ids: filteredIds,
      documents: filteredDocs,
      metadatas: filteredMetadatas
    };
  }

  async count() {
    return this.documents.length;
  }

  async deleteAll() {
    this.documents = [];
    this.embeddings = [];
    this.metadatas = [];
    this.ids = [];
  }
}

class VectorStoreService {
  constructor() {
    this.collection = null;
    this.embeddings = null;
    this.initialized = false;
    this.collectionName = 'investment_documents';
    this.useInMemory = true;
  }

  async initialize() {
    if (this.initialized && this.collection) {
      return this;
    }

    try {
      // Use the correct embedding model name for Gemini API
      const modelName = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
      console.log(`📦 Using embedding model: ${modelName}`);
      
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        model: modelName,
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        // Use v1beta API
        apiVersion: 'v1beta',
      });

      if (!this.collection) {
        this.collection = new InMemoryVectorStore();
      }
      console.log('✅ Using in-memory vector store');
      this.initialized = true;
      return this;
    } catch (error) {
      console.error('Vector store initialization error:', error.message);
      // Fallback to a simpler approach without embeddings
      if (!this.collection) {
        this.collection = new InMemoryVectorStore();
      }
      this.initialized = true;
      console.log('🔄 Using in-memory fallback (embeddings disabled)');
      return this;
    }
  }

  async generateEmbeddings(text) {
    try {
      if (!this.embeddings) {
        await this.initialize();
      }
      // If embeddings failed to initialize, return a dummy embedding
      if (!this.embeddings) {
        return new Array(3072).fill(0.01);
      }
      const result = await this.embeddings.embedQuery(text);
      return result;
    } catch (error) {
      console.error('Embedding generation error:', error.message);
      // Return a dummy embedding as fallback
      return new Array(3072).fill(0.01);
    }
  }

  async addDocuments(documents) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const ids = [];
      const embeddings = [];
      const metadatas = [];
      const contents = [];

      for (const doc of documents) {
        const id = uuidv4();
        ids.push(id);
        contents.push(doc.pageContent);
        metadatas.push(doc.metadata);
        
        try {
          const embedding = await this.generateEmbeddings(doc.pageContent);
          embeddings.push(embedding);
        } catch (embedError) {
          console.warn('⚠️ Embedding failed for chunk, using fallback');
          // Use a random embedding as fallback
          embeddings.push(new Array(3072).fill(0).map(() => Math.random() * 0.01));
        }
      }

      await this.collection.add({
        ids: ids,
        embeddings: embeddings,
        metadatas: metadatas,
        documents: contents
      });

      console.log(`✅ Added ${documents.length} documents to vector store`);
      return ids;
    } catch (error) {
      console.error('Add documents error:', error.message);
      // Store documents without embeddings as fallback
      try {
        const ids = [];
        const metadatas = [];
        const contents = [];
        for (const doc of documents) {
          const id = uuidv4();
          ids.push(id);
          contents.push(doc.pageContent);
          metadatas.push(doc.metadata);
        }
        await this.collection.add({
          ids: ids,
          embeddings: new Array(ids.length).fill(new Array(3072).fill(0.001)),
          metadatas: metadatas,
          documents: contents
        });
        console.log(`✅ Added ${documents.length} documents with fallback`);
        return ids;
      } catch (fallbackError) {
        throw new Error(`Failed to add documents: ${error.message}`);
      }
    }
  }

  async search(query, limit = 5, symbol = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const queryEmbedding = await this.generateEmbeddings(query);
      
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: symbol ? { symbol: symbol.toUpperCase() } : null
      });

      return results;
    } catch (error) {
      console.error('Search error:', error.message);
      return { documents: [], metadatas: [], distances: [] };
    }
  }

  async getRelevantContext(query, limit = 5, symbol = null) {
    const results = await this.search(query, limit, symbol);
    
    if (!results.documents || results.documents.length === 0 || results.documents[0].length === 0) {
      return {
        context: '',
        sources: [],
        references: []
      };
    }

    const context = results.documents[0].join('\n\n');
    const sources = results.metadatas[0].map(m => ({
      source: m.source || 'Unknown',
      symbol: m.symbol || 'N/A',
      type: m.type || 'document',
      snippet: m.snippet || ''
    }));

    const references = results.documents[0].map((doc, index) => ({
      index: index + 1,
      text: doc.substring(0, 150) + '...',
      relevance: results.distances[0]?.[index] || 0
    }));

    return {
      context,
      sources,
      references
    };
  }

  async deleteDocumentsBySymbol(symbol) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const results = await this.collection.get({
        where: { symbol: symbol.toUpperCase() }
      });

      if (results.ids && results.ids.length > 0) {
        await this.collection.delete({
          ids: results.ids
        });
        console.log(`✅ Deleted ${results.ids.length} documents for ${symbol}`);
      }
    } catch (error) {
      console.error('Delete documents error:', error.message);
    }
  }

  async getDocumentCount() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const count = await this.collection.count();
      return count;
    } catch (error) {
      console.error('Get count error:', error.message);
      return 0;
    }
  }

  async clearAll() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.collection.deleteAll();
      console.log('✅ Cleared all documents from vector store');
    } catch (error) {
      console.error('Clear error:', error.message);
    }
  }
}

export default new VectorStoreService();

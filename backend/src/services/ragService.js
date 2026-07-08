import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import documentService from './documentService.js';
import vectorStoreService from './vectorStoreService.js';

class RAGService {
  constructor() {
    this.llm = null;
    this.initialized = false;
    this.lastProcessedSymbol = null;
    this.lastProcessedText = null;
  }

  initialize() {
    if (!this.llm) {
      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
      console.log(`🤖 Using Gemini model: ${modelName}`);
      
      this.llm = new ChatGoogleGenerativeAI({
        model: modelName,
        temperature: 0.2,
        maxOutputTokens: 4096,
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      });
    }
    this.initialized = true;
  }

  async processAnnualReport(symbol) {
    try {
      const normalizedSymbol = symbol.toUpperCase();
      console.log(`📄 Processing annual report for ${normalizedSymbol}...`);

      const reportData = await documentService.fetchSECFiling(normalizedSymbol);
      
      if (!reportData) {
        throw new Error(`No SEC filing found for ${normalizedSymbol}`);
      }

      // Parse the report data into text
      const text = documentService.parseAnnualReportData(reportData);
      console.log(`📝 Parsed text length: ${text.length} characters`);
      
      // Store the processed text for fallback
      this.lastProcessedSymbol = normalizedSymbol;
      this.lastProcessedText = text;

      // Create chunks
      const chunks = await documentService.createChunks(text, {
        source: 'SEC_EDGAR',
        symbol: normalizedSymbol,
        type: 'annual_report',
      });
      
      console.log(`📦 Created ${chunks.length} chunks`);

      await vectorStoreService.initialize();
      await vectorStoreService.deleteDocumentsBySymbol(normalizedSymbol);
      
      // Try to add documents with embeddings, but don't fail if embeddings don't work
      try {
        const ids = await vectorStoreService.addDocuments(chunks);
        console.log(`✅ Processed ${chunks.length} chunks for ${normalizedSymbol}`);
        
        return {
          success: true,
          symbol: normalizedSymbol,
          chunksProcessed: chunks.length,
          documentIds: ids,
          textPreview: text.substring(0, 500) + '...'
        };
      } catch (embeddingError) {
        console.warn('⚠️ Embedding failed, but storing text for fallback:', embeddingError.message);
        // Still return success but with a note
        return {
          success: true,
          symbol: normalizedSymbol,
          chunksProcessed: chunks.length,
          documentIds: [],
          textPreview: text.substring(0, 500) + '...',
          warning: 'Embeddings failed, but text data is stored for Q&A'
        };
      }
    } catch (error) {
      console.error('Process annual report error:', error.message);
      throw new Error(`Failed to process annual report: ${error.message}`);
    }
  }

  async getContext(query, symbol = null) {
    try {
      const normalizedSymbol = symbol ? symbol.toUpperCase() : null;
      await vectorStoreService.initialize();
      
      // Try to get context from vector store
      const context = await vectorStoreService.getRelevantContext(query, 5, normalizedSymbol);
      
      // If no context found but we have stored text, use that
      if (!context.context && this.lastProcessedText && this.lastProcessedSymbol === normalizedSymbol) {
        console.log('📚 Using stored text as fallback context');
        return {
          context: this.lastProcessedText.substring(0, 3000),
          sources: [{
            source: 'SEC_EDGAR',
            symbol: normalizedSymbol,
            type: 'annual_report',
            snippet: this.lastProcessedText.substring(0, 200)
          }],
          references: [{
            index: 1,
            text: this.lastProcessedText.substring(0, 150) + '...',
            relevance: 1
          }]
        };
      }
      
      return context;
    } catch (error) {
      console.error('Get context error:', error.message);
      // Fallback to stored text
      const normalizedSymbol = symbol ? symbol.toUpperCase() : null;
      if (this.lastProcessedText && this.lastProcessedSymbol === normalizedSymbol) {
        return {
          context: this.lastProcessedText.substring(0, 3000),
          sources: [{
            source: 'SEC_EDGAR',
            symbol: normalizedSymbol,
            type: 'annual_report',
            snippet: this.lastProcessedText.substring(0, 200)
          }],
          references: [{
            index: 1,
            text: this.lastProcessedText.substring(0, 150) + '...',
            relevance: 1
          }]
        };
      }
      return {
        context: '',
        sources: [],
        references: []
      };
    }
  }

  async answerQuestion(query, symbol = null) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      console.log(`🤔 Answering question: ${query}`);

      const { context, sources, references } = await this.getContext(query, symbol);

      // If no context and no stored text, use general knowledge
      let prompt = `
You are an investment research analyst. Answer the following question about ${symbol || 'the company'}.

QUESTION: ${query}

`;

      if (context) {
        prompt += `
CONTEXT FROM ANNUAL REPORTS:
${context}

INSTRUCTIONS:
1. Base your answer on the context provided above
2. If the context doesn't contain the answer, say so clearly
3. Provide specific financial metrics when available
4. Keep the answer professional and concise
`;
      } else {
        prompt += `
INSTRUCTIONS:
1. Provide a general investment analysis answer
2. Use your knowledge of financial analysis
3. Keep the answer professional and concise
4. Note that specific company data may not be available
`;
      }

      prompt += `

ANSWER:
`;

      const response = await this.llm.invoke([
        new SystemMessage('You are a senior investment analyst with expertise in financial analysis and company research.'),
        new HumanMessage(prompt)
      ]);

      return {
        answer: response.content,
        sources: sources || [],
        references: references || [],
        query: query,
        symbol: symbol || 'N/A'
      };
    } catch (error) {
      console.error('Answer question error:', error.message);
      return {
        answer: `I'm unable to provide a detailed answer at this time. Error: ${error.message}`,
        sources: [],
        references: [],
        query: query,
        symbol: symbol || 'N/A'
      };
    }
  }

  async generateEvidenceRecommendation(symbol, companyData) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      console.log(`📊 Generating evidence-based recommendation for ${symbol}...`);

      const query = `Financial performance, profitability, growth, risks, and competitive position of ${symbol}`;
      const { context, sources, references } = await this.getContext(query, symbol);

      const prompt = `
You are a senior investment analyst. Generate an evidence-based investment recommendation for ${symbol}.

COMPANY DATA:
Company: ${companyData?.profile?.name || 'N/A'}
Industry: ${companyData?.profile?.industry || 'N/A'}
Revenue Trends: ${JSON.stringify(companyData?.revenueTrends?.slice(0, 3) || [])}
Financial Ratios: ${JSON.stringify(companyData?.ratios || {})}

${context ? `CONTEXT FROM ANNUAL REPORTS:\n${context.substring(0, 2000)}` : 'No annual report context available'}

INSTRUCTIONS:
1. Provide a clear recommendation: INVEST, HOLD, or PASS
2. Support every claim with evidence
3. Include specific financial metrics and trends
4. Identify key risks and opportunities
5. Provide a confidence score (0-100)

FORMAT YOUR RESPONSE AS JSON:
{
  "recommendation": "Invest/Hold/Pass",
  "confidenceScore": 85,
  "reasoning": [
    "Evidence-based reason 1",
    "Evidence-based reason 2",
    "Evidence-based reason 3"
  ],
  "evidence": [
    {
      "claim": "Strong revenue growth",
      "evidence": "Revenue grew 15% year-over-year",
      "source": "10-K Filing 2024"
    }
  ],
  "risks": ["Risk 1", "Risk 2"],
  "keyMetrics": {
    "revenueGrowth": "15%",
    "profitMargin": "25%",
    "debtToEquity": "0.5"
  }
}
`;

      const response = await this.llm.invoke([
        new SystemMessage('You are a senior investment analyst providing evidence-based recommendations. Respond in valid JSON format.'),
        new HumanMessage(prompt)
      ]);

      let result;
      try {
        const content = response.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        result = {
          recommendation: 'Hold',
          confidenceScore: 50,
          reasoning: ['Unable to parse structured response'],
          evidence: [],
          risks: ['Analysis incomplete'],
          keyMetrics: {}
        };
      }

      return {
        ...result,
        sources: sources || [],
        references: references || [],
        contextUsed: context || 'No context available'
      };
    } catch (error) {
      console.error('Generate evidence recommendation error:', error.message);
      return {
        recommendation: 'Hold',
        confidenceScore: 0,
        reasoning: [`Analysis failed: ${error.message}`],
        evidence: [],
        risks: ['Unable to complete analysis'],
        keyMetrics: {},
        error: error.message
      };
    }
  }

  async getSourcesForClaim(claim, symbol) {
    try {
      const { context, sources, references } = await this.getContext(claim, symbol);
      return {
        claim: claim,
        sources: sources || [],
        references: references || [],
        context: context || ''
      };
    } catch (error) {
      console.error('Get sources error:', error.message);
      return {
        claim: claim,
        sources: [],
        references: [],
        context: ''
      };
    }
  }
}

export default new RAGService();

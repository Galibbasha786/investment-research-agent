import { StateGraph, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import newsService from './newsService.js';
import youtubeService from './youtubeService.js';

class NewsAgentService {
  constructor() {
    this.llm = null;
    this.initialized = false;
  }

  initialize() {
    if (!this.llm) {
      this.llm = new ChatGoogleGenerativeAI({
        model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
        temperature: 0.2,
        maxOutputTokens: 4096,
        apiKey: process.env.GEMINI_API_KEY
      });
    }
    this.initialized = true;
  }

  // Create initial state
  createInitialState(symbol, companyName) {
    return {
      symbol: symbol || 'N/A',
      companyName: companyName || symbol || 'N/A',
      news: [],
      videos: [],
      newsSentiment: null,
      combinedAnalysis: null,
      summary: null,
      currentStep: 'start',
      errors: []
    };
  }

  // Agent: Fetch News
  async fetchNewsAgent(state) {
    try {
      console.log(`📰 Fetching news for ${state.symbol}...`);
      
      const news = await newsService.fetchCompanyNews(state.symbol, 20);
      const sentiment = await newsService.getNewsSentiment(state.symbol);
      
      return {
        ...state,
        news: news || [],
        newsSentiment: sentiment || null,
        currentStep: 'videos'
      };
    } catch (error) {
      console.error('News fetch error:', error.message);
      return {
        ...state,
        currentStep: 'videos',
        errors: [...(state.errors || []), `News fetch error: ${error.message}`]
      };
    }
  }

  // Agent: Fetch Videos
  async fetchVideosAgent(state) {
    try {
      console.log(`🎬 Fetching videos for ${state.symbol}...`);
      
      const videos = await youtubeService.searchCompanyVideos(
        state.symbol,
        state.companyName || state.symbol,
        6
      );
      
      return {
        ...state,
        videos: videos || [],
        currentStep: 'analyze'
      };
    } catch (error) {
      console.error('Video fetch error:', error.message);
      return {
        ...state,
        currentStep: 'analyze',
        errors: [...(state.errors || []), `Video fetch error: ${error.message}`]
      };
    }
  }

  // Agent: Analyze Data
  async analyzeDataAgent(state) {
    try {
      console.log(`🧠 Analyzing news and videos for ${state.symbol}...`);
      
      if (!this.initialized) this.initialize();

      // Prepare news summary
      const newsSummary = (state.news || []).slice(0, 10).map(n => 
        `- ${n.title || 'No title'} (Sentiment: ${(n.sentiment || 0).toFixed(2)})`
      ).join('\n');

      // Prepare video summary
      const videoSummary = (state.videos || []).slice(0, 5).map(v => 
        `- ${v.title || 'No title'} (Channel: ${v.channelTitle || 'Unknown'})`
      ).join('\n');

      const prompt = `
You are a financial analyst. Analyze the following news and video data for ${state.symbol} (${state.companyName || state.symbol}).

NEWS (${(state.news || []).length} articles):
${newsSummary || 'No news available'}

VIDEOS (${(state.videos || []).length} videos):
${videoSummary || 'No videos available'}

SENTIMENT SCORE: ${state.newsSentiment?.sentimentScore || 50}/100

Provide analysis in JSON format:
{
  "marketSentiment": "bullish/bearish/neutral",
  "keyTopics": ["topic1", "topic2"],
  "emergingTrends": ["trend1", "trend2"],
  "riskFactors": ["risk1", "risk2"],
  "opportunityFactors": ["opportunity1", "opportunity2"],
  "overallAssessment": "brief overall assessment",
  "confidence": 75
}
`;

      const response = await this.llm.invoke([
        new SystemMessage('You are a senior financial analyst providing news and video analysis. Respond in valid JSON format.'),
        new HumanMessage(prompt)
      ]);

      let analysis;
      try {
        const content = response.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
          marketSentiment: 'neutral',
          keyTopics: ['Unable to parse'],
          emergingTrends: [],
          riskFactors: [],
          opportunityFactors: [],
          overallAssessment: 'Analysis parsing failed',
          confidence: 50
        };
      } catch (parseError) {
        analysis = {
          marketSentiment: 'neutral',
          keyTopics: [],
          emergingTrends: [],
          riskFactors: [],
          opportunityFactors: [],
          overallAssessment: response.content || 'Analysis complete',
          confidence: 50
        };
      }

      return {
        ...state,
        combinedAnalysis: analysis,
        currentStep: 'summary'
      };
    } catch (error) {
      console.error('Analysis error:', error.message);
      return {
        ...state,
        currentStep: 'summary',
        errors: [...(state.errors || []), `Analysis error: ${error.message}`]
      };
    }
  }

  // Agent: Generate Summary
  async generateSummaryAgent(state) {
    try {
      console.log(`📝 Generating summary for ${state.symbol}...`);
      
      if (!this.initialized) this.initialize();

      const prompt = `
Based on the analysis of news and videos for ${state.symbol} (${state.companyName || state.symbol}), generate a comprehensive summary.

Market Sentiment: ${state.combinedAnalysis?.marketSentiment || 'neutral'}
Key Topics: ${(state.combinedAnalysis?.keyTopics || []).join(', ') || 'N/A'}
Overall Assessment: ${state.combinedAnalysis?.overallAssessment || 'N/A'}

Provide summary in JSON format:
{
  "executiveSummary": "2-3 paragraph summary",
  "keyTakeaways": ["takeaway1", "takeaway2", "takeaway3"],
  "newsHighlight": "Most important news item",
  "videoHighlight": "Most important video",
  "recommendation": "short-term/investment recommendation",
  "confidenceScore": 75
}
`;

      const response = await this.llm.invoke([
        new SystemMessage('You are a senior financial analyst providing executive summaries. Respond in valid JSON format.'),
        new HumanMessage(prompt)
      ]);

      let summary;
      try {
        const content = response.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        summary = jsonMatch ? JSON.parse(jsonMatch[0]) : {
          executiveSummary: 'Summary generation failed',
          keyTakeaways: [],
          newsHighlight: 'N/A',
          videoHighlight: 'N/A',
          recommendation: 'Hold',
          confidenceScore: 50
        };
      } catch (parseError) {
        summary = {
          executiveSummary: response.content || 'Summary complete',
          keyTakeaways: [],
          newsHighlight: 'N/A',
          videoHighlight: 'N/A',
          recommendation: 'Hold',
          confidenceScore: 50
        };
      }

      return {
        ...state,
        summary: summary,
        currentStep: 'complete'
      };
    } catch (error) {
      console.error('Summary error:', error.message);
      return {
        ...state,
        currentStep: 'complete',
        errors: [...(state.errors || []), `Summary error: ${error.message}`]
      };
    }
  }

  // Build the workflow
  buildWorkflow() {
    // Define the state schema as a plain object
    const workflow = new StateGraph({
      channels: {
        symbol: { value: (a, b) => b ?? a },
        companyName: { value: (a, b) => b ?? a },
        news: { value: (a, b) => b ?? a },
        videos: { value: (a, b) => b ?? a },
        newsSentiment: { value: (a, b) => b ?? a },
        combinedAnalysis: { value: (a, b) => b ?? a },
        summary: { value: (a, b) => b ?? a },
        currentStep: { value: (a, b) => b ?? a },
        errors: { value: (a, b) => b ?? a }
      }
    });

    // Add nodes with their handlers
    workflow.addNode('fetchNews', async (state) => {
      return await this.fetchNewsAgent(state);
    });
    workflow.addNode('fetchVideos', async (state) => {
      return await this.fetchVideosAgent(state);
    });
    workflow.addNode('analyzeData', async (state) => {
      return await this.analyzeDataAgent(state);
    });
    workflow.addNode('generateSummary', async (state) => {
      return await this.generateSummaryAgent(state);
    });

    // Define edges
    workflow.setEntryPoint('fetchNews');
    workflow.addEdge('fetchNews', 'fetchVideos');
    workflow.addEdge('fetchVideos', 'analyzeData');
    workflow.addEdge('analyzeData', 'generateSummary');
    workflow.addEdge('generateSummary', END);

    return workflow.compile();
  }

  // Main function to run the analysis
  async runAnalysis(symbol, companyName) {
    try {
      console.log(`🚀 Starting news analysis for ${symbol}...`);
      
      if (!this.initialized) this.initialize();
      
      const app = this.buildWorkflow();
      const initialState = this.createInitialState(symbol, companyName);
      
      let finalState = initialState;
      
      // Run the workflow
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Analysis timed out after 15 seconds')), 15000)
        );
        
        finalState = await Promise.race([
          app.invoke(initialState),
          timeoutPromise
        ]);
        console.log(`📊 Analysis complete for ${symbol}`);
      } catch (workflowError) {
        console.error('Workflow error:', workflowError.message);
        console.log('🔄 Falling back to quick analysis due to workflow failure or timeout...');
        return await this.quickAnalysis(symbol, companyName);
      }
      
      return {
        success: true,
        symbol: symbol,
        news: finalState.news || [],
        videos: finalState.videos || [],
        sentiment: finalState.newsSentiment || null,
        analysis: finalState.combinedAnalysis || null,
        summary: finalState.summary || null,
        errors: finalState.errors || []
      };
    } catch (error) {
      console.error('News analysis error:', error.message);
      // Try fallback
      try {
        console.log('🔄 Attempting fallback analysis...');
        return await this.quickAnalysis(symbol, companyName);
      } catch (fallbackError) {
        return {
          success: false,
          symbol: symbol,
          error: error.message,
          news: [],
          videos: [],
          sentiment: null,
          analysis: null,
          summary: null,
          errors: [error.message, fallbackError.message]
        };
      }
    }
  }

  // Simplified analysis without LangGraph (Fallback)
  async quickAnalysis(symbol, companyName) {
    try {
      console.log(`⚡ Quick analysis for ${symbol}...`);
      
      const news = await newsService.fetchCompanyNews(symbol, 15);
      const sentiment = await newsService.getNewsSentiment(symbol);
      const videos = await youtubeService.searchCompanyVideos(symbol, companyName || symbol, 3);
      
      let summary = {
        executiveSummary: `Analysis for ${symbol} shows ${sentiment?.totalNews || 0} news articles and ${videos.length} videos. Market sentiment is ${sentiment?.overallSentiment > 0.1 ? 'positive' : sentiment?.overallSentiment < -0.1 ? 'negative' : 'neutral'}.`,
        keyTakeaways: [
          `${sentiment?.totalNews || 0} news articles analyzed`,
          `Sentiment score: ${sentiment?.sentimentScore || 50}/100`,
          `${videos.length} video sources found`
        ],
        newsHighlight: news[0]?.title || 'No news available',
        videoHighlight: videos[0]?.title || 'No videos available',
        recommendation: sentiment?.overallSentiment > 0.1 ? 'Positive outlook' : 
                        sentiment?.overallSentiment < -0.1 ? 'Caution advised' : 'Neutral outlook',
        confidenceScore: Math.min(90, Math.abs(sentiment?.overallSentiment || 0) * 100 + 30)
      };
      
      return {
        success: true,
        symbol: symbol,
        news: news.slice(0, 10),
        videos: videos.slice(0, 3),
        sentiment: sentiment,
        analysis: {
          marketSentiment: sentiment?.overallSentiment > 0.1 ? 'bullish' : 
                          sentiment?.overallSentiment < -0.1 ? 'bearish' : 'neutral',
          keyTopics: ['Financial Analysis', 'Market News'],
          emergingTrends: ['News sentiment analysis'],
          riskFactors: ['Market volatility'],
          opportunityFactors: ['Information availability'],
          overallAssessment: `Based on ${sentiment?.totalNews || 0} news articles, the sentiment is ${sentiment?.overallSentiment > 0.1 ? 'positive' : sentiment?.overallSentiment < -0.1 ? 'negative' : 'neutral'}.`,
          confidence: 60
        },
        summary: summary,
        errors: []
      };
    } catch (error) {
      console.error('Quick analysis error:', error.message);
      return {
        success: false,
        symbol: symbol,
        error: error.message,
        news: [],
        videos: [],
        sentiment: null,
        analysis: null,
        summary: null
      };
    }
  }
}

export default new NewsAgentService();
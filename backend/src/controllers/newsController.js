import newsService from '../services/newsService.js';
import youtubeService from '../services/youtubeService.js';
import newsAgentService from '../services/newsAgentService.js';

// @desc    Get news for a company
// @route   GET /api/news/:symbol
// @access  Private
export const getCompanyNews = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 20 } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    const news = await newsService.fetchCompanyNews(symbol, parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: news
    });
  } catch (error) {
    console.error('News error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching news'
    });
  }
};

// @desc    Get news sentiment
// @route   GET /api/news/sentiment/:symbol
// @access  Private
export const getNewsSentiment = async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    const sentiment = await newsService.getNewsSentiment(symbol);
    
    res.status(200).json({
      success: true,
      data: sentiment
    });
  } catch (error) {
    console.error('Sentiment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching sentiment'
    });
  }
};

// @desc    Get YouTube videos
// @route   GET /api/news/videos/:symbol
// @access  Private
export const getCompanyVideos = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 10 } = req.query;
    const { companyName } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    const videos = await youtubeService.searchCompanyVideos(
      symbol,
      companyName || symbol,
      parseInt(limit)
    );
    
    res.status(200).json({
      success: true,
      data: videos
    });
  } catch (error) {
    console.error('Video error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching videos'
    });
  }
};

// @desc    Run full news analysis with LangGraph
// @route   POST /api/news/analyze
// @access  Private
export const analyzeNews = async (req, res) => {
  try {
    const { symbol, companyName } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    const result = await newsAgentService.runAnalysis(symbol, companyName || symbol);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error analyzing news'
    });
  }
};

// @desc    Quick news analysis
// @route   POST /api/news/quick
// @access  Private
export const quickNewsAnalysis = async (req, res) => {
  try {
    const { symbol, companyName } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    const result = await newsAgentService.quickAnalysis(symbol, companyName || symbol);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Quick analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error performing quick analysis'
    });
  }
};
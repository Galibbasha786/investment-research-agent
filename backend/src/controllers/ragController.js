import ragService from '../services/ragService.js';
import vectorStoreService from '../services/vectorStoreService.js';

// @desc    Process annual report for RAG
// @route   POST /api/rag/process
// @access  Private
export const processAnnualReport = async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    console.log(`📄 Processing annual report for ${symbol}...`);

    // Initialize vector store first
    await vectorStoreService.initialize();

    const result = await ragService.processAnnualReport(symbol);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Process annual report error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error processing annual report',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Ask question using RAG
// @route   POST /api/rag/ask
// @access  Private
export const askQuestion = async (req, res) => {
  try {
    const { query, symbol } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    // Initialize vector store first
    await vectorStoreService.initialize();

    const result = await ragService.answerQuestion(query, symbol);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Ask question error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error answering question'
    });
  }
};

// @desc    Get evidence-based recommendation
// @route   POST /api/rag/recommendation
// @access  Private
export const getEvidenceRecommendation = async (req, res) => {
  try {
    const { symbol, companyData } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    // Initialize vector store first
    await vectorStoreService.initialize();

    const result = await ragService.generateEvidenceRecommendation(symbol, companyData);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Evidence recommendation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error generating recommendation'
    });
  }
};

// @desc    Get sources for a claim
// @route   POST /api/rag/sources
// @access  Private
export const getSourcesForClaim = async (req, res) => {
  try {
    const { claim, symbol } = req.body;

    if (!claim) {
      return res.status(400).json({
        success: false,
        message: 'Claim is required'
      });
    }

    // Initialize vector store first
    await vectorStoreService.initialize();

    const result = await ragService.getSourcesForClaim(claim, symbol);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get sources error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching sources'
    });
  }
};

// @desc    Get vector store status
// @route   GET /api/rag/status
// @access  Private
export const getVectorStoreStatus = async (req, res) => {
  try {
    await vectorStoreService.initialize();
    const count = await vectorStoreService.getDocumentCount();

    res.status(200).json({
      success: true,
      data: {
        initialized: vectorStoreService.initialized,
        documentCount: count,
        collectionName: vectorStoreService.collectionName
      }
    });
  } catch (error) {
    console.error('Vector store status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching vector store status'
    });
  }
};

// @desc    Clear vector store
// @route   DELETE /api/rag/clear
// @access  Private (admin only)
export const clearVectorStore = async (req, res) => {
  try {
    await vectorStoreService.initialize();
    await vectorStoreService.clearAll();

    res.status(200).json({
      success: true,
      message: 'Vector store cleared successfully'
    });
  } catch (error) {
    console.error('Clear vector store error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error clearing vector store'
    });
  }
};

// @desc    Get documents/chunks for a symbol
// @route   GET /api/rag/documents/:symbol
// @access  Private
export const getDocuments = async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Symbol is required'
      });
    }

    await vectorStoreService.initialize();
    const result = await vectorStoreService.collection.get({
      where: { symbol: symbol.toUpperCase() }
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving documents'
    });
  }
};
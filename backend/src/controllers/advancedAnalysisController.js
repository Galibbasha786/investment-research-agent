import advancedAgentService from '../services/advancedAgentService.js';

// @desc    Run advanced analysis with LangGraph
// @route   POST /api/advanced/analyze
// @access  Private
export const runAdvancedAnalysis = async (req, res) => {
  try {
    const { symbol, companyData } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    const result = await advancedAgentService.runAdvancedAnalysis(symbol, companyData);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Advanced analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error running advanced analysis'
    });
  }
};

// @desc    Get agent status
// @route   GET /api/advanced/status
// @access  Private
export const getAgentStatus = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'active',
      agents: [
        'Parallel Analysis Agent',
        'News & Videos Agent',
        'Sentiment Analysis Agent',
        'Recommendation Agent',
        'Human-in-the-Loop Agent'
      ],
      version: '2.0'
    }
  });
};
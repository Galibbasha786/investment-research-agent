import scoringEngine from '../services/scoringEngine.js';

// @desc    Calculate investment score
// @route   POST /api/score/calculate
// @access  Private
export const calculateScore = async (req, res) => {
  try {
    const { symbol, companyData } = req.body;

    if (!symbol || !companyData) {
      return res.status(400).json({
        success: false,
        message: 'Symbol and company data are required'
      });
    }

    console.log(`📊 Calculating investment score for ${symbol}...`);

    const result = scoringEngine.calculateOverallScore(companyData);

    res.status(200).json({
      success: true,
      data: {
        symbol,
        ...result,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Scoring error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error calculating score'
    });
  }
};

// @desc    Get score explanation
// @route   GET /api/score/explain/:symbol
// @access  Private
export const getScoreExplanation = async (req, res) => {
  try {
    const { symbol } = req.params;

    // This would fetch from database
    res.status(200).json({
      success: true,
      data: {
        symbol,
        explanation: 'Score explanation will be retrieved from stored analysis'
      }
    });
  } catch (error) {
    console.error('Explanation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching explanation'
    });
  }
};
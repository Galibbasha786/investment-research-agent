import {
  searchCompanies,
  getCompanyProfile,
  getFinancials,
  getKeyRatios,
  parseRevenueTrends,
  parseCashFlowAnalysis,
  parseBalanceSheetHealth,
  getSecFinancialFallback
} from '../services/companyService.js';
import Research from '../models/Research.js';
import PDFDocument from 'pdfkit';
// @desc    Search companies
// @route   GET /api/research/search
// @access  Private
export const searchCompaniesHandler = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }
    
    console.log('Controller: Searching for:', query);
    const results = await searchCompanies(query);
    console.log('Controller: Search completed, results count:', results.length);
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error searching companies',
      error: error.toString()
    });
  }
};

// @desc    Get company data
// @route   GET /api/research/company/:symbol
// @access  Private
export const getCompanyData = async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    // Fetch company profile first to validate symbol
    let profile, financials, ratios, revenueTrends, cashFlow, balanceSheet;
    const dataErrors = {};

    try {
      profile = await getCompanyProfile(symbol);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: `Company not found: ${error.message}`
      });
    }

    [financials, ratios] = await Promise.all([
      getFinancials(symbol).catch(e => {
        console.warn('Financials fetch failed:', e.message);
        dataErrors.financials = e.message;
        return null;
      }),
      getKeyRatios(symbol).catch(e => {
        console.warn('Ratios fetch failed:', e.message);
        dataErrors.ratios = e.message;
        return null;
      })
    ]);

    if (financials?.errors) {
      Object.assign(dataErrors, financials.errors);
    }

    try {
      revenueTrends = parseRevenueTrends(financials?.incomeStatement);
    } catch (error) {
      console.warn('Revenue trends parse failed:', error.message);
      dataErrors.revenueTrends = dataErrors.incomeStatement || error.message;
      revenueTrends = [];
    }

    try {
      cashFlow = parseCashFlowAnalysis(financials?.cashFlow);
    } catch (error) {
      console.warn('Cash flow parse failed:', error.message);
      dataErrors.cashFlow = dataErrors.cashFlow || error.message;
      cashFlow = [];
    }

    try {
      balanceSheet = parseBalanceSheetHealth(financials?.balanceSheet);
    } catch (error) {
      console.warn('Balance sheet parse failed:', error.message);
      dataErrors.balanceSheet = dataErrors.balanceSheet || error.message;
      balanceSheet = [];
    }

    if (revenueTrends.length === 0 || cashFlow.length === 0 || balanceSheet.length === 0) {
      try {
        const secFinancials = await getSecFinancialFallback(symbol);

        if (revenueTrends.length === 0 && secFinancials.revenueTrends.length > 0) {
          revenueTrends = secFinancials.revenueTrends;
          dataErrors.revenueTrends = `${dataErrors.revenueTrends || 'Primary provider unavailable'}; loaded SEC fallback`;
        }

        if (cashFlow.length === 0 && secFinancials.cashFlow.length > 0) {
          cashFlow = secFinancials.cashFlow;
          dataErrors.cashFlow = `${dataErrors.cashFlow || 'Primary provider unavailable'}; loaded SEC fallback`;
        }

        if (balanceSheet.length === 0 && secFinancials.balanceSheet.length > 0) {
          balanceSheet = secFinancials.balanceSheet;
          dataErrors.balanceSheet = `${dataErrors.balanceSheet || 'Primary provider unavailable'}; loaded SEC fallback`;
        }
      } catch (error) {
        console.warn('SEC fallback failed:', error.message);
        dataErrors.secFallback = error.message;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        profile,
        financials,
        ratios,
        revenueTrends,
        cashFlow,
        balanceSheet,
        dataErrors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching company data'
    });
  }
};

// @desc    Save research
// @route   POST /api/research/save
// @access  Private
export const saveResearch = async (req, res) => {
  try {
    const {
      companyName,
      companySymbol,
      companyProfile,
      financialData,
      ratios,
      aiAnalysis,
      newsData,
      sentimentAnalysis,
      scores,
      recommendation
    } = req.body;
    
    const researchPayload = {
      companyName,
      companySymbol,
      companyProfile,
      financialData,
      ratios,
      aiAnalysis,
      newsData,
      sentimentAnalysis,
      scores,
      recommendation,
      analysisDate: new Date()
    };

    const normalizedSymbol = companySymbol?.toUpperCase();
    let research = normalizedSymbol
      ? await Research.findOne({
          user: req.user.id,
          companySymbol: normalizedSymbol
        })
      : null;

    if (research) {
      Object.assign(research, researchPayload);
      await research.save();
    } else {
      research = await Research.create({
        user: req.user.id,
        ...researchPayload
      });
      
      // Add to user's research history
      req.user.researchHistory.push(research._id);
      await req.user.save();
    }
    
    res.status(201).json({
      success: true,
      data: research
    });
  } catch (error) {
    console.error('Save research error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error saving research'
    });
  }
};

// @desc    Get research history
// @route   GET /api/research/history
// @access  Private
export const getResearchHistory = async (req, res) => {
  try {
    const research = await Research.find({ user: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(20);
    
    res.status(200).json({
      success: true,
      data: research
    });
  } catch (error) {
    console.error('Research history error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching research history'
    });
  }
};

// @desc    Get single research
// @route   GET /api/research/:id
// @access  Private
export const getResearch = async (req, res) => {
  try {
    const research = await Research.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!research) {
      return res.status(404).json({
        success: false,
        message: 'Research not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: research
    });
  } catch (error) {
    console.error('Get research error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching research'
    });
  }
};
// @desc    Delete research
// @route   DELETE /api/research/:id
// @access  Private
export const deleteResearch = async (req, res) => {
  try {
    const research = await Research.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!research) {
      return res.status(404).json({
        success: false,
        message: 'Research not found'
      });
    }

    await research.deleteOne();

    // Remove from user's research history
    req.user.researchHistory = req.user.researchHistory.filter(
      id => id.toString() !== req.params.id
    );
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Research deleted successfully'
    });
  } catch (error) {
    console.error('Delete research error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting research'
    });
  }
};
export const exportResearchPDF = async (req, res) => {
  try {
    const { researchId } = req.body;

    const research = await Research.findOne({
      _id: researchId,
      user: req.user.id
    });

    if (!research) {
      return res.status(404).json({
        success: false,
        message: 'Research not found'
      });
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${research.companyName}_Investment_Report.pdf`);

    doc.pipe(res);

    // Title
    doc.fontSize(24)
       .fillColor('#1a1a2e')
       .text('Investment Research Report', { align: 'center' });
    
    doc.moveDown();
    
    doc.fontSize(18)
       .fillColor('#16213e')
       .text(research.companyName, { align: 'center' });
    
    doc.fontSize(12)
       .fillColor('#555')
       .text(`Symbol: ${research.companySymbol}`, { align: 'center' });
    
    doc.moveDown();

    // Recommendation
    doc.fontSize(16)
       .fillColor('#1a1a2e')
       .text('Recommendation', { underline: true });
    
    doc.fontSize(14)
       .fillColor(research.recommendation?.decision === 'Invest' ? '#00b894' : 
                  research.recommendation?.decision === 'Hold' ? '#fdcb6e' : '#e17055')
       .text(`Decision: ${research.recommendation?.decision || 'N/A'}`);
    
    doc.fontSize(12)
       .fillColor('#555')
       .text(`Confidence: ${research.recommendation?.confidenceScore || 0}%`);
    
    doc.moveDown();

    // Reasoning
    if (research.recommendation?.reasoning?.length > 0) {
      doc.fontSize(14)
         .fillColor('#1a1a2e')
         .text('Key Reasoning', { underline: true });
      
      research.recommendation.reasoning.forEach(reason => {
        doc.fontSize(11)
           .fillColor('#444')
           .text(`• ${reason}`);
      });
      doc.moveDown();
    }

    // Scores
    if (research.scores) {
      doc.fontSize(14)
         .fillColor('#1a1a2e')
         .text('Score Breakdown', { underline: true });
      doc.moveDown();

      Object.entries(research.scores).forEach(([key, value]) => {
        const label = key.replace(/([A-Z])/g, ' $1').trim();
        doc.fontSize(11)
           .fillColor('#333')
           .text(`${label}: ${value.score || 0}%`);
      });
      doc.moveDown();
    }

    // Footer
    doc.fontSize(10)
       .fillColor('#999')
       .text(`Generated on: ${new Date().toISOString().split('T')[0]}`, { align: 'center' });
    
    doc.end();

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error exporting report'
    });
  }
};
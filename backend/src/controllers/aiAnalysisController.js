import { runInvestmentAnalysis } from '../services/aiAgentService.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import Research from '../models/Research.js';

const hasItems = (value) => Array.isArray(value) && value.some((item) => String(item || '').trim());

const asArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const toPlainObject = (value) => value?.toObject ? value.toObject() : value;

const getRevenueHistory = (financialData) => {
  const history = financialData?.revenue?.history;
  return asArray(history).map(item => {
    const plainItem = toPlainObject(item) || {};

    return {
      ...plainItem,
      revenue: plainItem.revenue ?? plainItem.value ?? 0
    };
  });
};

const getCashFlowHistory = (financialData) => {
  const cashFlow = financialData?.cashFlow;
  return asArray(cashFlow).map(toPlainObject);
};

const getBalanceSheetHistory = (financialData) => {
  const balanceSheet = financialData?.balanceSheet;
  return asArray(balanceSheet).map(toPlainObject);
};

const hasMeaningfulAIAnalysis = (aiAnalysis) => {
  if (!aiAnalysis) return false;

  const analysis = aiAnalysis.toObject ? aiAnalysis.toObject() : aiAnalysis;

  return Boolean(
    hasItems(analysis?.analysis?.financial?.strengths) ||
    hasItems(analysis?.analysis?.financial?.weaknesses) ||
    hasItems(analysis?.analysis?.swot?.strengths) ||
    hasItems(analysis?.analysis?.swot?.weaknesses) ||
    hasItems(analysis?.analysis?.businessModel?.revenueStreams) ||
    hasItems(analysis?.analysis?.businessModel?.customerSegments) ||
    hasItems(analysis?.analysis?.risk?.keyRisks)
  );
};

// @desc    Run AI analysis on a company
// @route   POST /api/ai/analyze
// @access  Private
export const analyzeCompany = async (req, res) => {
  try {
    const { symbol, force = false } = req.body;

    console.log('📊 AI Analysis Request for:', symbol);

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    // Check if we already have analysis in database
    let existingResearch = await Research.findOne({
      user: req.user.id,
      companySymbol: symbol.toUpperCase()
    });

    console.log('📁 Existing Research:', existingResearch ? 'Found' : 'Not found');

    // If we have existing research with AI analysis, return it
    if (!force && hasMeaningfulAIAnalysis(existingResearch?.aiAnalysis)) {
      console.log('✅ Returning cached AI analysis');
      return res.status(200).json({
        success: true,
        data: existingResearch.aiAnalysis,
        fromCache: true
      });
    }

    if (force) {
      console.log('🔄 Force refresh requested, bypassing cached AI analysis');
    } else if (existingResearch?.aiAnalysis) {
      console.log('⚠️ Cached AI analysis is empty or incomplete, regenerating');
    }

    // Build company data for analysis
    const companyData = {
      profile: existingResearch?.companyProfile || {},
      ratios: existingResearch?.ratios || {},
      revenueTrends: getRevenueHistory(existingResearch?.financialData),
      cashFlow: getCashFlowHistory(existingResearch?.financialData),
      balanceSheet: getBalanceSheetHistory(existingResearch?.financialData)
    };

    // If no data in database, try to fetch using company service
    if (!companyData.profile.name) {
      console.log('🔄 No cached data, attempting to fetch...');
      try {
        const { getCompanyProfile, getKeyRatios, getRevenueTrends, getCashFlowAnalysis, getBalanceSheetHealth } = await import('../services/companyService.js');
        
        const [profile, ratios, revenueTrends, cashFlow, balanceSheet] = await Promise.all([
          getCompanyProfile(symbol).catch(() => null),
          getKeyRatios(symbol).catch(() => null),
          getRevenueTrends(symbol).catch(() => []),
          getCashFlowAnalysis(symbol).catch(() => []),
          getBalanceSheetHealth(symbol).catch(() => [])
        ]);

        companyData.profile = profile || {};
        companyData.ratios = ratios || {};
        companyData.revenueTrends = revenueTrends || [];
        companyData.cashFlow = cashFlow || [];
        companyData.balanceSheet = balanceSheet || [];

        console.log('✅ Fetched fresh data for:', symbol);
      } catch (fetchError) {
        console.error('❌ Error fetching company data:', fetchError);
        return res.status(400).json({
          success: false,
          message: `Unable to fetch data for ${symbol}. Please research the company first.`
        });
      }
    }

    // Check if we have enough data
    if (!companyData.profile.name) {
      return res.status(400).json({
        success: false,
        message: 'Company data not found. Please research the company first.'
      });
    }

    console.log('🤖 Running AI analysis with LangGraph...');

    // Run the multi-agent analysis
    const analysisResult = await runInvestmentAnalysis(companyData);

    console.log('✅ AI Analysis Complete');

    if (!hasMeaningfulAIAnalysis(analysisResult)) {
      throw new Error(
        analysisResult?.errors?.length
          ? `Gemini returned incomplete analysis: ${analysisResult.errors.join('; ')}`
          : 'Gemini returned incomplete analysis'
      );
    }

    // Save to database
    if (existingResearch) {
      existingResearch.aiAnalysis = analysisResult;
      await existingResearch.save();
      console.log('💾 Analysis saved to existing research');
    } else {
      // Create new research entry
      const newResearch = await Research.create({
        user: req.user.id,
        companyName: companyData.profile.name,
        companySymbol: symbol.toUpperCase(),
        companyProfile: companyData.profile,
        ratios: companyData.ratios,
        financialData: {
          revenue: { history: companyData.revenueTrends },
          cashFlow: companyData.cashFlow,
          balanceSheet: companyData.balanceSheet
        },
        aiAnalysis: analysisResult
      });
      console.log('💾 New research created with analysis');
    }

    res.status(200).json({
      success: true,
      data: analysisResult,
      fromCache: false
    });
  } catch (error) {
    console.error('❌ AI Analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during AI analysis',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get AI analysis by company
// @route   GET /api/ai/analysis/:symbol
// @access  Private
export const getAIAnalysis = async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Company symbol is required'
      });
    }

    const research = await Research.findOne({
      user: req.user.id,
      companySymbol: symbol.toUpperCase()
    });

    if (!research || !research.aiAnalysis) {
      return res.status(404).json({
        success: false,
        message: 'No AI analysis found for this company'
      });
    }

    res.status(200).json({
      success: true,
      data: research.aiAnalysis
    });
  } catch (error) {
    console.error('Get AI analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching AI analysis'
    });
  }
};

// @desc    Generate executive summary
// @route   POST /api/ai/summary
// @access  Private
export const generateExecutiveSummary = async (req, res) => {
  try {
    const { symbol, analysisData } = req.body;

    if (!symbol || !analysisData) {
      return res.status(400).json({
        success: false,
        message: 'Symbol and analysis data are required'
      });
    }

    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    
    const llm = new ChatGoogleGenerativeAI({
      model: 'gemini-1.5-flash',
      temperature: 0.3,
      maxOutputTokens: 1024,
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
Generate a concise executive summary (2-3 paragraphs) for investment in ${symbol}.

Analysis Summary:
- Recommendation: ${analysisData?.recommendation?.recommendation || 'N/A'}
- Confidence Score: ${analysisData?.recommendation?.confidenceScore || 0}%
- Financial Score: ${analysisData?.analysis?.financial?.score || 'N/A'}
- Economic Moat: ${analysisData?.analysis?.businessModel?.economicMoat || 'N/A'}
- Overall Risk: ${analysisData?.analysis?.risk?.overallRiskScore || 'N/A'}

Key Strengths:
${analysisData?.analysis?.swot?.strengths?.join('\n- ') || 'N/A'}

Key Risks:
${analysisData?.analysis?.swot?.threats?.join('\n- ') || 'N/A'}

Write a professional executive summary that highlights:
1. Company overview and competitive position
2. Key financial health indicators
3. Growth prospects and challenges
4. Final recommendation with confidence level
`;

    const response = await llm.invoke([
      new SystemMessage('You are a senior investment analyst writing executive summaries.'),
      new HumanMessage(prompt)
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: response.content,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Executive summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error generating executive summary'
    });
  }
};

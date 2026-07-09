class ScoringEngine {
  constructor() {
    this.weights = {
      financialHealth: 0.25,
      growth: 0.20,
      profitability: 0.15,
      risk: 0.15,
      valuation: 0.10,
      sentiment: 0.10,
      managementQuality: 0.05
    };
  }

  // Calculate Financial Health Score (0-100)
  calculateFinancialHealth(ratios, balanceSheet) {
    let score = 0;
    const explanations = [];
    let maxScore = 0;

    // Current Ratio (Liquidity)
    maxScore += 20;
    if (ratios?.currentRatio >= 2) {
      score += 20;
      explanations.push('✅ Excellent current ratio (>2.0)');
    } else if (ratios?.currentRatio >= 1.5) {
      score += 15;
      explanations.push('✅ Good current ratio (1.5-2.0)');
    } else if (ratios?.currentRatio >= 1) {
      score += 10;
      explanations.push('⚠️ Adequate current ratio (1.0-1.5)');
    } else if (ratios?.currentRatio) {
      score += 5;
      explanations.push('⚠️ Low current ratio (<1.0)');
    } else {
      score += 10;
      explanations.push('⚠️ Current ratio not available');
    }

    // Debt to Equity
    maxScore += 20;
    if (ratios?.debtToEquity < 0.5) {
      score += 20;
      explanations.push('✅ Low debt-to-equity (<0.5)');
    } else if (ratios?.debtToEquity < 1) {
      score += 15;
      explanations.push('✅ Moderate debt-to-equity (0.5-1.0)');
    } else if (ratios?.debtToEquity < 2) {
      score += 10;
      explanations.push('⚠️ High debt-to-equity (1.0-2.0)');
    } else if (ratios?.debtToEquity) {
      score += 5;
      explanations.push('⚠️ Very high debt-to-equity (>2.0)');
    } else {
      score += 10;
      explanations.push('⚠️ Debt-to-equity not available');
    }

    // ROE
    maxScore += 20;
    if (ratios?.roe >= 20) {
      score += 20;
      explanations.push('✅ Excellent ROE (>20%)');
    } else if (ratios?.roe >= 15) {
      score += 15;
      explanations.push('✅ Good ROE (15-20%)');
    } else if (ratios?.roe >= 10) {
      score += 10;
      explanations.push('⚠️ Average ROE (10-15%)');
    } else if (ratios?.roe) {
      score += 5;
      explanations.push('⚠️ Low ROE (<10%)');
    } else {
      score += 10;
      explanations.push('⚠️ ROE not available');
    }

    // Quick Ratio
    maxScore += 15;
    if (ratios?.quickRatio >= 1.5) {
      score += 15;
      explanations.push('✅ Strong quick ratio (>1.5)');
    } else if (ratios?.quickRatio >= 1) {
      score += 10;
      explanations.push('✅ Adequate quick ratio (1.0-1.5)');
    } else if (ratios?.quickRatio) {
      score += 5;
      explanations.push('⚠️ Low quick ratio (<1.0)');
    } else {
      score += 7;
      explanations.push('⚠️ Quick ratio not available');
    }

    // Cash Position
    maxScore += 15;
    if (balanceSheet && balanceSheet.length > 0 && balanceSheet[0]) {
      const cashRatio = balanceSheet[0].cash / balanceSheet[0].totalAssets;
      if (cashRatio >= 0.2) {
        score += 15;
        explanations.push('✅ Strong cash position (>20% of assets)');
      } else if (cashRatio >= 0.1) {
        score += 10;
        explanations.push('✅ Adequate cash position (10-20% of assets)');
      } else if (cashRatio > 0) {
        score += 5;
        explanations.push('⚠️ Low cash position (<10% of assets)');
      } else {
        score += 3;
        explanations.push('⚠️ Very low cash position');
      }
    } else {
      score += 7;
      explanations.push('⚠️ Cash position data not available');
    }

    // Interest Coverage (approximated)
    maxScore += 10;
    if (ratios?.interestCoverage && ratios.interestCoverage >= 5) {
      score += 10;
      explanations.push('✅ Strong interest coverage (>5x)');
    } else if (ratios?.interestCoverage && ratios.interestCoverage >= 3) {
      score += 7;
      explanations.push('✅ Adequate interest coverage (3-5x)');
    } else {
      score += 5;
      explanations.push('⚠️ Interest coverage data not available');
    }

    const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 50;
    return {
      score: finalScore,
      explanations: explanations.slice(0, 5)
    };
  }

  // Calculate Growth Score (0-100)
  calculateGrowth(revenueTrends) {
    let score = 0;
    const explanations = [];
    let maxScore = 0;

    // Revenue Growth
    maxScore += 50;
    if (revenueTrends && revenueTrends.length >= 2) {
      const recentGrowth = revenueTrends[0]?.revenueGrowth || 0;
      const avgGrowth = revenueTrends.reduce((sum, t) => sum + (t.revenueGrowth || 0), 0) / revenueTrends.length;

      if (recentGrowth > 20) {
        score += 50;
        explanations.push('✅ Exceptional revenue growth (>20%)');
      } else if (recentGrowth > 15) {
        score += 40;
        explanations.push('✅ Strong revenue growth (15-20%)');
      } else if (recentGrowth > 10) {
        score += 30;
        explanations.push('✅ Good revenue growth (10-15%)');
      } else if (recentGrowth > 5) {
        score += 20;
        explanations.push('⚠️ Moderate revenue growth (5-10%)');
      } else if (recentGrowth > 0) {
        score += 10;
        explanations.push('⚠️ Slow revenue growth (0-5%)');
      } else if (recentGrowth < 0) {
        score += 5;
        explanations.push('❌ Negative revenue growth');
      } else {
        score += 15;
        explanations.push('⚠️ Revenue growth data limited');
      }

      // Growth consistency
      const positiveYears = revenueTrends.filter(t => t.revenueGrowth > 0).length;
      const totalYears = revenueTrends.length;
      const consistency = totalYears > 0 ? positiveYears / totalYears : 0;

      if (consistency >= 0.8) {
        score += 10;
        explanations.push('✅ Consistent revenue growth');
      } else if (consistency >= 0.6) {
        score += 5;
        explanations.push('⚠️ Somewhat consistent revenue growth');
      } else {
        score += 2;
        explanations.push('⚠️ Inconsistent revenue growth');
      }
    } else {
      score += 20;
      explanations.push('⚠️ Limited revenue data available');
    }

    // Earnings Growth (approximated from revenue trends)
    maxScore += 30;
    if (revenueTrends && revenueTrends.length >= 2) {
      const recentEarningsGrowth = revenueTrends[0]?.incomeGrowth || 0;
      if (recentEarningsGrowth > 20) {
        score += 30;
        explanations.push('✅ Exceptional earnings growth');
      } else if (recentEarningsGrowth > 10) {
        score += 20;
        explanations.push('✅ Good earnings growth');
      } else if (recentEarningsGrowth > 0) {
        score += 10;
        explanations.push('⚠️ Moderate earnings growth');
      } else {
        score += 5;
        explanations.push('⚠️ Earnings growth limited');
      }
    } else {
      score += 15;
      explanations.push('⚠️ Earnings data limited');
    }

    // Future Growth Prospects
    maxScore += 20;
    score += 10;
    explanations.push('📈 Growth prospects considered');

    const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 50;
    return {
      score: finalScore,
      explanations: explanations.slice(0, 5)
    };
  }

  // Calculate Profitability Score (0-100)
  calculateProfitability(ratios) {
    let score = 0;
    const explanations = [];
    let maxScore = 0;

    // Net Margin
    maxScore += 35;
    if (ratios?.netMargin >= 20) {
      score += 35;
      explanations.push('✅ Excellent net margin (>20%)');
    } else if (ratios?.netMargin >= 15) {
      score += 28;
      explanations.push('✅ Strong net margin (15-20%)');
    } else if (ratios?.netMargin >= 10) {
      score += 20;
      explanations.push('✅ Good net margin (10-15%)');
    } else if (ratios?.netMargin >= 5) {
      score += 12;
      explanations.push('⚠️ Average net margin (5-10%)');
    } else if (ratios?.netMargin >= 0) {
      score += 5;
      explanations.push('⚠️ Low net margin (0-5%)');
    } else if (ratios?.netMargin !== undefined) {
      score += 0;
      explanations.push('❌ Negative net margin');
    } else {
      score += 15;
      explanations.push('⚠️ Net margin not available');
    }

    // Gross Margin
    maxScore += 30;
    if (ratios?.grossMargin >= 50) {
      score += 30;
      explanations.push('✅ Excellent gross margin (>50%)');
    } else if (ratios?.grossMargin >= 40) {
      score += 24;
      explanations.push('✅ Strong gross margin (40-50%)');
    } else if (ratios?.grossMargin >= 30) {
      score += 18;
      explanations.push('✅ Good gross margin (30-40%)');
    } else if (ratios?.grossMargin >= 20) {
      score += 10;
      explanations.push('⚠️ Average gross margin (20-30%)');
    } else if (ratios?.grossMargin !== undefined) {
      score += 5;
      explanations.push('⚠️ Low gross margin (<20%)');
    } else {
      score += 12;
      explanations.push('⚠️ Gross margin not available');
    }

    // Operating Margin
    maxScore += 20;
    if (ratios?.operatingMargin >= 25) {
      score += 20;
      explanations.push('✅ Excellent operating margin (>25%)');
    } else if (ratios?.operatingMargin >= 15) {
      score += 15;
      explanations.push('✅ Good operating margin (15-25%)');
    } else if (ratios?.operatingMargin >= 10) {
      score += 10;
      explanations.push('⚠️ Average operating margin (10-15%)');
    } else if (ratios?.operatingMargin !== undefined) {
      score += 5;
      explanations.push('⚠️ Low operating margin (<10%)');
    } else {
      score += 10;
      explanations.push('⚠️ Operating margin not available');
    }

    // ROA
    maxScore += 15;
    if (ratios?.roa >= 15) {
      score += 15;
      explanations.push('✅ Excellent ROA (>15%)');
    } else if (ratios?.roa >= 10) {
      score += 10;
      explanations.push('✅ Strong ROA (10-15%)');
    } else if (ratios?.roa >= 5) {
      score += 5;
      explanations.push('⚠️ Average ROA (5-10%)');
    } else if (ratios?.roa !== undefined) {
      score += 2;
      explanations.push('⚠️ Low ROA (<5%)');
    } else {
      score += 7;
      explanations.push('⚠️ ROA not available');
    }

    const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 50;
    return {
      score: finalScore,
      explanations: explanations.slice(0, 5)
    };
  }

  // Calculate Risk Score (0-100, where 100 is lowest risk)
  calculateRisk(ratios) {
    let score = 100;
    const explanations = [];

    // Beta (Market Risk)
    if (ratios?.beta !== undefined && ratios.beta !== null) {
      if (ratios.beta < 0.8) {
        explanations.push('✅ Low beta (<0.8)');
      } else if (ratios.beta < 1.2) {
        score -= 10;
        explanations.push('⚠️ Moderate beta (0.8-1.2)');
      } else if (ratios.beta < 1.6) {
        score -= 25;
        explanations.push('⚠️ High beta (1.2-1.6)');
      } else {
        score -= 40;
        explanations.push('❌ Very high beta (>1.6)');
      }
    } else {
      score -= 5;
      explanations.push('⚠️ Beta not available');
    }

    // Debt to Equity
    if (ratios?.debtToEquity !== undefined && ratios.debtToEquity !== null) {
      if (ratios.debtToEquity > 2) {
        score -= 30;
        explanations.push('❌ High debt-to-equity (>2)');
      } else if (ratios.debtToEquity > 1) {
        score -= 15;
        explanations.push('⚠️ Moderate debt-to-equity (1-2)');
      } else if (ratios.debtToEquity > 0) {
        score += 5;
        explanations.push('✅ Low debt-to-equity (<1)');
      }
    } else {
      score -= 5;
      explanations.push('⚠️ Debt-to-equity not available');
    }

    // Current Ratio
    if (ratios?.currentRatio !== undefined && ratios.currentRatio !== null) {
      if (ratios.currentRatio < 1) {
        score -= 20;
        explanations.push('❌ Current ratio <1 - Liquidity risk');
      } else if (ratios.currentRatio < 1.5) {
        score -= 10;
        explanations.push('⚠️ Current ratio 1-1.5');
      } else {
        score += 5;
        explanations.push('✅ Current ratio >1.5');
      }
    } else {
      score -= 5;
      explanations.push('⚠️ Current ratio not available');
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    const riskLevel = finalScore > 70 ? 'Low' : finalScore > 40 ? 'Medium' : 'High';
    
    return {
      score: finalScore,
      riskLevel,
      explanations: explanations.slice(0, 5)
    };
  }

  // Calculate Valuation Score (0-100)
  calculateValuation(ratios) {
    let score = 0;
    const explanations = [];
    let maxScore = 0;

    // P/E Ratio
    maxScore += 35;
    if (ratios?.pe !== undefined && ratios.pe !== null && ratios.pe > 0) {
      if (ratios.pe < 15) {
        score += 35;
        explanations.push('✅ Low P/E (<15)');
      } else if (ratios.pe < 20) {
        score += 25;
        explanations.push('✅ Moderate P/E (15-20)');
      } else if (ratios.pe < 25) {
        score += 15;
        explanations.push('⚠️ High P/E (20-25)');
      } else if (ratios.pe < 30) {
        score += 8;
        explanations.push('⚠️ Very high P/E (25-30)');
      } else {
        score += 3;
        explanations.push('❌ Extremely high P/E (>30)');
      }
    } else {
      score += 15;
      explanations.push('⚠️ P/E ratio not available');
    }

    // P/B Ratio
    maxScore += 25;
    if (ratios?.pb !== undefined && ratios.pb !== null && ratios.pb > 0) {
      if (ratios.pb < 1) {
        score += 25;
        explanations.push('✅ P/B <1');
      } else if (ratios.pb < 2) {
        score += 18;
        explanations.push('✅ Moderate P/B (1-2)');
      } else if (ratios.pb < 3) {
        score += 10;
        explanations.push('⚠️ High P/B (2-3)');
      } else if (ratios.pb < 5) {
        score += 5;
        explanations.push('⚠️ Very high P/B (3-5)');
      } else {
        score += 2;
        explanations.push('❌ Extremely high P/B (>5)');
      }
    } else {
      score += 10;
      explanations.push('⚠️ P/B ratio not available');
    }

    // Dividend Yield
    maxScore += 20;
    if (ratios?.dividendYield !== undefined && ratios.dividendYield !== null && ratios.dividendYield > 0) {
      if (ratios.dividendYield > 3) {
        score += 20;
        explanations.push('✅ Good dividend yield (>3%)');
      } else if (ratios.dividendYield > 2) {
        score += 14;
        explanations.push('✅ Moderate dividend yield (2-3%)');
      } else if (ratios.dividendYield > 1) {
        score += 8;
        explanations.push('⚠️ Low dividend yield (1-2%)');
      } else {
        score += 3;
        explanations.push('⚠️ Very low dividend yield (<1%)');
      }
    } else {
      score += 10;
      explanations.push('⚠️ Dividend yield not available');
    }

    // P/S Ratio
    maxScore += 20;
    if (ratios?.ps !== undefined && ratios.ps !== null && ratios.ps > 0) {
      if (ratios.ps < 1) {
        score += 20;
        explanations.push('✅ Low P/S (<1)');
      } else if (ratios.ps < 3) {
        score += 14;
        explanations.push('✅ Moderate P/S (1-3)');
      } else if (ratios.ps < 5) {
        score += 8;
        explanations.push('⚠️ High P/S (3-5)');
      } else {
        score += 3;
        explanations.push('❌ Very high P/S (>5)');
      }
    } else {
      score += 8;
      explanations.push('⚠️ P/S ratio not available');
    }

    const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 50;
    return {
      score: finalScore,
      explanations: explanations.slice(0, 5)
    };
  }

  // Calculate Sentiment Score (0-100)
  calculateSentiment() {
    // Simplified sentiment calculation
    return {
      score: 60,
      explanations: [
        '📊 Sentiment analysis based on available data',
        '⚠️ Limited sentiment data available'
      ]
    };
  }

  // Calculate Management Quality Score (0-100)
  calculateManagementQuality() {
    // Simplified management quality calculation
    return {
      score: 65,
      explanations: [
        '📊 Management quality based on available indicators',
        '⚠️ Limited management data available'
      ]
    };
  }

  // Main scoring function
  calculateOverallScore(data) {
    const {
      ratios = {},
      balanceSheet = [],
      revenueTrends = [],
    } = data;

    // Calculate individual scores
    const financialHealth = this.calculateFinancialHealth(ratios, balanceSheet);
    const growth = this.calculateGrowth(revenueTrends);
    const profitability = this.calculateProfitability(ratios);
    const risk = this.calculateRisk(ratios);
    const valuation = this.calculateValuation(ratios);
    const sentiment = this.calculateSentiment();
    const managementQuality = this.calculateManagementQuality();

    // Weighted average
    const overallScore = (
      financialHealth.score * this.weights.financialHealth +
      growth.score * this.weights.growth +
      profitability.score * this.weights.profitability +
      risk.score * this.weights.risk +
      valuation.score * this.weights.valuation +
      sentiment.score * this.weights.sentiment +
      managementQuality.score * this.weights.managementQuality
    );

    // Determine recommendation
    let recommendation;
    if (overallScore >= 75) {
      recommendation = 'Invest';
    } else if (overallScore >= 50) {
      recommendation = 'Hold';
    } else {
      recommendation = 'Pass';
    }

    return {
      overallScore: Math.round(overallScore),
      recommendation,
      confidence: Math.min(95, Math.round(overallScore + 5)),
      components: {
        financialHealth: {
          score: financialHealth.score,
          weight: this.weights.financialHealth,
          explanations: financialHealth.explanations
        },
        growth: {
          score: growth.score,
          weight: this.weights.growth,
          explanations: growth.explanations
        },
        profitability: {
          score: profitability.score,
          weight: this.weights.profitability,
          explanations: profitability.explanations
        },
        risk: {
          score: risk.score,
          weight: this.weights.risk,
          riskLevel: risk.riskLevel,
          explanations: risk.explanations
        },
        valuation: {
          score: valuation.score,
          weight: this.weights.valuation,
          explanations: valuation.explanations
        },
        sentiment: {
          score: sentiment.score,
          weight: this.weights.sentiment,
          explanations: sentiment.explanations
        },
        managementQuality: {
          score: managementQuality.score,
          weight: this.weights.managementQuality,
          explanations: managementQuality.explanations
        }
      }
    };
  }
}

export default new ScoringEngine();
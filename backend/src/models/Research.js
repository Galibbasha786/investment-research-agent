import mongoose from 'mongoose';

const researchSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  companySymbol: {
    type: String,
    trim: true,
    uppercase: true
  },
  analysisDate: {
    type: Date,
    default: Date.now
  },
  
  // Company Profile
  companyProfile: {
    name: String,
    symbol: String,
    industry: String,
    sector: String,
    description: String,
    website: String,
    employees: Number,
    foundedYear: Number,
    headquarters: String,
    ceo: String
  },
  
  // Financial Data
  financialData: {
    revenue: {
      current: Number,
      previous: Number,
      growth: Number,
      history: [{
        year: Number,
        value: Number,
        revenue: Number,
        grossProfit: Number,
        operatingIncome: Number,
        netIncome: Number,
        eps: Number,
        revenueGrowth: Number,
        incomeGrowth: Number
      }]
    },
    profit: {
      current: Number,
      previous: Number,
      growth: Number,
      history: [{
        year: Number,
        value: Number
      }]
    },
    assets: {
      current: Number,
      previous: Number
    },
    liabilities: {
      current: Number,
      previous: Number
    },
    equity: {
      current: Number,
      previous: Number
    },
    cashFlow: [{
      year: Number,
      operatingCashFlow: Number,
      investingCashFlow: Number,
      financingCashFlow: Number,
      freeCashFlow: Number,
      capitalExpenditures: Number
    }],
    balanceSheet: [{
      year: Number,
      totalAssets: Number,
      totalLiabilities: Number,
      totalEquity: Number,
      currentAssets: Number,
      currentLiabilities: Number,
      longTermDebt: Number,
      cash: Number,
      inventory: Number
    }]
  },
  
  // Ratio Analysis
  ratios: {
    pe: Number,
    pb: Number,
    ps: Number,
    pcf: Number,
    roe: Number,
    roa: Number,
    currentRatio: Number,
    quickRatio: Number,
    debtToEquity: Number,
    grossMargin: Number,
    netMargin: Number,
    operatingMargin: Number
  },
  
  // News and Sentiment
  newsData: [{
    title: String,
    source: String,
    url: String,
    date: Date,
    sentiment: String,
    relevance: Number
  }],
  sentimentAnalysis: {
    overall: String,
    score: Number,
    bullishSignals: [String],
    bearishSignals: [String]
  },
  
  // Insider Trading
  insiderTrading: [{
    insiderName: String,
    transactionType: String,
    shares: Number,
    price: Number,
    date: Date,
    filingDate: Date
  }],
  
  // Scoring
  scores: {
    financialHealth: {
      score: Number,
      weight: {
        type: Number,
        default: 0.25
      },
      explanation: String
    },
    growth: {
      score: Number,
      weight: {
        type: Number,
        default: 0.20
      },
      explanation: String
    },
    profitability: {
      score: Number,
      weight: {
        type: Number,
        default: 0.15
      },
      explanation: String
    },
    risk: {
      score: Number,
      weight: {
        type: Number,
        default: 0.15
      },
      explanation: String
    },
    valuation: {
      score: Number,
      weight: {
        type: Number,
        default: 0.10
      },
      explanation: String
    },
    sentiment: {
      score: Number,
      weight: {
        type: Number,
        default: 0.10
      },
      explanation: String
    },
    managementQuality: {
      score: Number,
      weight: {
        type: Number,
        default: 0.05
      },
      explanation: String
    }
  },
  
  // Recommendation
  recommendation: {
    decision: {
      type: String,
      enum: ['Invest', 'Hold', 'Pass']
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100
    },
    summary: String,
    reasoning: [{
      factor: String,
      impact: String,
      details: String
    }],
    keyDrivers: [String],
    risksToMonitor: [String]
  },
  
  // Backtesting
  backtest: {
    simulatedReturn: Number,
    timePeriod: String,
    benchmarkComparison: Number,
    confidence: Number
  },
  // AI Analysis Results
  aiAnalysis: {
    company: {
      name: String,
      symbol: String,
      industry: String,
      description: String
    },
    analysis: {
      financial: {
        score: Number,
        strengths: [String],
        weaknesses: [String],
        redFlags: [String],
        assessment: String,
        recommendations: [String]
      },
      swot: {
        strengths: [String],
        weaknesses: [String],
        opportunities: [String],
        threats: [String]
      },
      businessModel: {
        description: String,
        revenueStreams: [String],
        customerSegments: [String],
        competitiveAdvantage: String,
        economicMoat: String,
        strengthScore: Number
      },
      risk: {
        riskScores: {
          financial: Number,
          business: Number,
          market: Number,
          regulatory: Number,
          competitive: Number,
          operational: Number
        },
        overallRiskScore: Number,
        keyRisks: [String],
        mitigationStrategies: [String]
      }
    },
    recommendation: {
      recommendation: {
        type: String,
        enum: ['Invest', 'Hold', 'Pass']
      },
      confidenceScore: Number,
      reasoning: [String],
      keyDrivers: [String],
      risksToMonitor: [String]
    },
    errors: [String],
    generatedAt: Date
  },
  
  // Metadata
  dataSources: [{
    name: String,
    type: String,
    reliability: Number
  }],
  processingTime: Number,
  modelVersion: String,
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
researchSchema.index({ user: 1, createdAt: -1 });
researchSchema.index({ companyName: 'text' });

// Method to get simplified version
researchSchema.methods.getSummary = function() {
  return {
    id: this._id,
    companyName: this.companyName,
    companySymbol: this.companySymbol,
    analysisDate: this.analysisDate,
    recommendation: this.recommendation,
    scores: this.scores,
    sentiment: this.sentimentAnalysis
  };
};

const Research = mongoose.model('Research', researchSchema);
export default Research;

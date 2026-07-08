import axios from 'axios';
import https from 'https';

const allowInsecureAlphaVantageTls = process.env.NODE_ENV !== 'production';

// Create axios instances with timeouts
const finnhubClient = axios.create({
  timeout: 10000,
  baseURL: 'https://finnhub.io/api/v1'
});

const alphaVantageClient = axios.create({
  timeout: 15000,
  baseURL: 'https://www.alphavantage.co',
  httpsAgent: allowInsecureAlphaVantageTls
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined
});

const secClient = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'ai-investment-agent local-dev contact@example.com'
  },
  httpsAgent: allowInsecureAlphaVantageTls
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined
});

let alphaVantageQueue = Promise.resolve();
let lastAlphaVantageCallAt = 0;
const ALPHA_VANTAGE_MIN_INTERVAL_MS = 1300;

// Helper function to get API keys safely
const getApiKeys = () => {
  const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
  const FINNHUB_KEY = process.env.FINNHUB_KEY;
  
  return { ALPHA_VANTAGE_KEY, FINNHUB_KEY };
};

const getAlphaVantageError = (data) => {
  if (!data) return 'No response from Alpha Vantage';
  return data.Note || data.Information || data.Error || data['Error Message'] || null;
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === '' || value === 'None' || value === '-') {
    return null;
  }

  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) return parsed;
  }

  return null;
};

const getFinnhubMetrics = async (symbol) => {
  const { FINNHUB_KEY } = getApiKeys();
  if (!FINNHUB_KEY) {
    throw new Error('Finnhub API key is not configured');
  }

  const data = await retryApiCall(async () => {
    const response = await finnhubClient.get('/stock/metric', {
      params: {
        symbol: symbol.toUpperCase(),
        metric: 'all',
        token: FINNHUB_KEY
      }
    });
    return response.data;
  });

  if (!data?.metric || Object.keys(data.metric).length === 0) {
    throw new Error('No Finnhub metrics returned for this symbol');
  }

  return data.metric;
};

const mapFinnhubRatios = (metric) => ({
  pe: firstNumber(metric.peNormalizedAnnual, metric.peBasicExclExtraTTM, metric.peExclExtraAnnual),
  pb: firstNumber(metric.pbAnnual, metric.pbQuarterly),
  ps: firstNumber(metric.psAnnual, metric.psTTM),
  pcf: firstNumber(metric.pcfShareTTM, metric.pcfShareAnnual),
  roe: firstNumber(metric.roeTTM, metric.roeAnnual),
  roa: firstNumber(metric.roaTTM, metric.roaAnnual),
  currentRatio: firstNumber(metric.currentRatioAnnual, metric.currentRatioQuarterly),
  quickRatio: firstNumber(metric.quickRatioAnnual, metric.quickRatioQuarterly),
  debtToEquity: firstNumber(metric['totalDebt/totalEquityAnnual'], metric['totalDebt/totalEquityQuarterly']),
  grossMargin: firstNumber(metric.grossMarginTTM, metric.grossMarginAnnual),
  netMargin: firstNumber(metric.netProfitMarginTTM, metric.netProfitMarginAnnual),
  operatingMargin: firstNumber(metric.operatingMarginTTM, metric.operatingMarginAnnual),
  dividendYield: firstNumber(metric.dividendYieldIndicatedAnnual, metric.currentDividendYieldTTM),
  eps: firstNumber(metric.epsBasicExclExtraItemsTTM, metric.epsAnnual),
  beta: firstNumber(metric.beta),
  marketCap: firstNumber(metric.marketCapitalization),
  trailingPE: firstNumber(metric.peBasicExclExtraTTM),
  forwardPE: firstNumber(metric.forwardPE)
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchAlphaVantage = async (functionName, symbol) => {
  const { ALPHA_VANTAGE_KEY } = getApiKeys();
  if (!ALPHA_VANTAGE_KEY) {
    throw new Error('Alpha Vantage API key is not configured');
  }

  const run = async () => {
    const elapsed = Date.now() - lastAlphaVantageCallAt;
    if (elapsed < ALPHA_VANTAGE_MIN_INTERVAL_MS) {
      await wait(ALPHA_VANTAGE_MIN_INTERVAL_MS - elapsed);
    }

    lastAlphaVantageCallAt = Date.now();

    const response = await alphaVantageClient.get('/query', {
      params: {
        function: functionName,
        symbol: symbol.toUpperCase(),
        apikey: ALPHA_VANTAGE_KEY
      }
    });

    const data = response.data;
    const alphaVantageError = getAlphaVantageError(data);
    if (alphaVantageError) {
      throw new Error(alphaVantageError);
    }

    return data;
  };

  const request = alphaVantageQueue.then(run, run);
  alphaVantageQueue = request.catch(() => {});
  return request;
};

export const parseRevenueTrends = (incomeStatement) => {
  const annualReports = incomeStatement?.annualReports || [];
  if (annualReports.length === 0) {
    throw new Error('No income statement reports returned for this symbol');
  }

  const trends = annualReports.slice(0, 5).map(report => ({
    year: report.fiscalDateEnding ? new Date(report.fiscalDateEnding).getFullYear() : null,
    revenue: toNumber(report.totalRevenue) || 0,
    grossProfit: toNumber(report.grossProfit) || 0,
    operatingIncome: toNumber(report.operatingIncome) || 0,
    netIncome: toNumber(report.netIncome) || 0,
    eps: toNumber(report.eps) || 0
  }));

  for (let i = 0; i < trends.length - 1; i++) {
    const current = trends[i];
    const previous = trends[i + 1];

    current.revenueGrowth = previous.revenue > 0
      ? ((current.revenue - previous.revenue) / previous.revenue * 100)
      : 0;
    current.incomeGrowth = previous.netIncome > 0
      ? ((current.netIncome - previous.netIncome) / previous.netIncome * 100)
      : 0;
  }

  return trends;
};

export const parseCashFlowAnalysis = (cashFlowStatement) => {
  const annualReports = cashFlowStatement?.annualReports || [];
  if (annualReports.length === 0) {
    throw new Error('No cash flow reports returned for this symbol');
  }

  return annualReports.slice(0, 5).map(report => ({
    year: report.fiscalDateEnding ? new Date(report.fiscalDateEnding).getFullYear() : null,
    operatingCashFlow: toNumber(report.operatingCashflow) || 0,
    investingCashFlow: toNumber(report.cashflowFromInvestment) || 0,
    financingCashFlow: toNumber(report.cashflowFromFinancing) || 0,
    freeCashFlow: toNumber(report.freeCashFlow) || 0,
    capitalExpenditures: Math.abs(toNumber(report.capitalExpenditures) || 0)
  }));
};

export const parseBalanceSheetHealth = (balanceSheetStatement) => {
  const annualReports = balanceSheetStatement?.annualReports || [];
  if (annualReports.length === 0) {
    throw new Error('No balance sheet reports returned for this symbol');
  }

  return annualReports.slice(0, 5).map(report => ({
    year: report.fiscalDateEnding ? new Date(report.fiscalDateEnding).getFullYear() : null,
    totalAssets: toNumber(report.totalAssets) || 0,
    totalLiabilities: toNumber(report.totalLiabilities) || 0,
    totalEquity: toNumber(report.totalShareholderEquity) || 0,
    currentAssets: toNumber(report.totalCurrentAssets) || 0,
    currentLiabilities: toNumber(report.totalCurrentLiabilities) || 0,
    longTermDebt: toNumber(report.longTermDebt) || 0,
    cash: firstNumber(report.cashAndCashEquivalentsAtCarryingValue, report.cashAndCashEquivalents) || 0,
    inventory: toNumber(report.inventory) || 0
  }));
};

let secTickerCache = null;
const commonSecCiks = {
  AAPL: '0000320193',
  MSFT: '0000789019',
  GOOGL: '0001652044',
  GOOG: '0001652044',
  AMZN: '0001018724',
  META: '0001326801',
  NVDA: '0001045810',
  TSLA: '0001318605',
  NFLX: '0001065280',
  AMD: '0000002488',
  INTC: '0000050863',
  IBM: '0000051143',
  ORCL: '0001341439',
  CRM: '0001108524',
  ADBE: '0000796343',
  PYPL: '0001633917',
  JPM: '0000019617',
  BAC: '0000070858',
  WMT: '0000104169',
  DIS: '0001744489',
  KO: '0000021344',
  PEP: '0000077476',
  MCD: '0000063908',
  NKE: '0000320187',
  COST: '0000909832',
  HD: '0000354950',
  V: '0001403161',
  MA: '0001141391',
  UNH: '0000731766',
  JNJ: '0000200406',
  PFE: '0000078003',
  XOM: '0000034088',
  CVX: '0000093410'
};

const getSecTickerMap = async () => {
  if (secTickerCache) return secTickerCache;

  const response = await retryApiCall(() => secClient.get('https://www.sec.gov/files/company_tickers.json'));
  secTickerCache = Object.values(response.data).reduce((map, company) => {
    map[company.ticker.toUpperCase()] = String(company.cik_str).padStart(10, '0');
    return map;
  }, {});

  return secTickerCache;
};

const getSecCompanyFacts = async (symbol) => {
  const normalizedSymbol = symbol.toUpperCase();
  let cik = commonSecCiks[normalizedSymbol];

  if (!cik) {
    const tickerMap = await getSecTickerMap();
    cik = tickerMap[normalizedSymbol];
  }

  if (!cik) {
    throw new Error('SEC company facts are only available for US-listed companies with a CIK');
  }

  const response = await retryApiCall(() => secClient.get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`));
  return response.data?.facts?.['us-gaap'] || {};
};

const getFactUnits = (facts, concepts, preferredUnit = 'USD') => {
  for (const concept of concepts) {
    const units = facts[concept]?.units;
    if (!units) continue;

    if (units[preferredUnit]) return units[preferredUnit];

    const fallback = Object.values(units).find(values => Array.isArray(values));
    if (fallback) return fallback;
  }

  return [];
};

const annualFactMap = (facts, concepts, preferredUnit = 'USD') => {
  const values = getFactUnits(facts, concepts, preferredUnit)
    .filter(item => (
      typeof item.val === 'number'
      && item.fy
      && item.fp === 'FY'
      && typeof item.form === 'string'
      && item.form.startsWith('10-K')
    ))
    .sort((a, b) => (
      Number(b.fy) - Number(a.fy)
      || new Date(b.filed || 0) - new Date(a.filed || 0)
    ));

  return values.reduce((map, item) => {
    const year = Number(item.fy);
    if (!map.has(year)) {
      map.set(year, item.val);
    }
    return map;
  }, new Map());
};

const mapValue = (map, year) => map.get(year) || 0;

export const getSecFinancialFallback = async (symbol) => {
  const facts = await getSecCompanyFacts(symbol);

  const revenue = annualFactMap(facts, [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet'
  ]);
  const grossProfit = annualFactMap(facts, ['GrossProfit']);
  const operatingIncome = annualFactMap(facts, ['OperatingIncomeLoss']);
  const netIncome = annualFactMap(facts, ['NetIncomeLoss', 'ProfitLoss']);

  const operatingCashFlow = annualFactMap(facts, ['NetCashProvidedByUsedInOperatingActivities']);
  const investingCashFlow = annualFactMap(facts, ['NetCashProvidedByUsedInInvestingActivities']);
  const financingCashFlow = annualFactMap(facts, ['NetCashProvidedByUsedInFinancingActivities']);
  const capex = annualFactMap(facts, [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets'
  ]);

  const assets = annualFactMap(facts, ['Assets']);
  const liabilities = annualFactMap(facts, ['Liabilities']);
  const equity = annualFactMap(facts, ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']);
  const currentAssets = annualFactMap(facts, ['AssetsCurrent']);
  const currentLiabilities = annualFactMap(facts, ['LiabilitiesCurrent']);
  const longTermDebt = annualFactMap(facts, ['LongTermDebtNoncurrent', 'LongTermDebt']);
  const cash = annualFactMap(facts, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']);
  const inventory = annualFactMap(facts, ['InventoryNet']);

  const years = [...new Set([
    ...revenue.keys(),
    ...operatingCashFlow.keys(),
    ...assets.keys()
  ])].sort((a, b) => b - a).slice(0, 5);

  if (years.length === 0) {
    throw new Error('No SEC annual financial facts returned for this symbol');
  }

  const revenueTrends = years.map(year => ({
    year,
    revenue: mapValue(revenue, year),
    grossProfit: mapValue(grossProfit, year),
    operatingIncome: mapValue(operatingIncome, year),
    netIncome: mapValue(netIncome, year),
    eps: 0
  }));

  for (let i = 0; i < revenueTrends.length - 1; i++) {
    const current = revenueTrends[i];
    const previous = revenueTrends[i + 1];

    current.revenueGrowth = previous.revenue > 0
      ? ((current.revenue - previous.revenue) / previous.revenue * 100)
      : 0;
    current.incomeGrowth = previous.netIncome > 0
      ? ((current.netIncome - previous.netIncome) / previous.netIncome * 100)
      : 0;
  }

  return {
    revenueTrends,
    cashFlow: years.map(year => {
      const capitalExpenditures = Math.abs(mapValue(capex, year));
      return {
        year,
        operatingCashFlow: mapValue(operatingCashFlow, year),
        investingCashFlow: mapValue(investingCashFlow, year),
        financingCashFlow: mapValue(financingCashFlow, year),
        freeCashFlow: mapValue(operatingCashFlow, year) - capitalExpenditures,
        capitalExpenditures
      };
    }),
    balanceSheet: years.map(year => ({
      year,
      totalAssets: mapValue(assets, year),
      totalLiabilities: mapValue(liabilities, year),
      totalEquity: mapValue(equity, year),
      currentAssets: mapValue(currentAssets, year),
      currentLiabilities: mapValue(currentLiabilities, year),
      longTermDebt: mapValue(longTermDebt, year),
      cash: mapValue(cash, year),
      inventory: mapValue(inventory, year)
    }))
  };
};

// Helper function to retry API calls
const retryApiCall = async (fn, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// Company search and autocomplete
export const searchCompanies = async (query) => {
  try {
    if (!query || query.length < 1) {
      throw new Error('Search query is required');
    }

    const { FINNHUB_KEY } = getApiKeys();
    
    if (!FINNHUB_KEY) {
      throw new Error('Finnhub API key is not configured. Please set FINNHUB_KEY in .env');
    }

    console.log('Searching companies for:', query);

    const result = await retryApiCall(async () => {
      const response = await finnhubClient.get('/search', {
        params: {
          q: query,
          token: FINNHUB_KEY
        }
      });
      return response.data;
    });

    console.log('Search result:', result);

    if (!result || !result.result) {
      console.warn('No results found for query:', query);
      return [];
    }

    // Filter and format results
    return result.result.slice(0, 10).map(item => ({
      symbol: item.symbol || '',
      description: item.description || '',
      type: item.type || 'Unknown',
      displaySymbol: item.displaySymbol || item.symbol
    }));
  } catch (error) {
    console.error('Company search error:', error.message);
    throw new Error(`Failed to search companies: ${error.message}`);
  }
};

// Get company profile
export const getCompanyProfile = async (symbol) => {
  try {
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    const { FINNHUB_KEY } = getApiKeys();
    if (!FINNHUB_KEY) {
      throw new Error('Finnhub API key is not configured');
    }

    const profile = await retryApiCall(async () => {
      const response = await finnhubClient.get('/stock/profile2', {
        params: {
          symbol: symbol.toUpperCase(),
          token: FINNHUB_KEY
        }
      });
      return response.data;
    });

    if (!profile || Object.keys(profile).length === 0) {
      throw new Error('Company profile not found');
    }

    return {
      symbol: profile.ticker || symbol,
      name: profile.name || '',
      description: profile.description || '',
      country: profile.country || '',
      currency: profile.currency || 'USD',
      exchange: profile.exchange || '',
      industry: profile.finnhubIndustry || '',
      ipo: profile.ipo || '',
      marketCap: profile.marketCapitalization || 0,
      logo: profile.logo || '',
      website: profile.weburl || ''
    };
  } catch (error) {
    console.error('Company profile error:', error.message);
    throw new Error(`Failed to fetch company profile: ${error.message}`);
  }
};

// Get company financials (income statement, balance sheet, cash flow)
export const getFinancials = async (symbol) => {
  try {
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    const errors = {};
    const income = await retryApiCall(() => fetchAlphaVantage('INCOME_STATEMENT', symbol)).catch(error => {
      errors.incomeStatement = error.message;
      return null;
    });
    const balance = await retryApiCall(() => fetchAlphaVantage('BALANCE_SHEET', symbol)).catch(error => {
      errors.balanceSheet = error.message;
      return null;
    });
    const cashflow = await retryApiCall(() => fetchAlphaVantage('CASH_FLOW', symbol)).catch(error => {
      errors.cashFlow = error.message;
      return null;
    });

    if (!income && !balance && !cashflow) {
      throw new Error(Object.values(errors).join(' | ') || 'No financial statements returned');
    }

    return {
      incomeStatement: income || {},
      balanceSheet: balance || {},
      cashFlow: cashflow || {},
      errors
    };
  } catch (error) {
    console.error('Financials error:', error.message);
    throw new Error(`Failed to fetch financial data: ${error.message}`);
  }
};

// Get key ratios
export const getKeyRatios = async (symbol) => {
  try {
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    try {
      const metric = await getFinnhubMetrics(symbol);
      const ratios = mapFinnhubRatios(metric);

      if (Object.values(ratios).some(value => value !== null)) {
        return ratios;
      }
    } catch (error) {
      console.warn('Finnhub ratios fetch failed, trying Alpha Vantage:', error.message);
    }

    const { ALPHA_VANTAGE_KEY } = getApiKeys();
    if (!ALPHA_VANTAGE_KEY) {
      throw new Error('Alpha Vantage API key is not configured');
    }

    const data = await retryApiCall(() => fetchAlphaVantage('OVERVIEW', symbol));

    if (!data || Object.keys(data).length === 0 || !data.Symbol) {
      throw new Error('No ratio data returned for this symbol');
    }

    // Extract key ratios from overview data
    return {
      pe: toNumber(data.PERatio || data.TrailingPE),
      pb: toNumber(data.PriceToBookRatio),
      ps: toNumber(data.PriceToSalesRatioTTM),
      pcf: toNumber(data.PriceToCashFlowRatio),
      roe: toNumber(data.ReturnOnEquityTTM),
      roa: toNumber(data.ReturnOnAssetsTTM),
      currentRatio: toNumber(data.CurrentRatio),
      quickRatio: toNumber(data.QuickRatio),
      debtToEquity: toNumber(data.DebtToEquityRatio),
      grossMargin: toNumber(data.GrossProfitMarginTTM),
      netMargin: toNumber(data.ProfitMargin),
      operatingMargin: toNumber(data.OperatingMarginTTM),
      dividendYield: toNumber(data.DividendYield),
      eps: toNumber(data.EPS || data.DilutedEPSTTM),
      beta: toNumber(data.Beta),
      marketCap: toNumber(data.MarketCapitalization),
      trailingPE: toNumber(data.TrailingPE),
      forwardPE: toNumber(data.ForwardPE)
    };
  } catch (error) {
    console.error('Ratios error:', error.message);
    throw new Error(`Failed to fetch key ratios: ${error.message}`);
  }
};

// Get revenue and profit trends
export const getRevenueTrends = async (symbol) => {
  try {
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    const data = await retryApiCall(() => fetchAlphaVantage('INCOME_STATEMENT', symbol));
    return parseRevenueTrends(data);
  } catch (error) {
    console.error('Revenue trends error:', error.message);
    throw new Error(`Failed to fetch revenue trends: ${error.message}`);
  }
};

// Get cash flow analysis
export const getCashFlowAnalysis = async (symbol) => {
  try {
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    const data = await retryApiCall(() => fetchAlphaVantage('CASH_FLOW', symbol));
    return parseCashFlowAnalysis(data);
  } catch (error) {
    console.error('Cash flow error:', error.message);
    throw new Error(`Failed to fetch cash flow data: ${error.message}`);
  }
};

// Get balance sheet health
export const getBalanceSheetHealth = async (symbol) => {
  try {
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    const data = await retryApiCall(() => fetchAlphaVantage('BALANCE_SHEET', symbol));
    return parseBalanceSheetHealth(data);
  } catch (error) {
    console.error('Balance sheet error:', error.message);
    throw new Error(`Failed to fetch balance sheet data: ${error.message}`);
  }
};

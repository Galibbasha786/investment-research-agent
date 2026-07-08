import fs from 'fs';
import path from 'path';
import axios from 'axios';
import mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expanded CIK mapping with more companies
const CIK_MAP = {
  // Tech
  'AAPL': '0000320193',
  'MSFT': '0000789019',
  'GOOGL': '0001652044',
  'GOOG': '0001652044',
  'AMZN': '0001018724',
  'META': '0001326801',
  'NVDA': '0001045810',
  'TSLA': '0001318605',
  'NFLX': '0001065280',
  'AMD': '0000002488',
  'INTC': '0000050863',
  'IBM': '0000051143',
  'ORCL': '0001341439',
  'CRM': '0001108524',
  'ADBE': '0000796343',
  'PYPL': '0001633917',
  'AMAT': '0000006951', // Applied Materials
  'LRCX': '0000707549', // Lam Research
  'KLAC': '0000319273', // KLA Corporation
  'ASML': '0000937966', // ASML Holding
  'TXN': '0000097476', // Texas Instruments
  'QCOM': '0000804328', // Qualcomm
  'AVGO': '0001730168', // Broadcom
  'MU': '0000723125', // Micron Technology
  'ADI': '0000006281', // Analog Devices
  
  // Financial
  'JPM': '0000019617',
  'BAC': '0000070858',
  'WFC': '0000072971',
  'C': '0000831001',
  'GS': '0000886982',
  'MS': '0000895421',
  'V': '0001403161',
  'MA': '0001141391',
  'AXP': '0000004962',
  'BLK': '0001364742',
  
  // Retail
  'WMT': '0000104169',
  'TGT': '0000027419',
  'COST': '0000909832',
  'HD': '0000354950',
  'LOW': '0000060667',
  'TJX': '0000109198',
  'ROST': '0000745732',
  'NKE': '0000320187',
  'MCD': '0000063908',
  'SBUX': '0000829224',
  
  // Healthcare
  'JNJ': '0000200406',
  'PFE': '0000078003',
  'MRK': '0000310158',
  'ABBV': '0001551152',
  'AMGN': '0000318154',
  'GILD': '0000882095',
  'UNH': '0000731766',
  'CVS': '0000064803',
  'CI': '0001739940',
  'HUM': '0000049071',
  
  // Energy
  'XOM': '0000034088',
  'CVX': '0000093410',
  'COP': '0001163165',
  'EOG': '0000821189',
  'SLB': '0000087347',
  'HAL': '0000045012',
  
  // Consumer
  'KO': '0000021344',
  'PEP': '0000077476',
  'PG': '0000080424',
  'CL': '0000021665',
  'KMB': '0000055785',
  'GIS': '0000040704',
  'MDLZ': '0001103982',
  
  // Industrial
  'CAT': '0000018230',
  'DE': '0000315189',
  'BA': '0000012927',
  'GE': '0000040545',
  'HON': '0000773840',
  'RTX': '0000101829',
  'LMT': '0000936468',
  
  // Communication
  'T': '0000732717',
  'VZ': '0000732712',
  'TMUS': '0001283699',
  'CMCSA': '0001166691',
  'DIS': '0001744489',
  
  // Auto
  'F': '0000037996',
  'GM': '0001467858',
  'TM': '0001094516',
  'HMC': '0000715153',
  
  // Other
  'UBER': '0001543151',
  'LYFT': '0001759509',
  'DASH': '0001792789',
  'SNOW': '0001640147',
  'PLTR': '0001321655',
  'SNAP': '0001564408',
  'TWTR': '0001418091',
  'PINS': '0001506293',
  'SQ': '0001512673',
  'SHOP': '0001594805',
  'SPOT': '0001639920',
  'DKNG': '0001883685',
  'RBLX': '0001310338',
  'U': '0001810556',
  'DOCU': '0001261333',
  'ZM': '0001585521',
  'CRWD': '0001535527',
  'OKTA': '0001667092',
  'MDB': '0001441816',
  'NET': '0001477333',
  'DDOG': '0001559720',
  'MELI': '0001099590',
  'SE': '0001703396',
  'BABA': '0001577552',
  'JD': '0001549802',
  'PDD': '0001737807',
  'TCEHY': '0001195897'
};

// Cache for CIK lookups
let cikCache = null;
let cikCacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export class DocumentService {
  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
    this.pdfParse = null;
  }

  async getPDFParse() {
    if (!this.pdfParse) {
      const pdfParseModule = await import('pdf-parse');
      this.pdfParse = pdfParseModule.default || pdfParseModule;
    }
    return this.pdfParse;
  }

  // Get CIK dynamically from SEC if not in cache
  async getCIKFromSEC(symbol) {
    try {
      const url = `https://www.sec.gov/files/company_tickers.json`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'AI Investment Agent contact@example.com',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const data = response.data;
      const tickerMap = Object.values(data).reduce((map, company) => {
        map[company.ticker.toUpperCase()] = String(company.cik_str).padStart(10, '0');
        return map;
      }, {});

      cikCache = tickerMap;
      cikCacheTime = Date.now();

      return tickerMap[symbol.toUpperCase()] || null;
    } catch (error) {
      console.error('Error fetching CIK from SEC:', error.message);
      return null;
    }
  }

  // Get CIK with fallback
  async getCIK(symbol) {
    const normalizedSymbol = symbol.toUpperCase();
    
    // Check static map first
    if (CIK_MAP[normalizedSymbol]) {
      return CIK_MAP[normalizedSymbol];
    }

    // Check cache
    if (cikCache && cikCacheTime && (Date.now() - cikCacheTime < CACHE_DURATION)) {
      return cikCache[normalizedSymbol] || null;
    }

    // Fetch from SEC
    const cik = await this.getCIKFromSEC(normalizedSymbol);
    if (cik) {
      console.log(`✅ Found CIK ${cik} for ${normalizedSymbol} from SEC`);
      return cik;
    }

    console.warn(`⚠️ No CIK found for symbol: ${normalizedSymbol}`);
    return null;
  }

  // Fetch annual report from SEC EDGAR
  async fetchSECFiling(symbol, filingType = '10-K') {
    try {
      const cik = await this.getCIK(symbol);
      if (!cik) {
        throw new Error(`No CIK found for symbol: ${symbol}. Try a different company like AAPL, MSFT, or GOOGL.`);
      }

      console.log(`📡 Fetching SEC filing for ${symbol} (CIK: ${cik})...`);

      const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'AI Investment Agent contact@example.com',
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      if (!response.data || Object.keys(response.data).length === 0) {
        throw new Error(`No data returned from SEC for ${symbol}`);
      }

      return response.data;
    } catch (error) {
      console.error('SEC filing fetch error:', error.message);
      if (error.response?.status === 404) {
        throw new Error(`SEC filing not found for ${symbol}. The company may not have filed a 10-K or may not be US-listed.`);
      }
      throw new Error(`Failed to fetch SEC filing: ${error.message}`);
    }
  }

  // Process PDF file
  async processPDF(filePath) {
    try {
      const pdfParse = await this.getPDFParse();
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      console.error('PDF processing error:', error.message);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  // Process DOCX file
  async processDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.error('DOCX processing error:', error.message);
      throw new Error(`Failed to process DOCX: ${error.message}`);
    }
  }

  // Process text file
  async processTXT(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('TXT processing error:', error.message);
      throw new Error(`Failed to process TXT: ${error.message}`);
    }
  }

  // Process any document by extension
  async processDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf':
        return await this.processPDF(filePath);
      case '.docx':
        return await this.processDOCX(filePath);
      case '.txt':
        return await this.processTXT(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  // Create chunks from text
  async createChunks(text, metadata = {}) {
    const docs = await this.textSplitter.createDocuments(
      [text],
      [metadata]
    );
    return docs;
  }

  // Create document from text
  createDocument(text, metadata = {}) {
    return new Document({
      pageContent: text,
      metadata: {
        ...metadata,
        id: uuidv4(),
        createdAt: new Date().toISOString()
      }
    });
  }

  // Parse annual report data into readable text
  parseAnnualReportData(data) {
    let text = '';
    
    try {
      if (data.facts?.['us-gaap']) {
        const facts = data.facts['us-gaap'];
        text += 'FINANCIAL STATEMENTS:\n\n';
        
        if (facts.RevenueFromContractWithCustomerExcludingAssessedTax?.units?.USD) {
          const revenues = facts.RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.slice(0, 5);
          text += 'Revenue (USD):\n';
          revenues.forEach(item => {
            text += `  FY${item.fy}: $${(item.val / 1e9).toFixed(2)}B\n`;
          });
          text += '\n';
        }

        if (facts.NetIncomeLoss?.units?.USD) {
          const incomes = facts.NetIncomeLoss.units.USD.slice(0, 5);
          text += 'Net Income (USD):\n';
          incomes.forEach(item => {
            text += `  FY${item.fy}: $${(item.val / 1e9).toFixed(2)}B\n`;
          });
          text += '\n';
        }

        if (facts.Assets?.units?.USD) {
          const assets = facts.Assets.units.USD.slice(0, 5);
          text += 'Total Assets (USD):\n';
          assets.forEach(item => {
            text += `  FY${item.fy}: $${(item.val / 1e9).toFixed(2)}B\n`;
          });
          text += '\n';
        }

        if (facts.Liabilities?.units?.USD) {
          const liabilities = facts.Liabilities.units.USD.slice(0, 5);
          text += 'Total Liabilities (USD):\n';
          liabilities.forEach(item => {
            text += `  FY${item.fy}: $${(item.val / 1e9).toFixed(2)}B\n`;
          });
          text += '\n';
        }

        if (facts.StockholdersEquity?.units?.USD) {
          const equities = facts.StockholdersEquity.units.USD.slice(0, 5);
          text += 'Shareholder Equity (USD):\n';
          equities.forEach(item => {
            text += `  FY${item.fy}: $${(item.val / 1e9).toFixed(2)}B\n`;
          });
          text += '\n';
        }

        if (facts.OperatingCashFlow?.units?.USD) {
          const cashFlows = facts.OperatingCashFlow.units.USD.slice(0, 5);
          text += 'Operating Cash Flow (USD):\n';
          cashFlows.forEach(item => {
            text += `  FY${item.fy}: $${(item.val / 1e9).toFixed(2)}B\n`;
          });
          text += '\n';
        }

        text += 'KEY FINANCIAL RATIOS (Recent Year):\n';
        
        const latestRevenue = facts.RevenueFromContractWithCustomerExcludingAssessedTax?.units?.USD?.[0];
        const latestAssets = facts.Assets?.units?.USD?.[0];
        const latestEquity = facts.StockholdersEquity?.units?.USD?.[0];
        const latestIncome = facts.NetIncomeLoss?.units?.USD?.[0];

        if (latestRevenue && latestAssets) {
          const assetTurnover = latestRevenue.val / latestAssets.val;
          text += `  Asset Turnover: ${assetTurnover.toFixed(2)}\n`;
        }

        if (latestIncome && latestRevenue) {
          const profitMargin = (latestIncome.val / latestRevenue.val) * 100;
          text += `  Profit Margin: ${profitMargin.toFixed(2)}%\n`;
        }

        if (latestIncome && latestEquity) {
          const roe = (latestIncome.val / latestEquity.val) * 100;
          text += `  Return on Equity: ${roe.toFixed(2)}%\n`;
        }

        if (latestIncome && latestAssets) {
          const roa = (latestIncome.val / latestAssets.val) * 100;
          text += `  Return on Assets: ${roa.toFixed(2)}%\n`;
        }

        text += '\n';
      }

      text += 'COMPANY INFORMATION:\n';
      text += `Symbol: ${data.symbol || 'N/A'}\n`;
      text += `Report Type: Annual Report (10-K)\n`;
      text += `Report Date: ${new Date().toISOString().split('T')[0]}\n`;
      text += '\n';

      text += 'DISCLAIMER: This data is sourced from SEC EDGAR filings and is for informational purposes only.';
      
    } catch (error) {
      console.error('Parse annual report error:', error.message);
      text = 'Error parsing annual report data. Please try again.';
    }

    return text;
  }

  // Create chunks from annual report
  async createAnnualReportChunks(symbol, reportData) {
    const text = this.parseAnnualReportData(reportData);
    const chunks = await this.createChunks(text, {
      source: 'SEC_EDGAR',
      symbol: symbol,
      type: 'annual_report',
      documentId: uuidv4()
    });
    return chunks;
  }

  // Download and process annual report from URL
  async processAnnualReportFromURL(url, symbol) {
    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'AI Investment Agent contact@example.com'
        },
        timeout: 30000
      });

      const tempPath = path.join('/tmp', `${symbol}_${Date.now()}.pdf`);
      fs.writeFileSync(tempPath, response.data);

      const text = await this.processPDF(tempPath);
      
      fs.unlinkSync(tempPath);

      return text;
    } catch (error) {
      console.error('Annual report processing error:', error.message);
      throw new Error(`Failed to process annual report: ${error.message}`);
    }
  }
}

export default new DocumentService();
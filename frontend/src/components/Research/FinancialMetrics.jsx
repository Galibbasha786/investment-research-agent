import React from 'react';
import './FinancialMetrics.css';

const FinancialMetrics = ({ ratios, cashFlow, balanceSheet }) => {
  const getLatest = (data, key) => {
    if (!data || data.length === 0) return 'N/A';
    const latest = data[0];
    return latest[key] !== undefined && latest[key] !== null ? latest[key].toLocaleString() : 'N/A';
  };

  const formatPercentage = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatNumber = (value) => {
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'string') return value;
    return value.toLocaleString();
  };

  return (
    <div className="financial-metrics">
      <h3>Financial Ratios</h3>
      <div className="ratios-grid">
        <div className="ratio-card">
          <span className="ratio-label">P/E Ratio</span>
          <span className="ratio-value">{formatNumber(ratios?.pe)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">P/B Ratio</span>
          <span className="ratio-value">{formatNumber(ratios?.pb)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">P/S Ratio</span>
          <span className="ratio-value">{formatNumber(ratios?.ps)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">ROE</span>
          <span className="ratio-value">{formatPercentage(ratios?.roe)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">ROA</span>
          <span className="ratio-value">{formatPercentage(ratios?.roa)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">Debt/Equity</span>
          <span className="ratio-value">{formatNumber(ratios?.debtToEquity)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">Current Ratio</span>
          <span className="ratio-value">{formatNumber(ratios?.currentRatio)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">Gross Margin</span>
          <span className="ratio-value">{formatPercentage(ratios?.grossMargin)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">Net Margin</span>
          <span className="ratio-value">{formatPercentage(ratios?.netMargin)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">Beta</span>
          <span className="ratio-value">{formatNumber(ratios?.beta)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">Dividend Yield</span>
          <span className="ratio-value">{formatPercentage(ratios?.dividendYield)}</span>
        </div>
        <div className="ratio-card">
          <span className="ratio-label">EPS</span>
          <span className="ratio-value">{ratios?.eps === undefined || ratios?.eps === null ? 'N/A' : `$${formatNumber(ratios.eps)}`}</span>
        </div>
      </div>

      <h3>Latest Cash Flow (Annual)</h3>
      {cashFlow && cashFlow.length > 0 ? (
        <div className="cashflow-grid">
          <div className="cashflow-item">
            <span className="cashflow-label">Operating Cash Flow</span>
            <span className="cashflow-value">
              ${getLatest(cashFlow, 'operatingCashFlow')}
            </span>
          </div>
          <div className="cashflow-item">
            <span className="cashflow-label">Free Cash Flow</span>
            <span className="cashflow-value">
              ${getLatest(cashFlow, 'freeCashFlow')}
            </span>
          </div>
          <div className="cashflow-item">
            <span className="cashflow-label">Capital Expenditures</span>
            <span className="cashflow-value">
              ${getLatest(cashFlow, 'capitalExpenditures')}
            </span>
          </div>
        </div>
      ) : (
        <p className="no-data">No cash flow data available</p>
      )}

      <h3>Balance Sheet Highlights</h3>
      {balanceSheet && balanceSheet.length > 0 ? (
        <div className="balance-grid">
          <div className="balance-item">
            <span className="balance-label">Total Assets</span>
            <span className="balance-value">
              ${getLatest(balanceSheet, 'totalAssets')}
            </span>
          </div>
          <div className="balance-item">
            <span className="balance-label">Total Liabilities</span>
            <span className="balance-value">
              ${getLatest(balanceSheet, 'totalLiabilities')}
            </span>
          </div>
          <div className="balance-item">
            <span className="balance-label">Total Equity</span>
            <span className="balance-value">
              ${getLatest(balanceSheet, 'totalEquity')}
            </span>
          </div>
          <div className="balance-item">
            <span className="balance-label">Cash & Equivalents</span>
            <span className="balance-value">
              ${getLatest(balanceSheet, 'cash')}
            </span>
          </div>
        </div>
      ) : (
        <p className="no-data">No balance sheet data available</p>
      )}
    </div>
  );
};

export default FinancialMetrics;

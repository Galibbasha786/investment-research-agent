import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import './TrendsChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TrendsChart = ({ revenueTrends, cashFlow }) => {
  if (!revenueTrends || revenueTrends.length === 0) {
    return (
      <div className="trends-chart">
        <p className="no-data">No trend data available</p>
      </div>
    );
  }

  const years = revenueTrends.map(item => item.year || 'N/A');
  const revenues = revenueTrends.map(item => item.revenue / 1e6); // In millions
  const netIncomes = revenueTrends.map(item => item.netIncome / 1e6);
  const eps = revenueTrends.map(item => item.eps);

  const revenueData = {
    labels: years,
    datasets: [
      {
        label: 'Revenue (Millions)',
        data: revenues,
        borderColor: '#6c5ce7',
        backgroundColor: 'rgba(108, 92, 231, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Net Income (Millions)',
        data: netIncomes,
        borderColor: '#00b894',
        backgroundColor: 'rgba(0, 184, 148, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const epsData = {
    labels: years,
    datasets: [
      {
        label: 'EPS',
        data: eps,
        backgroundColor: 'rgba(108, 92, 231, 0.8)',
        borderColor: '#6c5ce7',
        borderWidth: 2,
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: '#e8edf5',
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(10, 14, 26, 0.9)',
        borderColor: '#2a3a4f',
        borderWidth: 1,
        titleColor: '#e8edf5',
        bodyColor: '#8899b4'
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(42, 58, 79, 0.3)'
        },
        ticks: {
          color: '#8899b4'
        }
      },
      y: {
        grid: {
          color: 'rgba(42, 58, 79, 0.3)'
        },
        ticks: {
          color: '#8899b4'
        }
      }
    }
  };

  const barOptions = {
    ...options,
    plugins: {
      ...options.plugins,
      legend: {
        labels: {
          color: '#e8edf5',
          font: { size: 12 }
        }
      }
    }
  };

  return (
    <div className="trends-chart">
      <h3>Revenue & Income Trends</h3>
      <div className="chart-container">
        <Line data={revenueData} options={options} />
      </div>

      <h3>Earnings Per Share (EPS)</h3>
      <div className="chart-container">
        <Bar data={epsData} options={barOptions} />
      </div>
    </div>
  );
};

export default TrendsChart;
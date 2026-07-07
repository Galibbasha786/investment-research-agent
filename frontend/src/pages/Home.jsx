import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const features = [
    {
      icon: '🤖',
      title: 'Multi-Agent AI Analysis',
      description: 'Advanced LangGraph workflow with specialized AI agents for comprehensive company research'
    },
    {
      icon: '📊',
      title: 'Financial Intelligence',
      description: 'Deep financial analysis with ratios, cash flow, revenue trends, and balance sheet health'
    },
    {
      icon: '🎯',
      title: 'Smart Recommendations',
      description: 'Invest, Hold, or Pass decisions with transparent reasoning and confidence scoring'
    },
    {
      icon: '🔍',
      title: 'Explainable AI',
      description: 'Every conclusion is backed by evidence with citations and reasoning traces'
    },
    {
      icon: '📈',
      title: 'Real-time Insights',
      description: 'News aggregation, sentiment analysis, and insider trading monitoring'
    },
    {
      icon: '📄',
      title: 'Professional Reports',
      description: 'One-click PDF export with comprehensive analysis and recommendations'
    }
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot">●</span>
              AI-Powered Investment Research
            </div>
            <h1 className="hero-title">
              Make Smarter Investment
              <span className="gradient-text"> Decisions</span>
            </h1>
            <p className="hero-description">
              Our AI Investment Research Agent analyzes companies across multiple dimensions,
              providing transparent recommendations with detailed reasoning and evidence.
            </p>
            <div className="hero-buttons">
              <Link to="/register" className="hero-btn primary">
                Get Started Free
                <span className="btn-arrow">→</span>
              </Link>
              <Link to="/research" className="hero-btn secondary">
                View Demo
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">50+</span>
                <span className="stat-label">Analysis Features</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">95%</span>
                <span className="stat-label">Accuracy Rate</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">24/7</span>
                <span className="stat-label">Real-time Updates</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="floating-card card-1">
              <span className="card-icon">📈</span>
              <div className="card-data">
                <span className="card-value">+23.5%</span>
                <span className="card-label">Growth Score</span>
              </div>
            </div>
            <div className="floating-card card-2">
              <span className="card-icon">🏦</span>
              <div className="card-data">
                <span className="card-value">A+</span>
                <span className="card-label">ESG Rating</span>
              </div>
            </div>
            <div className="floating-card card-3">
              <span className="card-icon">🎯</span>
              <div className="card-data">
                <span className="card-value">85%</span>
                <span className="card-label">Confidence</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="section-header">
            <span className="section-badge">Features</span>
            <h2>Everything You Need for</h2>
            <h2 className="gradient-text">Investment Research</h2>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div 
                className="feature-card fade-in" 
                key={index}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="feature-icon-wrapper">
                  <span className="feature-icon">{feature.icon}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="cta-content">
            <h2>Ready to Start Your</h2>
            <h2 className="gradient-text">Investment Journey?</h2>
            <p>Join thousands of investors using AI to make better decisions</p>
            <Link to="/register" className="cta-btn">
              Start Researching Now
              <span className="btn-arrow">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, BarChart3, Target, Search, TrendingUp, FileText, ShieldCheck, Activity } from 'lucide-react';
import './Home.css';

const Home = () => {
  const features = [
    {
      icon: <Bot size={28} />,
      title: 'Multi-Agent AI Analysis',
      description: 'Advanced LangGraph workflow with specialized AI agents for comprehensive company research'
    },
    {
      icon: <BarChart3 size={28} />,
      title: 'Financial Intelligence',
      description: 'Deep financial analysis with ratios, cash flow, revenue trends, and balance sheet health'
    },
    {
      icon: <Target size={28} />,
      title: 'Smart Recommendations',
      description: 'Invest, Hold, or Pass decisions with transparent reasoning and confidence scoring'
    },
    {
      icon: <Search size={28} />,
      title: 'Explainable AI',
      description: 'Every conclusion is backed by evidence with citations and reasoning traces'
    },
    {
      icon: <TrendingUp size={28} />,
      title: 'Real-time Insights',
      description: 'News aggregation, sentiment analysis, and insider trading monitoring'
    },
    {
      icon: <FileText size={28} />,
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
              <span className="badge-dot" />
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
                <ArrowRight size={18} />
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
            <div className="terminal-panel">
              <div className="terminal-header">
                <span>Signal Engine</span>
                <Activity size={16} />
              </div>
              <div className="signal-row">
                <span>Valuation</span>
                <div className="signal-track"><span style={{ width: '72%' }} /></div>
                <strong>72</strong>
              </div>
              <div className="signal-row">
                <span>Growth</span>
                <div className="signal-track"><span style={{ width: '86%' }} /></div>
                <strong>86</strong>
              </div>
              <div className="signal-row">
                <span>Risk</span>
                <div className="signal-track warning"><span style={{ width: '41%' }} /></div>
                <strong>41</strong>
              </div>
            </div>
            <div className="floating-card card-1">
              <span className="card-icon">
                <TrendingUp size={24} />
              </span>
              <div className="card-data">
                <span className="card-value">+23.5%</span>
                <span className="card-label">Growth Score</span>
              </div>
            </div>
            <div className="floating-card card-2">
              <span className="card-icon">
                <ShieldCheck size={24} />
              </span>
              <div className="card-data">
                <span className="card-value">A+</span>
                <span className="card-label">ESG Rating</span>
              </div>
            </div>
            <div className="floating-card card-3">
              <span className="card-icon">
                <Target size={24} />
              </span>
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
                  <div className="feature-icon">{feature.icon}</div>
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
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

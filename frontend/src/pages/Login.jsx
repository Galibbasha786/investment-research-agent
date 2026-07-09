import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Bot, Lock, AlertCircle, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon">
              <Lock size={32} />
            </div>
            <h1>Welcome Back</h1>
            <p>Sign in to continue your investment research</p>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={20} style={{ marginRight: '8px' }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
            </div>

            <button 
              type="submit" 
              className="auth-btn"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-link">
                Create one now
              </Link>
            </p>
          </div>
        </div>

        <div className="auth-features">
          <div className="feature-item slide-in" style={{ animationDelay: '0.1s' }}>
            <span className="feature-icon"><Bot size={28} /></span>
            <h3>AI-Powered Research</h3>
            <p>Get deep insights with multi-agent AI analysis</p>
          </div>
          <div className="feature-item slide-in" style={{ animationDelay: '0.2s' }}>
            <span className="feature-icon"><BarChart3 size={28} /></span>
            <h3>Comprehensive Analytics</h3>
            <p>Financial ratios, trends, and sentiment analysis</p>
          </div>
          <div className="feature-item slide-in" style={{ animationDelay: '0.3s' }}>
            <span className="feature-icon"><Target size={28} /></span>
            <h3>Smart Recommendations</h3>
            <p>Invest, Hold, or Pass with transparent reasoning</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

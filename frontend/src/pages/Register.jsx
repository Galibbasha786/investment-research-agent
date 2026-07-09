import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, BarChart3, Database, UserPlus, Workflow } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const { register, error } = useAuth();
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

    const result = await register(formData.name, formData.email, formData.password);

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
              <UserPlus size={32} />
            </div>
            <h1>Create Account</h1>
            <p>Start tracking investment research with AI-powered analysis</p>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={20} style={{ marginRight: '8px' }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your name"
                required
                autoFocus
              />
            </div>

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
                placeholder="Create a password"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-btn"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="auth-features">
          <div className="feature-item slide-in" style={{ animationDelay: '0.1s' }}>
            <span className="feature-icon"><Workflow size={28} /></span>
            <h3>AI-Powered Research</h3>
            <p>Build company research with financial signals and agent analysis</p>
          </div>
          <div className="feature-item slide-in" style={{ animationDelay: '0.2s' }}>
            <span className="feature-icon"><BarChart3 size={28} /></span>
            <h3>Decision Scores</h3>
            <p>Compare valuation, profitability, growth, and risk in one view</p>
          </div>
          <div className="feature-item slide-in" style={{ animationDelay: '0.3s' }}>
            <span className="feature-icon"><Database size={28} /></span>
            <h3>Saved History</h3>
            <p>Keep research organized across companies and revisit it anytime</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

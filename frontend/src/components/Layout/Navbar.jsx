import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">
            <TrendingUp size={24} />
          </span>
          <span className="logo-text gradient-text">AI Invest</span>
        </Link>

        <div className="navbar-menu" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <span className="menu-bar"></span>
          <span className="menu-bar"></span>
          <span className="menu-bar"></span>
        </div>

        <ul className={`navbar-links ${isMenuOpen ? 'active' : ''}`}>
          {isAuthenticated ? (
            <>
              <li>
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
              </li>
              <li>
                <Link to="/research" className="nav-link">Research</Link>
              </li>
              <li className="nav-user">
                <span className="user-avatar">
                  {user?.name?.charAt(0) || 'U'}
                </span>
                <span className="user-name">{user?.name}</span>
              </li>
              <li>
                <button onClick={handleLogout} className="nav-btn logout-btn">
                  <LogOut size={18} />
                  Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link to="/login" className="nav-link">Login</Link>
              </li>
              <li>
                <Link to="/register" className="nav-btn register-btn">
                  Get Started
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
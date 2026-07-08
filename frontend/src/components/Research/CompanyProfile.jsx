import React from 'react';
import { Building2, Globe, Users, Calendar, MapPin, Briefcase } from 'lucide-react';
import './CompanyProfile.css';

const CompanyProfile = ({ profile }) => {
  if (!profile) return null;

  return (
    <div className="company-profile">
      <div className="profile-header">
        <div className="profile-logo">
          {profile.logo ? (
            <img src={profile.logo} alt={profile.name} />
          ) : (
            <div className="logo-placeholder">
              <Building2 size={40} />
            </div>
          )}
        </div>
        <div className="profile-info">
          <h2>{profile.name}</h2>
          <span className="profile-symbol">{profile.ticker}</span>
          <span className="profile-exchange">{profile.exchange}</span>
        </div>
      </div>

      <div className="profile-details">
        <div className="detail-item">
          <Briefcase size={18} />
          <span>Industry: {profile.finnhubIndustry || profile.industry || 'N/A'}</span>
        </div>
        <div className="detail-item">
          <Globe size={18} />
          <span>Sector: {profile.sector || 'N/A'}</span>
        </div>
        <div className="detail-item">
          <Calendar size={18} />
          <span>Founded: {profile.ipo || 'N/A'}</span>
        </div>
        <div className="detail-item">
          <MapPin size={18} />
          <span>Country: {profile.country || 'N/A'}</span>
        </div>
        <div className="detail-item">
          <Users size={18} />
          <span>Employees: {profile.employees?.toLocaleString() || 'N/A'}</span>
        </div>
        <div className="detail-item">
          <Building2 size={18} />
          <span>CEO: {profile.ceo || 'N/A'}</span>
        </div>
      </div>

      <div className="profile-description">
        <p>{profile.description || 'No description available'}</p>
      </div>

      <div className="profile-metrics">
        <div className="metric">
          <span className="metric-label">Market Cap</span>
          <span className="metric-value">
            ${profile.marketCapitalization?.toLocaleString() || 'N/A'}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Current Price</span>
          <span className="metric-value">
            ${profile.sharePrice || 'N/A'}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">52W High</span>
          <span className="metric-value">
            ${profile['52WeekHigh'] || 'N/A'}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">52W Low</span>
          <span className="metric-value">
            ${profile['52WeekLow'] || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfile;
import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useResearch } from '../../context/ResearchContext';
import './CompanySearch.css';

const CompanySearch = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const { searchCompanies, searchLoading } = useResearch();
  const wrapperRef = useRef(null);
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    let isCurrent = true;

    const delayDebounce = setTimeout(async () => {
      const trimmedQuery = query.trim();

      if (trimmedQuery.length >= 2) {
        const data = await searchCompanies(trimmedQuery);
        if (isCurrent) {
          setResults(data || []);
          setIsOpen(true);
        }
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(delayDebounce);
    };
  }, [query, searchCompanies]);

  const handleSelect = (result) => {
    skipNextSearchRef.current = true;
    setQuery(result.symbol);
    setIsOpen(false);
    setResults([]);
    onSelect(result.symbol);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="company-search" ref={wrapperRef}>
      <div className="search-wrapper">
        <SearchIcon size={20} className="search-icon" />
        <input
          type="text"
          placeholder="Search for a company (e.g., Apple, AAPL)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="search-input"
        />
        {query && (
          <button onClick={handleClear} className="clear-btn">
            <X size={18} />
          </button>
        )}
        {searchLoading && <div className="search-loading">...</div>}
      </div>

      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map((result) => (
            <div
              key={result.symbol}
              className="search-result-item"
              onClick={() => handleSelect(result)}
            >
              <div className="result-symbol">{result.symbol}</div>
              <div className="result-name">{result.description}</div>
              {result.type && (
                <span className="result-type">{result.type}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !searchLoading && (
        <div className="search-results">
          <div className="search-empty">No companies found</div>
        </div>
      )}
    </div>
  );
};

export default CompanySearch;

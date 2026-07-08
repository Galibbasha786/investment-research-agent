import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';
import axios from 'axios';

const ResearchContext = createContext();

export const useResearch = () => {
  const context = useContext(ResearchContext);
  if (!context) {
    throw new Error('useResearch must be used within a ResearchProvider');
  }
  return context;
};

export const ResearchProvider = ({ children }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [companyData, setCompanyData] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [researchHistory, setResearchHistory] = useState([]);

  // Search companies
  const searchCompanies = useCallback(async (query) => {
    try {
      setSearchLoading(true);
      setError(null);
      
      const response = await axios.get('/api/research/search', {
        params: { query }
      });
      const results = response.data.data || [];
      setSearchResults(results);
      return results;
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed');
      return [];
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Get company data
  const getCompanyData = useCallback(async (symbol) => {
    try {
      setCompanyLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/research/company/${symbol}`);
      setCompanyData(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch company data');
      return null;
    } finally {
      setCompanyLoading(false);
    }
  }, []);

  // Get research history
  const getResearchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setError(null);
      
      const response = await axios.get('/api/research/history');
      const history = response.data.data || [];
      setResearchHistory(history);
      return history;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch history');
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Save research
  const saveResearch = useCallback(async (data) => {
    try {
      setSaveLoading(true);
      setError(null);
      
      const response = await axios.post('/api/research/save', data);
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save research');
      return null;
    } finally {
      setSaveLoading(false);
    }
  }, []);

  const loading = searchLoading || companyLoading || historyLoading || saveLoading;

  const value = useMemo(() => ({
    searchResults,
    companyData,
    loading,
    searchLoading,
    companyLoading,
    historyLoading,
    saveLoading,
    error,
    researchHistory,
    searchCompanies,
    getCompanyData,
    getResearchHistory,
    saveResearch,
    setCompanyData,
    setError
  }), [
    searchResults,
    companyData,
    loading,
    searchLoading,
    companyLoading,
    historyLoading,
    saveLoading,
    error,
    researchHistory,
    searchCompanies,
    getCompanyData,
    getResearchHistory,
    saveResearch
  ]);

  return (
    <ResearchContext.Provider value={value}>
      {children}
    </ResearchContext.Provider>
  );
};

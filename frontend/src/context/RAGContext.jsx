import React, { createContext, useState, useContext, useCallback } from 'react';
import axios from 'axios';

const RAGContext = createContext();

export const useRAG = () => {
  const context = useContext(RAGContext);
  if (!context) {
    throw new Error('useRAG must be used within a RAGProvider');
  }
  return context;
};

export const RAGProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [processedReport, setProcessedReport] = useState(null);
  const [qaHistory, setQaHistory] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [sources, setSources] = useState([]);
  const [vectorStoreStatus, setVectorStoreStatus] = useState({
    initialized: false,
    documentCount: 0
  });

  // Process annual report
  const processAnnualReport = useCallback(async (symbol) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/rag/process', { symbol });
      const result = response.data.data;
      setProcessedReport(result);
      
      // Auto-fetch the documents/chunks after processing
      try {
        const docResponse = await axios.get(`/api/rag/documents/${symbol}`);
        setDocuments(docResponse.data.data);
      } catch (docErr) {
        console.warn('⚠️ Could not load document chunks after processing:', docErr.message);
      }

      return result;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process annual report');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get documents/chunks for a symbol
  const getDocuments = useCallback(async (symbol) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/rag/documents/${symbol}`);
      setDocuments(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch documents');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Ask a question
  const askQuestion = useCallback(async (query, symbol = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/rag/ask', { query, symbol });
      const result = response.data.data;
      
      // Add to history
      setQaHistory(prev => [
        { 
          id: Date.now(),
          query, 
          answer: result.answer,
          sources: result.sources,
          references: result.references,
          timestamp: new Date().toISOString()
        },
        ...prev
      ]);
      
      return result;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get answer');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get evidence-based recommendation
  const getEvidenceRecommendation = useCallback(async (symbol, companyData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/rag/recommendation', { 
        symbol, 
        companyData 
      });
      setRecommendation(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get recommendation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get sources for a claim
  const getSourcesForClaim = useCallback(async (claim, symbol) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/rag/sources', { claim, symbol });
      setSources(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get sources');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get vector store status
  const getVectorStoreStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/rag/status');
      setVectorStoreStatus(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get status');
      return null;
    }
  }, []);

  // Clear vector store
  const clearVectorStore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await axios.delete('/api/rag/clear');
      setDocuments([]);
      setProcessedReport(null);
      setQaHistory([]);
      setRecommendation(null);
      await getVectorStoreStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear vector store');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getVectorStoreStatus]);

  const value = {
    loading,
    error,
    documents,
    processedReport,
    qaHistory,
    recommendation,
    sources,
    vectorStoreStatus,
    processAnnualReport,
    getDocuments,
    askQuestion,
    getEvidenceRecommendation,
    getSourcesForClaim,
    getVectorStoreStatus,
    clearVectorStore
  };

  return (
    <RAGContext.Provider value={value}>
      {children}
    </RAGContext.Provider>
  );
};

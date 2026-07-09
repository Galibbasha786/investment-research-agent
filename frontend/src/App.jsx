import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ResearchProvider } from './context/ResearchContext';
import { RAGProvider } from './context/RAGContext';
import Navbar from './components/Layout/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Research from './pages/Research';
import './App.css';
import ResearchDetail from './pages/ResearchDetail';
import NewsAnalysis from './components/News/NewsAnalysis';
import AdvancedAnalysis from './components/Advanced/AdvancedAnalysis';
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function AppContent() {
  return (
    <Router>
      <ResearchProvider>
        <RAGProvider>
          <div className="app">
            <Navbar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/research" 
                  element={
                    <ProtectedRoute>
                      <Research />
                    </ProtectedRoute>
                  } 
                /><Route 
  path="/research/:id" 
  element={
    <ProtectedRoute>
      <ResearchDetail />
    </ProtectedRoute>
  } 
/>
<Route 
                  path="/news" 
                  element={
                    <ProtectedRoute>
                      <NewsAnalysis />
                    </ProtectedRoute>
                  } 
                />
                 <Route 
                  path="/advanced" 
                  element={
                    <ProtectedRoute>
                      <AdvancedAnalysis />
                    </ProtectedRoute>
                  } 
                />

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        </RAGProvider>
      </ResearchProvider>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
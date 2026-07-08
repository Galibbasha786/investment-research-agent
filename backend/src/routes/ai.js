import express from 'express';
import {
  analyzeCompany,
  getAIAnalysis,
  generateExecutiveSummary
} from '../controllers/aiAnalysisController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Analyze company with AI
router.post('/analyze', analyzeCompany);

// Get AI analysis for a company
router.get('/analysis/:symbol', getAIAnalysis);

// Generate executive summary
router.post('/summary', generateExecutiveSummary);

export default router;
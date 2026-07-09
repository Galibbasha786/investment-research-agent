import express from 'express';
import { runAdvancedAnalysis, getAgentStatus } from '../controllers/advancedAnalysisController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Run advanced analysis
router.post('/analyze', runAdvancedAnalysis);

// Get agent status
router.get('/status', getAgentStatus);

export default router;
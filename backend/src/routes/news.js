import express from 'express';
import {
  getCompanyNews,
  getNewsSentiment,
  getCompanyVideos,
  analyzeNews,
  quickNewsAnalysis
} from '../controllers/newsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Get news for a company
router.get('/:symbol', getCompanyNews);

// Get news sentiment
router.get('/sentiment/:symbol', getNewsSentiment);

// Get YouTube videos
router.get('/videos/:symbol', getCompanyVideos);

// Full analysis with LangGraph
router.post('/analyze', analyzeNews);

// Quick analysis
router.post('/quick', quickNewsAnalysis);

export default router;
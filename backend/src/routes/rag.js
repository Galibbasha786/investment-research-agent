import express from 'express';
import {
  processAnnualReport,
  askQuestion,
  getEvidenceRecommendation,
  getSourcesForClaim,
  getVectorStoreStatus,
  clearVectorStore,
  getDocuments
} from '../controllers/ragController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Process annual report
router.post('/process', processAnnualReport);

// Ask question using RAG
router.post('/ask', askQuestion);

// Get evidence-based recommendation
router.post('/recommendation', getEvidenceRecommendation);

// Get sources for a claim
router.post('/sources', getSourcesForClaim);

// Get documents/chunks for a symbol
router.get('/documents/:symbol', getDocuments);

// Vector store status
router.get('/status', getVectorStoreStatus);

// Clear vector store (admin only)
router.delete('/clear', clearVectorStore);

export default router;
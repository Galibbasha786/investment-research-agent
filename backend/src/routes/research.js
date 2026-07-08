import express from 'express';
import {
  searchCompaniesHandler,
  getCompanyData,
  saveResearch,
  getResearchHistory,
  getResearch
} from '../controllers/researchController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Search companies
router.get('/search', searchCompaniesHandler);

// Get company data
router.get('/company/:symbol', getCompanyData);

// Save research
router.post('/save', saveResearch);

// Get research history
router.get('/history', getResearchHistory);

// Get single research
router.get('/:id', getResearch);

export default router;
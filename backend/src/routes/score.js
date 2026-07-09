import express from 'express';
import { calculateScore, getScoreExplanation } from '../controllers/scoringController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/calculate', calculateScore);
router.get('/explain/:symbol', getScoreExplanation);

export default router;
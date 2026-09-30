import { Router } from 'express';
import { DashboardService } from '../services/DashboardService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Dashboard summary data
router.get('/summary', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const summary = await DashboardService.getSummary(req.user);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

export default router;

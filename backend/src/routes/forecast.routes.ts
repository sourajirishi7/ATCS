import { Router } from 'express';
import { z } from 'zod';
import { ForecastService } from '../services/ForecastService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const recalcSchema = z.object({
  departmentId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
});

// Get or trigger forecast evaluation
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const departmentId =
      (req.query.departmentId as string) || req.user?.departmentId;

    if (!departmentId) {
      res.status(400).json({ success: false, message: 'Department ID is required for forecast analysis.' });
      return;
    }

    const categoryId = req.query.categoryId as string | undefined;
    const result = await ForecastService.evaluateDepartmentForecast(departmentId, categoryId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Force recalculate
router.post('/recalculate', authenticate, validateBody(recalcSchema), async (req, res, next) => {
  try {
    const result = await ForecastService.evaluateDepartmentForecast(
      req.body.departmentId,
      req.body.categoryId
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;

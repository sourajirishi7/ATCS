import { Router } from 'express';
import { z } from 'zod';
import { SpendingService } from '../services/SpendingService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { SpendingStatus } from '../models/types';

const router = Router();

const spendingSchema = z.object({
  categoryId: z.string().uuid(),
  requestedAmount: z.number().positive(),
  currency: z.string().default('INR'),
  vendor: z.string().min(2),
  description: z.string().min(3),
});

// Live Spend Decision Preview ("Spend Before You Spend")
router.post(
  '/preview',
  authenticate,
  validateBody(spendingSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const evaluation = await SpendingService.previewSpend(req.body, req.user!);
      res.json({ success: true, data: evaluation });
    } catch (err) {
      next(err);
    }
  }
);

// Authoritative Spending Request Submission
router.post(
  '/',
  authenticate,
  validateBody(spendingSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await SpendingService.createSpendingRequest(req.body, req.user!);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// List spending requests
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const status = req.query.status as SpendingStatus | undefined;
    const requests = await SpendingService.getSpendingRequests(req.user!, status);
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
});

// Get single request details
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const request = await SpendingService.getSpendingRequestById(req.params.id);
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
});

export default router;

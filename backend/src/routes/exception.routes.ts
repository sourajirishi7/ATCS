import { Router } from 'express';
import { z } from 'zod';
import { ExceptionService } from '../services/ExceptionService';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType, ExceptionDecision } from '../models/types';

const router = Router();

const createExceptionSchema = z.object({
  spendingRequestId: z.string().min(1),
  reason: z.string().min(5),
});

const reviewExceptionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  justification: z.string().min(5),
});

// List exceptions
router.get('/', authenticate, async (req, res, next) => {
  try {
    const decision = req.query.decision as ExceptionDecision | undefined;
    const exceptions = await ExceptionService.getExceptions(decision);
    res.json({ success: true, data: exceptions });
  } catch (err) {
    next(err);
  }
});

// Create exception override request
router.post(
  '/',
  authenticate,
  validateBody(createExceptionSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const created = await ExceptionService.createException(
        req.body.spendingRequestId,
        req.body.reason,
        req.user!
      );
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

// Review exception (Finance / Admin only)
router.post(
  '/:id/review',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  validateBody(reviewExceptionSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await ExceptionService.reviewException(
        req.params.id,
        req.body.decision as ExceptionDecision,
        req.body.justification,
        req.user!
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

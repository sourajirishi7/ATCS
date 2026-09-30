import { Router } from 'express';
import { z } from 'zod';
import { CommitmentService } from '../services/CommitmentService';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType, CommitmentStatus } from '@prisma/client';

const router = Router();

const cancelSchema = z.object({
  reason: z.string().min(5),
});

// List commitments
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const status = req.query.status as CommitmentStatus | undefined;
    const commitments = await CommitmentService.getCommitments(req.user!, status);
    res.json({ success: true, data: commitments });
  } catch (err) {
    next(err);
  }
});

// Get single commitment
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const commitment = await CommitmentService.getCommitmentById(req.params.id);
    res.json({ success: true, data: commitment });
  } catch (err) {
    next(err);
  }
});

// Cancel commitment
router.post(
  '/:id/cancel',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  validateBody(cancelSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const cancelled = await CommitmentService.cancelCommitment(req.params.id, req.body.reason, req.user!);
      res.json({ success: true, data: cancelled });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

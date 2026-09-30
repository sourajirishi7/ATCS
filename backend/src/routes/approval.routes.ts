import { Router } from 'express';
import { z } from 'zod';
import { ApprovalService } from '../services/ApprovalService';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType, ApprovalDecision } from '../models/types';

const router = Router();

const decisionSchema = z.object({
  comments: z.string().default(''),
});

// List pending approvals
router.get(
  '/',
  authenticate,
  authorizeRoles(RoleType.MANAGER, RoleType.FINANCE, RoleType.ADMIN),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const pending = await ApprovalService.getPendingApprovals(req.user!);
      res.json({ success: true, data: pending });
    } catch (err) {
      next(err);
    }
  }
);

// Approve spending request
router.post(
  '/:id/approve',
  authenticate,
  authorizeRoles(RoleType.MANAGER, RoleType.FINANCE, RoleType.ADMIN),
  validateBody(decisionSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await ApprovalService.processDecision(
        req.params.id,
        ApprovalDecision.APPROVED,
        req.body.comments,
        req.user!
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// Reject spending request
router.post(
  '/:id/reject',
  authenticate,
  authorizeRoles(RoleType.MANAGER, RoleType.FINANCE, RoleType.ADMIN),
  validateBody(decisionSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await ApprovalService.processDecision(
        req.params.id,
        ApprovalDecision.REJECTED,
        req.body.comments,
        req.user!
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

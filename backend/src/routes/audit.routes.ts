import { Router } from 'express';
import { AuditService } from '../services/AuditService';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { RoleType } from '@prisma/client';

const router = Router();

// List audit logs (Finance & Admin only)
router.get(
  '/',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  async (req, res, next) => {
    try {
      const result = await AuditService.getLogs({
        userId: req.query.userId as string | undefined,
        action: req.query.action as string | undefined,
        entityType: req.query.entityType as string | undefined,
        entityId: req.query.entityId as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// Inspect historical DecisionSnapshot calculation
router.get('/snapshots/:spendingRequestId', authenticate, async (req, res, next) => {
  try {
    const snapshot = await AuditService.getDecisionSnapshot(req.params.spendingRequestId);
    if (!snapshot) {
      res.status(404).json({ success: false, message: 'Decision snapshot not found for this request.' });
      return;
    }
    res.json({ success: true, data: snapshot });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { AlertService } from '../services/AlertService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { AlertSeverity, AlertStatus } from '../models/types';

const router = Router();

// List alerts
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const departmentId =
      req.user?.role === 'MANAGER' && req.user.departmentId
        ? req.user.departmentId
        : (req.query.departmentId as string | undefined);

    const alerts = await AlertService.getAlerts({
      departmentId,
      severity: req.query.severity as AlertSeverity | undefined,
      status: req.query.status as AlertStatus | undefined,
    });

    res.json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
});

// Resolve alert
router.post('/:id/resolve', authenticate, async (req, res, next) => {
  try {
    const resolved = await AlertService.resolveAlert(req.params.id);
    res.json({ success: true, data: resolved });
  } catch (err) {
    next(err);
  }
});

export default router;

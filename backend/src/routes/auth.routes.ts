import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/AuthService';
import { validateBody } from '../middleware/validate';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
});

const quickLoginSchema = z.object({
  role: z.enum(['ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE']),
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body.email, req.body.password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/quick-login', validateBody(quickLoginSchema), async (req, res, next) => {
  try {
    const result = await AuthService.quickLoginRole(req.body.role);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: req.user });
});

export default router;

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

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  departmentId: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  resetCode: z.string().min(4, 'Reset code required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body.email, req.body.password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    const result = await AuthService.forgotPassword(req.body.email);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const result = await AuthService.resetPassword(req.body.email, req.body.resetCode, req.body.newPassword);
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

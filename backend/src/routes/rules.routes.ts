import { Router } from 'express';
import { z } from 'zod';
import { prisma, toDecimal } from '../prisma';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType } from '../models/types';
import Decimal from 'decimal.js';

const router = Router();

const budgetRuleSchema = z.object({
  ruleName: z.string().min(3),
  ruleType: z.string().default('UTILIZATION_WARNING'),
  threshold: z.number().min(1).max(200),
  action: z.enum(['WARNING', 'BLOCK', 'APPROVAL_REQUIRED']),
  enabled: z.boolean().default(true),
  priority: z.number().default(100),
});

const approvalRuleSchema = z.object({
  name: z.string().min(3),
  minimumAmount: z.number().nonnegative(),
  maximumAmount: z.number().positive().optional().nullable(),
  requiredRole: z.enum(['EMPLOYEE', 'MANAGER', 'FINANCE', 'ADMIN']),
  departmentId: z.string().min(1).optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  enabled: z.boolean().default(true),
  priority: z.number().default(100),
});

// List all configured rules
router.get('/', authenticate, async (req, res, next) => {
  try {
    const [budgetRules, approvalRules] = await Promise.all([
      prisma.budgetRule.findMany({ orderBy: { priority: 'asc' } }),
      prisma.approvalRule.findMany({
        include: { department: true, category: true },
        orderBy: { priority: 'asc' },
      }),
    ]);
    res.json({ success: true, data: { budgetRules, approvalRules } });
  } catch (err) {
    next(err);
  }
});

// Create budget rule
router.post(
  '/budget',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  validateBody(budgetRuleSchema),
  async (req, res, next) => {
    try {
      const created = await prisma.budgetRule.create({
        data: {
          ruleName: req.body.ruleName,
          ruleType: req.body.ruleType,
          threshold: new Decimal(req.body.threshold),
          action: req.body.action,
          enabled: req.body.enabled,
          priority: req.body.priority,
        },
      });
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

// Toggle or update budget rule
router.put(
  '/budget/:id',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  async (req, res, next) => {
    try {
      const updated = await prisma.budgetRule.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Create approval rule
router.post(
  '/approval',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  validateBody(approvalRuleSchema),
  async (req, res, next) => {
    try {
      const created = await prisma.approvalRule.create({
        data: {
          name: req.body.name,
          minimumAmount: new Decimal(req.body.minimumAmount),
          maximumAmount: req.body.maximumAmount ? new Decimal(req.body.maximumAmount) : null,
          requiredRole: req.body.requiredRole as RoleType,
          departmentId: req.body.departmentId || null,
          categoryId: req.body.categoryId || null,
          enabled: req.body.enabled,
          priority: req.body.priority,
        },
      });
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

// Toggle or update approval rule
router.put(
  '/approval/:id',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  async (req, res, next) => {
    try {
      const updated = await prisma.approvalRule.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

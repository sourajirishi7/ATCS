import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType, BudgetStatus } from '../models/types';
import { BudgetService } from '../services/BudgetService';

const router = Router();

const createBudgetSchema = z.object({
  departmentId: z.string().min(1),
  fiscalPeriod: z.string().min(4),
  budgetAmount: z.number().positive(),
  currency: z.string().default('INR'),
  allocations: z.array(
    z.object({
      categoryId: z.string().min(1),
      allocatedAmount: z.number().nonnegative(),
    })
  ),
});

// List budgets
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const where: any = {};
    if (req.user && req.user.role === RoleType.MANAGER && req.user.departmentId) {
      where.departmentId = req.user.departmentId;
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        department: true,
        allocations: { include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: budgets });
  } catch (err) {
    next(err);
  }
});

// Get single budget with utilization metrics
router.get('/:id/utilization', authenticate, async (req, res, next) => {
  try {
    const utilization = await BudgetService.getBudgetUtilization(req.params.id);
    res.json({ success: true, data: utilization });
  } catch (err) {
    next(err);
  }
});

// Get single budget details
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        allocations: { include: { category: true } },
      },
    });
    if (!budget) {
      res.status(404).json({ success: false, message: 'Budget not found' });
      return;
    }
    res.json({ success: true, data: budget });
  } catch (err) {
    next(err);
  }
});

// Create new budget (Finance / Admin only)
router.post(
  '/',
  authenticate,
  authorizeRoles(RoleType.FINANCE, RoleType.ADMIN),
  validateBody(createBudgetSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const created = await BudgetService.createBudget({
        ...req.body,
        userId: req.user?.id,
      });
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

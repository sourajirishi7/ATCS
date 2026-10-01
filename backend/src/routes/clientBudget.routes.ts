import { Router } from 'express';
import { z } from 'zod';
import { ClientBudgetService } from '../services/ClientBudgetService';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType } from '../models/types';

const router = Router();

const simulateSchema = z.object({
  proposedBudget: z.number().positive(),
  currency: z.string().default('INR'),
  targetProfitMarginPct: z.number().min(0).max(100).optional(),
  departmentAllocations: z
    .array(
      z.object({
        departmentId: z.string().min(1),
        allocatedAmount: z.number().nonnegative(),
      })
    )
    .optional(),
});

const createQuotationSchema = z.object({
  clientName: z.string().min(2),
  projectName: z.string().min(2),
  quotationReference: z.string().min(3),
  proposedBudget: z.number().positive(),
  currency: z.string().default('INR'),
  targetProfitMarginPct: z.number().min(0).max(100).optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  allocations: z.array(
    z.object({
      departmentId: z.string().min(1),
      allocatedAmount: z.number().nonnegative(),
      targetMarginPct: z.number().min(0).max(100).optional(),
    })
  ),
});

// 1. Get current active client quotation analytics
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const quotationId = req.query.quotationId as string | undefined;
    const analytics = await ClientBudgetService.getClientQuotationAnalytics(quotationId);
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

// 2. List all saved client quotations
router.get('/list', authenticate, async (req, res, next) => {
  try {
    const quotations = await ClientBudgetService.listQuotations();
    res.json({ success: true, data: quotations });
  } catch (err) {
    next(err);
  }
});

// 3. Real-time simulation of any proposed client budget
router.post('/simulate', authenticate, validateBody(simulateSchema), async (req, res, next) => {
  try {
    const result = await ClientBudgetService.simulateClientBudget(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// 4. Get specific quotation analytics by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const analytics = await ClientBudgetService.getClientQuotationAnalytics(req.params.id);
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

// 5. Create new client quotation
router.post(
  '/',
  authenticate,
  authorizeRoles(RoleType.ADMIN, RoleType.FINANCE),
  validateBody(createQuotationSchema),
  async (req, res, next) => {
    try {
      const quotation = await ClientBudgetService.createClientQuotation(req.body);
      res.status(201).json({ success: true, data: quotation });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType } from '../models/types';
import { AuditService } from '../services/AuditService';

const router = Router();

const createDeptSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10),
  costCenter: z.string().min(2),
});

// List departments (Authenticated)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        budgets: { where: { status: 'ACTIVE' } },
        _count: { select: { users: true, spendingRequests: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: departments });
  } catch (err) {
    next(err);
  }
});

// Get single department
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: {
        budgets: { include: { allocations: { include: { category: true } } } },
        users: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }
    res.json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
});

// Create department (Admin only)
router.post(
  '/',
  authenticate,
  authorizeRoles(RoleType.ADMIN),
  validateBody(createDeptSchema),
  async (req, res, next) => {
    try {
      const created = await prisma.department.create({
        data: {
          name: req.body.name,
          code: req.body.code.toUpperCase().trim(),
          costCenter: req.body.costCenter,
        },
      });

      await AuditService.createLog({
        userId: (req as any).user?.id,
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: created.id,
        newValue: JSON.stringify(created),
      });

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

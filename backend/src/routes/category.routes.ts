import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RoleType } from '../models/types';
import { AuditService } from '../services/AuditService';

const router = Router();

const createCatSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10),
  description: z.string().optional(),
});

// List categories
router.get('/', authenticate, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

// Create category (Admin/Finance only)
router.post(
  '/',
  authenticate,
  authorizeRoles(RoleType.ADMIN, RoleType.FINANCE),
  validateBody(createCatSchema),
  async (req, res, next) => {
    try {
      const created = await prisma.category.create({
        data: {
          name: req.body.name,
          code: req.body.code.toUpperCase().trim(),
          description: req.body.description,
        },
      });

      await AuditService.createLog({
        userId: (req as any).user?.id,
        action: 'CATEGORY_CREATED',
        entityType: 'Category',
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

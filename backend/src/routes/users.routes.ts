import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { RoleType } from '../models/types';

const router = Router();

router.get(
  '/employees',
  authenticate,
  authorizeRoles(RoleType.MANAGER, RoleType.ADMIN),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.user!;
      const whereClause: any = {
        role: { name: RoleType.EMPLOYEE },
      };

      if (user.role === RoleType.MANAGER && user.departmentId) {
        whereClause.departmentId = user.departmentId;
      }

      const employees = await prisma.user.findMany({
        where: whereClause,
        include: {
          department: true,
          spendingRequests: {
            orderBy: { requestedDate: 'desc' },
            include: {
              commitment: true,
            }
          },
        },
      });

      const data = employees.map(emp => {
        const totalRequests = emp.spendingRequests.length;
        let totalCommitted = 0;

        emp.spendingRequests.forEach(req => {
          if (req.commitment && (req.commitment.status === 'ACTIVE' || req.commitment.status === 'PARTIALLY_SETTLED' || req.commitment.status === 'SETTLED')) {
            totalCommitted += parseFloat(req.commitment.committedAmount.toString());
          }
        });

        return {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          department: emp.department ? emp.department.name : 'Unassigned',
          status: emp.status,
          totalRequests,
          totalCommitted,
          recentActivity: emp.spendingRequests.slice(0, 5).map(r => ({
            id: r.id,
            amount: parseFloat(r.requestedAmount.toString()),
            status: r.status,
            date: r.requestedDate,
            description: r.description,
          }))
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

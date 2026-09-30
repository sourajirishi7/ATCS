import { Router } from 'express';
import authRoutes from './auth.routes';
import departmentRoutes from './department.routes';
import categoryRoutes from './category.routes';
import budgetRoutes from './budget.routes';
import spendingRoutes from './spending.routes';
import approvalRoutes from './approval.routes';
import transactionRoutes from './transaction.routes';
import commitmentRoutes from './commitment.routes';
import forecastRoutes from './forecast.routes';
import alertRoutes from './alert.routes';
import dashboardRoutes from './dashboard.routes';
import auditRoutes from './audit.routes';
import rulesRoutes from './rules.routes';
import exceptionRoutes from './exception.routes';
import sandboxRoutes from './sandbox.routes';
import clientBudgetRoutes from './clientBudget.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/departments', departmentRoutes);
router.use('/categories', categoryRoutes);
router.use('/budgets', budgetRoutes);
router.use('/spending-requests', spendingRoutes);
router.use('/approvals', approvalRoutes);
router.use('/transactions', transactionRoutes);
router.use('/commitments', commitmentRoutes);
router.use('/forecast', forecastRoutes);
router.use('/alerts', alertRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/rules', rulesRoutes);
router.use('/exceptions', exceptionRoutes);
router.use('/sandbox', sandboxRoutes);
router.use('/client-budget', clientBudgetRoutes);

export default router;

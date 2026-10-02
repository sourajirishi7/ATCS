import { Router } from 'express';
import healthRoutes from './health.routes';
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
import documentRoutes from './documents.routes';
import aiRoutes from './ai.routes';
import usersRoutes from './users.routes';
import { requireDatabase } from '../lib/dbHealth';

const router = Router();

/**
 * Every operational route below is fail-safe gated by `requireDatabase`.
 *
 * If Supabase PostgreSQL becomes unreachable, ATCS returns 503 DATABASE_UNAVAILABLE
 * instead of computing, approving or committing anything from stale or invented
 * financial state. `/auth` and `/health` are intentionally left ungated so that
 * operators can still log in and diagnose the outage.
 */
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

router.use('/departments', requireDatabase, departmentRoutes);
router.use('/categories', requireDatabase, categoryRoutes);
router.use('/budgets', requireDatabase, budgetRoutes);
router.use('/spending-requests', requireDatabase, spendingRoutes);
router.use('/spending', requireDatabase, spendingRoutes);
router.use('/approvals', requireDatabase, approvalRoutes);
router.use('/transactions', requireDatabase, transactionRoutes);
router.use('/commitments', requireDatabase, commitmentRoutes);
router.use('/forecast', requireDatabase, forecastRoutes);
router.use('/alerts', requireDatabase, alertRoutes);
router.use('/dashboard', requireDatabase, dashboardRoutes);
router.use('/audit-logs', requireDatabase, auditRoutes);
router.use('/rules', requireDatabase, rulesRoutes);
router.use('/exceptions', requireDatabase, exceptionRoutes);
router.use('/sandbox', requireDatabase, sandboxRoutes);
router.use('/client-budget', requireDatabase, clientBudgetRoutes);
router.use('/ai', requireDatabase, aiRoutes);
router.use('/users', requireDatabase, usersRoutes);
router.use('/', requireDatabase, documentRoutes);

export default router;

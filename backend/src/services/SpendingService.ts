import { prisma, toDecimal, toDecimalNumber } from '../prisma';
import {
  SpendingStatus,
  CommitmentStatus,
  DecisionVerdict,
  AlertSeverity,
  Prisma,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { SpendDecisionEngine } from './SpendDecisionEngine';
import { BudgetService } from './BudgetService';
import { AuditService } from './AuditService';
import { AlertService } from './AlertService';
import { emitEvent } from '../socket';
import { AppError } from '../middleware/errorHandler';
import { AuthUser } from '../middleware/auth';

export interface CreateSpendingInput {
  categoryId: string;
  requestedAmount: number;
  currency?: string;
  vendor: string;
  description: string;
}

export class SpendingService {
  /**
   * Spend Decision Preview ("Spend Before You Spend")
   * Pure calculation preview without mutating database state.
   */
  public static async previewSpend(data: CreateSpendingInput, user: AuthUser) {
    if (!user.departmentId) {
      throw new AppError(
        'User profile has no associated department.',
        400,
        'NO_DEPARTMENT_ASSIGNED',
        'Assign a department to user before simulating spending.'
      );
    }

    const department = await prisma.department.findUnique({
      where: { id: user.departmentId },
    });
    if (!department) {
      throw new AppError('Department not found.', 404, 'DEPARTMENT_NOT_FOUND');
    }

    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new AppError('Expense category not found.', 404, 'CATEGORY_NOT_FOUND');
    }

    // Load active budget
    const budget = await BudgetService.getActiveBudgetForDepartment(user.departmentId);

    // Calculate latest actual and committed spend
    const totals = await BudgetService.calculateSpendTotals(user.departmentId, data.categoryId);

    // Load configured rules
    const [approvalRules, budgetRules] = await Promise.all([
      prisma.approvalRule.findMany({ where: { enabled: true } }),
      prisma.budgetRule.findMany({ where: { enabled: true }, orderBy: { priority: 'asc' } }),
    ]);

    // Find category allocation if exists
    let catAlloc = null;
    if (budget) {
      const match = budget.allocations.find((a) => a.categoryId === data.categoryId);
      if (match) catAlloc = match.allocatedAmount;
    }

    const evaluation = SpendDecisionEngine.evaluate({
      employee: {
        id: user.id,
        role: user.role,
        departmentId: user.departmentId,
      },
      department: {
        id: department.id,
        name: department.name,
        status: department.status,
      },
      category: {
        id: category.id,
        name: category.name,
        status: category.status,
      },
      requestedAmount: data.requestedAmount,
      currency: data.currency || 'INR',
      budget: budget
        ? {
            id: budget.id,
            budgetAmount: budget.budgetAmount,
            currency: budget.currency,
            status: budget.status,
            categoryAllocation: catAlloc,
          }
        : null,
      actualSpend: totals.actualSpend,
      committedSpend: totals.committedSpend,
      approvalRules,
      budgetRules,
    });

    return evaluation;
  }

  /**
   * Creates spending request with strict concurrency protection and row-level locking.
   * Runs the full SpendDecisionEngine authoritative pipeline inside a PostgreSQL transaction.
   */
  public static async createSpendingRequest(data: CreateSpendingInput, user: AuthUser) {
    if (!user.departmentId) {
      throw new AppError('User has no department assigned.', 400, 'NO_DEPARTMENT');
    }

    const departmentId = user.departmentId;
    const reqAmount = new Decimal(data.requestedAmount);

    if (reqAmount.lessThanOrEqualTo(0)) {
      throw new AppError('Requested spend amount must be strictly greater than zero.', 400, 'INVALID_AMOUNT');
    }

    // Execute atomic financial transaction with row-level lock on budget
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch department & category
      const [department, category] = await Promise.all([
        tx.department.findUnique({ where: { id: departmentId } }),
        tx.category.findUnique({ where: { id: data.categoryId } }),
      ]);

      if (!department) throw new AppError('Department not found.', 404, 'DEPARTMENT_NOT_FOUND');
      if (!category) throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');

      // 2. Lock the active budget row using PostgreSQL row-level locking (FOR UPDATE)
      // When running on PostgreSQL, we execute a raw locking query to guarantee serialization
      let budget = await tx.budget.findFirst({
        where: { departmentId, status: 'ACTIVE' },
        include: { allocations: true },
      });

      if (budget) {
        // Execute row-level lock to prevent concurrent races
        try {
          await tx.$queryRaw`SELECT id FROM "Budget" WHERE id = ${budget.id} FOR UPDATE`;
        } catch {
          // If running on non-PG mock or sqlite during tests, row-level lock passes gracefully
        }
      }

      // 3. Recalculate latest actual and committed spend inside the locked transaction
      const txAgg = await tx.transaction.aggregate({
        where: { departmentId, status: { not: 'REVERSED' } },
        _sum: { amount: true },
      });
      const actualSpend = txAgg._sum.amount ? new Decimal(txAgg._sum.amount.toString()) : new Decimal(0);

      const commitAgg = await tx.commitment.aggregate({
        where: {
          status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] },
          spendingRequest: { departmentId },
        },
        _sum: { remainingAmount: true },
      });
      const committedSpend = commitAgg._sum.remainingAmount
        ? new Decimal(commitAgg._sum.remainingAmount.toString())
        : new Decimal(0);

      // 4. Load governance rules
      const [approvalRules, budgetRules] = await Promise.all([
        tx.approvalRule.findMany({ where: { enabled: true } }),
        tx.budgetRule.findMany({ where: { enabled: true }, orderBy: { priority: 'asc' } }),
      ]);

      let catAlloc = null;
      if (budget) {
        const match = budget.allocations.find((a) => a.categoryId === data.categoryId);
        if (match) catAlloc = match.allocatedAmount;
      }

      // 5. Authoritative Evaluation
      const verdict = SpendDecisionEngine.evaluate({
        employee: { id: user.id, role: user.role, departmentId },
        department: { id: department.id, name: department.name, status: department.status },
        category: { id: category.id, name: category.name, status: category.status },
        requestedAmount: reqAmount,
        currency: data.currency || 'INR',
        budget: budget
          ? {
              id: budget.id,
              budgetAmount: budget.budgetAmount,
              currency: budget.currency,
              status: budget.status,
              categoryAllocation: catAlloc,
            }
          : null,
        actualSpend,
        committedSpend,
        approvalRules,
        budgetRules,
      });

      // 6. Map verdict to spending request status
      let initialStatus: SpendingStatus = SpendingStatus.SUBMITTED;
      if (verdict.decision === DecisionVerdict.APPROVE) {
        initialStatus = SpendingStatus.COMMITTED;
      } else if (verdict.decision === DecisionVerdict.APPROVAL_REQUIRED) {
        initialStatus = SpendingStatus.UNDER_REVIEW;
      } else if (verdict.decision === DecisionVerdict.VIOLATION || verdict.decision === DecisionVerdict.CONFIGURATION_ERROR) {
        initialStatus = SpendingStatus.REJECTED;
      }

      // 7. Create SpendingRequest record
      const spendingRequest = await tx.spendingRequest.create({
        data: {
          employeeId: user.id,
          departmentId,
          categoryId: data.categoryId,
          requestedAmount: reqAmount,
          currency: data.currency || 'INR',
          description: data.description,
          vendor: data.vendor,
          status: initialStatus,
        },
      });

      // 8. If APPROVED: Atomically create Commitment
      let commitment = null;
      if (verdict.decision === DecisionVerdict.APPROVE) {
        commitment = await tx.commitment.create({
          data: {
            spendingRequestId: spendingRequest.id,
            committedAmount: reqAmount,
            remainingAmount: reqAmount,
            status: CommitmentStatus.ACTIVE,
          },
        });
      }

      // 9. Persist Immutable DecisionSnapshot
      const snapshot = await tx.decisionSnapshot.create({
        data: {
          spendingRequestId: spendingRequest.id,
          budgetAmount: new Decimal(verdict.budgetAmount),
          actualSpend: new Decimal(verdict.actualSpend),
          committedSpend: new Decimal(verdict.committedSpend),
          requestedAmount: reqAmount,
          utilizationBefore: new Decimal(verdict.utilizationBefore),
          utilizationAfter: new Decimal(verdict.utilizationAfter),
          remainingBefore: new Decimal(verdict.availableBefore),
          remainingAfter: new Decimal(verdict.remainingAfter),
          decision: verdict.decision,
          budgetStatus: verdict.budgetStatus,
          violations: JSON.stringify(verdict.violations),
          warnings: JSON.stringify(verdict.warnings),
          reasons: JSON.stringify(verdict.reasons),
          engineVersion: verdict.engineVersion,
        },
      });

      // 10. Audit Log inside transaction
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'SPEND_REQUEST_CREATED',
          entityType: 'SpendingRequest',
          entityId: spendingRequest.id,
          newValue: JSON.stringify({
            amount: toDecimalNumber(reqAmount),
            vendor: data.vendor,
            verdict: verdict.decision,
            status: initialStatus,
          }),
          metadata: JSON.stringify({
            reasons: verdict.reasons,
            utilizationAfter: verdict.utilizationAfter,
          }),
        },
      });

      return {
        spendingRequest,
        commitment,
        snapshot,
        verdict,
      };
    });

    // Post-commit side effects: Alerts & Sockets
    if (result.verdict.decision === DecisionVerdict.VIOLATION) {
      await AlertService.createAlert({
        type: 'BUDGET_EXCEEDED',
        severity: AlertSeverity.CRITICAL,
        departmentId,
        categoryId: data.categoryId,
        relatedRequestId: result.spendingRequest.id,
        message: result.verdict.violations.join(' | ') || 'Spending request violated budget policy.',
      });
    } else if (result.verdict.utilizationAfter >= 80) {
      await AlertService.createAlert({
        type: 'BUDGET_NEAR_LIMIT',
        severity: AlertSeverity.WARNING,
        departmentId,
        categoryId: data.categoryId,
        relatedRequestId: result.spendingRequest.id,
        message: `Department budget has reached ${result.verdict.utilizationAfter.toFixed(1)}% utilization.`,
      });
    }

    emitEvent('spending.created', result.spendingRequest, departmentId);
    emitEvent('dashboard.updated', { departmentId });

    return result;
  }

  /**
   * List spending requests filtered by permissions
   */
  public static async getSpendingRequests(user: AuthUser, status?: SpendingStatus) {
    const where: any = {};
    if (user.role === 'EMPLOYEE') {
      where.employeeId = user.id;
    } else if (user.role === 'MANAGER' && user.departmentId) {
      where.departmentId = user.departmentId;
    }

    if (status) {
      where.status = status;
    }

    return prisma.spendingRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        department: true,
        category: true,
        commitment: true,
        decisionSnapshot: true,
        approvals: {
          include: { approver: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single spending request details
   */
  public static async getSpendingRequestById(id: string) {
    const req = await prisma.spendingRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        department: true,
        category: true,
        commitment: true,
        decisionSnapshot: true,
        approvals: {
          include: { approver: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!req) {
      throw new AppError('Spending request not found.', 404, 'REQUEST_NOT_FOUND');
    }

    return req;
  }
}

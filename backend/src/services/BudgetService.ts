import { prisma, toDecimal, toDecimalNumber } from '../prisma';
import { BudgetStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './AuditService';

export interface BudgetUtilizationSummary {
  budgetId: string;
  departmentId: string;
  departmentName: string;
  fiscalPeriod: string;
  currency: string;
  budgetAmount: number;
  actualSpend: number;
  committedSpend: number;
  availableBudget: number;
  utilizationPercentage: number;
  status: BudgetStatus;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    allocatedAmount: number;
    actualSpend: number;
    committedSpend: number;
    availableAmount: number;
    utilizationPercentage: number;
  }>;
}

export class BudgetService {
  /**
   * Retrieves active budget and calculates exact actual & committed spend
   */
  public static async getActiveBudgetForDepartment(departmentId: string, fiscalPeriod?: string) {
    const whereClause: any = {
      departmentId,
      status: BudgetStatus.ACTIVE,
    };
    if (fiscalPeriod) {
      whereClause.fiscalPeriod = fiscalPeriod;
    }

    return prisma.budget.findFirst({
      where: whereClause,
      include: {
        department: true,
        allocations: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Authoritative calculation of actual and committed spending for a department and optional category
   */
  public static async calculateSpendTotals(departmentId: string, categoryId?: string) {
    // 1. Calculate settled actual transactions
    const transactionWhere: any = {
      departmentId,
      status: { not: 'REVERSED' },
    };
    if (categoryId) {
      transactionWhere.categoryId = categoryId;
    }

    const txAggregate = await prisma.transaction.aggregate({
      where: transactionWhere,
      _sum: { amount: true },
    });
    const actualSpend = txAggregate._sum.amount ? new Decimal(txAggregate._sum.amount.toString()) : new Decimal(0);

    // 2. Calculate outstanding committed amounts (Active or Partially Settled)
    const commitmentWhere: any = {
      status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] },
      spendingRequest: {
        departmentId,
        ...(categoryId ? { categoryId } : {}),
      },
    };

    const commitAggregate = await prisma.commitment.aggregate({
      where: commitmentWhere,
      _sum: { remainingAmount: true },
    });
    const committedSpend = commitAggregate._sum.remainingAmount
      ? new Decimal(commitAggregate._sum.remainingAmount.toString())
      : new Decimal(0);

    return {
      actualSpend,
      committedSpend,
    };
  }

  /**
   * Returns complete budget utilization metrics
   */
  public static async getBudgetUtilization(budgetId: string): Promise<BudgetUtilizationSummary> {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        department: true,
        allocations: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!budget) {
      throw new AppError('Budget not found.', 404, 'BUDGET_NOT_FOUND', 'Provide a valid budget ID.');
    }

    const deptTotals = await this.calculateSpendTotals(budget.departmentId);
    const budgetAmt = new Decimal(budget.budgetAmount.toString());
    const available = budgetAmt.minus(deptTotals.actualSpend).minus(deptTotals.committedSpend);
    const utilPct = budgetAmt.isZero()
      ? 0
      : deptTotals.actualSpend.plus(deptTotals.committedSpend).dividedBy(budgetAmt).times(100).toNumber();

    // Category breakdown
    const categoryBreakdown = [];
    for (const alloc of budget.allocations) {
      const catTotals = await this.calculateSpendTotals(budget.departmentId, alloc.categoryId);
      const allocAmt = new Decimal(alloc.allocatedAmount.toString());
      const catAvail = allocAmt.minus(catTotals.actualSpend).minus(catTotals.committedSpend);
      const catUtilPct = allocAmt.isZero()
        ? 0
        : catTotals.actualSpend.plus(catTotals.committedSpend).dividedBy(allocAmt).times(100).toNumber();

      categoryBreakdown.push({
        categoryId: alloc.categoryId,
        categoryName: alloc.category.name,
        allocatedAmount: toDecimalNumber(allocAmt),
        actualSpend: toDecimalNumber(catTotals.actualSpend),
        committedSpend: toDecimalNumber(catTotals.committedSpend),
        availableAmount: toDecimalNumber(catAvail),
        utilizationPercentage: Number(catUtilPct.toFixed(1)),
      });
    }

    return {
      budgetId: budget.id,
      departmentId: budget.departmentId,
      departmentName: budget.department.name,
      fiscalPeriod: budget.fiscalPeriod,
      currency: budget.currency,
      budgetAmount: toDecimalNumber(budgetAmt),
      actualSpend: toDecimalNumber(deptTotals.actualSpend),
      committedSpend: toDecimalNumber(deptTotals.committedSpend),
      availableBudget: toDecimalNumber(available),
      utilizationPercentage: Number(utilPct.toFixed(1)),
      status: budget.status,
      categoryBreakdown,
    };
  }

  /**
   * Create new budget with category allocations
   */
  public static async createBudget(data: {
    departmentId: string;
    fiscalPeriod: string;
    budgetAmount: number;
    currency?: string;
    allocations: Array<{ categoryId: string; allocatedAmount: number }>;
    userId?: string;
  }) {
    const budgetAmt = new Decimal(data.budgetAmount);

    if (budgetAmt.lessThanOrEqualTo(0)) {
      throw new AppError('Budget amount must be strictly greater than zero.', 400, 'INVALID_BUDGET_AMOUNT');
    }

    // Check duplicate active budget for same department and fiscal period
    const existing = await prisma.budget.findUnique({
      where: {
        departmentId_fiscalPeriod: {
          departmentId: data.departmentId,
          fiscalPeriod: data.fiscalPeriod,
        },
      },
    });

    if (existing) {
      throw new AppError(
        `A budget already exists for this department in period '${data.fiscalPeriod}'.`,
        409,
        'DUPLICATE_BUDGET',
        'Update the existing budget or choose another fiscal period.'
      );
    }

    // Verify sum of category allocations does not exceed total departmental budget
    let totalAlloc = new Decimal(0);
    for (const alloc of data.allocations) {
      totalAlloc = totalAlloc.plus(alloc.allocatedAmount);
    }

    if (totalAlloc.greaterThan(budgetAmt)) {
      throw new AppError(
        `Sum of category allocations (₹${totalAlloc.toFixed(2)}) cannot exceed total departmental budget (₹${budgetAmt.toFixed(2)}).`,
        400,
        'ALLOCATION_EXCEEDS_BUDGET',
        'Adjust category allocations to fit within total departmental budget.'
      );
    }

    const created = await prisma.budget.create({
      data: {
        departmentId: data.departmentId,
        fiscalPeriod: data.fiscalPeriod,
        budgetAmount: budgetAmt,
        currency: data.currency || 'INR',
        status: BudgetStatus.ACTIVE,
        createdBy: data.userId,
        allocations: {
          create: data.allocations.map((a) => ({
            categoryId: a.categoryId,
            allocatedAmount: new Decimal(a.allocatedAmount),
          })),
        },
      },
      include: {
        department: true,
        allocations: {
          include: { category: true },
        },
      },
    });

    await AuditService.createLog({
      userId: data.userId,
      action: 'BUDGET_CREATED',
      entityType: 'Budget',
      entityId: created.id,
      newValue: JSON.stringify({
        departmentId: created.departmentId,
        period: created.fiscalPeriod,
        amount: toDecimalNumber(created.budgetAmount),
      }),
    });

    return created;
  }
}

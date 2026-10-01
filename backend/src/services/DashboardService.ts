import { prisma, toDecimalNumber } from '../prisma';
import { BudgetStatus, SpendingStatus, DecisionVerdict } from '../models/types';
import Decimal from 'decimal.js';
import { AuthUser } from '../middleware/auth';

export class DashboardService {
  private static cache = new Map<string, { data: any; expiresAt: number }>();

  public static invalidateCache() {
    this.cache.clear();
  }

  /**
   * Complete Executive Financial Command Center Summary
   */
  public static async getSummary(user?: AuthUser) {
    const cacheKey = `${user?.role || 'ALL'}:${user?.departmentId || 'GLOBAL'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // 1. Filter clauses based on role/department scope
    const budgetWhere: any = { status: BudgetStatus.ACTIVE };
    const txWhere: any = { status: { not: 'REVERSED' } };
    const commitWhere: any = { status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] } };

    if (user && user.role === 'MANAGER' && user.departmentId) {
      budgetWhere.departmentId = user.departmentId;
      txWhere.departmentId = user.departmentId;
      commitWhere.spendingRequest = { departmentId: user.departmentId };
    }

    // 2. Concurrent Parallel Batch for all dashboard metrics
    const [
      budgets,
      txAgg,
      commitAgg,
      activeViolationsCount,
      pendingApprovalsCount,
      departments,
      categories,
      recentTransactions,
      deptTxGroups,
      catTxGroups,
      activeCommitments,
    ] = await Promise.all([
      prisma.budget.findMany({
        where: budgetWhere,
        include: {
          department: true,
          allocations: { include: { category: true } },
        },
      }),
      prisma.transaction.aggregate({
        where: txWhere,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.commitment.aggregate({
        where: commitWhere,
        _sum: { remainingAmount: true },
        _count: true,
      }),
      prisma.decisionSnapshot.count({
        where: {
          decision: DecisionVerdict.VIOLATION,
          ...(user && user.role === 'MANAGER' && user.departmentId
            ? { spendingRequest: { departmentId: user.departmentId } }
            : {}),
        },
      }),
      prisma.spendingRequest.count({
        where: {
          status: SpendingStatus.UNDER_REVIEW,
          ...(user && user.role === 'MANAGER' && user.departmentId
            ? { departmentId: user.departmentId }
            : {}),
        },
      }),
      prisma.department.findMany({
        where: {
          status: 'ACTIVE',
          ...(user && user.role === 'MANAGER' && user.departmentId ? { id: user.departmentId } : {}),
        },
        orderBy: { name: 'asc' },
      }),
      prisma.category.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      }),
      prisma.transaction.findMany({
        where: txWhere,
        orderBy: { transactionDate: 'desc' },
        take: 20,
        select: {
          id: true,
          amount: true,
          transactionDate: true,
          vendor: true,
          referenceNumber: true,
          category: { select: { name: true } },
        },
      }),
      prisma.transaction.groupBy({
        by: ['departmentId'],
        where: txWhere,
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: txWhere,
        _sum: { amount: true },
      }),
      prisma.commitment.findMany({
        where: commitWhere,
        select: {
          remainingAmount: true,
          spendingRequest: {
            select: {
              departmentId: true,
              categoryId: true,
            },
          },
        },
      }),
    ]);

    // 2. Compute KPI Totals
    const totalBudget = budgets.reduce(
      (acc, b) => acc.plus(new Decimal(b.budgetAmount.toString())),
      new Decimal(0)
    );
    const actualSpend = txAgg._sum.amount ? new Decimal(txAgg._sum.amount.toString()) : new Decimal(0);
    const committedSpend = commitAgg._sum.remainingAmount
      ? new Decimal(commitAgg._sum.remainingAmount.toString())
      : new Decimal(0);

    const availableBudget = totalBudget.minus(actualSpend).minus(committedSpend);
    const totalObligated = actualSpend.plus(committedSpend);
    const overallUtilization = totalBudget.isZero()
      ? 0
      : totalObligated.dividedBy(totalBudget).times(100).toNumber();

    // 3. Build fast in-memory lookup maps for Department and Category breakdown
    const deptActualMap = new Map<string, Decimal>();
    for (const g of deptTxGroups) {
      if (g.departmentId && g._sum.amount) {
        deptActualMap.set(g.departmentId, new Decimal(g._sum.amount.toString()));
      }
    }

    const deptCommitMap = new Map<string, Decimal>();
    const catCommitMap = new Map<string, Decimal>();
    for (const c of activeCommitments) {
      if (!c.spendingRequest) continue;
      const rem = new Decimal(c.remainingAmount.toString());
      const dId = c.spendingRequest.departmentId;
      const cId = c.spendingRequest.categoryId;

      if (dId) {
        deptCommitMap.set(dId, (deptCommitMap.get(dId) || new Decimal(0)).plus(rem));
      }
      if (cId) {
        catCommitMap.set(cId, (catCommitMap.get(cId) || new Decimal(0)).plus(rem));
      }
    }

    const catActualMap = new Map<string, Decimal>();
    for (const g of catTxGroups) {
      if (g.categoryId && g._sum.amount) {
        catActualMap.set(g.categoryId, new Decimal(g._sum.amount.toString()));
      }
    }

    // 4. Assemble Department Breakdown in memory
    const departmentMetrics = departments.map((dept) => {
      const deptBudget = budgets.find((b) => b.departmentId === dept.id);
      const bAmt = deptBudget ? new Decimal(deptBudget.budgetAmount.toString()) : new Decimal(0);
      const deptActual = deptActualMap.get(dept.id) || new Decimal(0);
      const deptCommitted = deptCommitMap.get(dept.id) || new Decimal(0);
      const deptAvailable = bAmt.minus(deptActual).minus(deptCommitted);
      const deptUtil = bAmt.isZero()
        ? 0
        : deptActual.plus(deptCommitted).dividedBy(bAmt).times(100).toNumber();

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        departmentCode: dept.code,
        budget: toDecimalNumber(bAmt),
        actual: toDecimalNumber(deptActual),
        committed: toDecimalNumber(deptCommitted),
        available: toDecimalNumber(deptAvailable),
        utilization: Number(deptUtil.toFixed(1)),
      };
    });

    // 5. Assemble Category Breakdown in memory
    const categoryMetrics: Array<{
      categoryId: string;
      categoryName: string;
      categoryCode: string;
      actual: number;
      committed: number;
      total: number;
    }> = [];

    for (const cat of categories) {
      const catActual = catActualMap.get(cat.id) || new Decimal(0);
      const catCommitted = catCommitMap.get(cat.id) || new Decimal(0);

      if (!catActual.isZero() || !catCommitted.isZero()) {
        categoryMetrics.push({
          categoryId: cat.id,
          categoryName: cat.name,
          categoryCode: cat.code,
          actual: toDecimalNumber(catActual),
          committed: toDecimalNumber(catCommitted),
          total: toDecimalNumber(catActual.plus(catCommitted)),
        });
      }
    }

    const result = {
      kpis: {
        totalBudget: toDecimalNumber(totalBudget),
        actualSpend: toDecimalNumber(actualSpend),
        committedSpend: toDecimalNumber(committedSpend),
        availableBudget: toDecimalNumber(availableBudget),
        overallUtilization: Number(overallUtilization.toFixed(1)),
        projectedSpend: toDecimalNumber(totalObligated),
        activeViolationsCount,
        pendingApprovalsCount,
        transactionCount: txAgg._count,
        commitmentCount: commitAgg._count,
      },
      departments: departmentMetrics,
      categories: categoryMetrics,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        amount: toDecimalNumber(t.amount),
        transactionDate: t.transactionDate.toISOString().split('T')[0],
        vendor: t.vendor,
        referenceNumber: t.referenceNumber,
        category: t.category.name,
      })),
      hasData: budgets.length > 0 || txAgg._count > 0,
    };

    this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 6000 });
    return result;
  }
}

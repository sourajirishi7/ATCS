import { prisma, toDecimalNumber } from '../prisma';
import { BudgetStatus, SpendingStatus, DecisionVerdict } from '../models/types';
import Decimal from 'decimal.js';
import { AuthUser } from '../middleware/auth';

export class DashboardService {
  /**
   * Complete Executive Financial Command Center Summary
   */
  public static async getSummary(user?: AuthUser) {
    // 1. Fetch active budgets
    const budgetWhere: any = { status: BudgetStatus.ACTIVE };
    if (user && user.role === 'MANAGER' && user.departmentId) {
      budgetWhere.departmentId = user.departmentId;
    }

    const budgets = await prisma.budget.findMany({
      where: budgetWhere,
      include: {
        department: true,
        allocations: { include: { category: true } },
      },
    });

    const totalBudget = budgets.reduce(
      (acc, b) => acc.plus(new Decimal(b.budgetAmount.toString())),
      new Decimal(0)
    );

    // 2. Fetch actual spend
    const txWhere: any = { status: { not: 'REVERSED' } };
    if (user && user.role === 'MANAGER' && user.departmentId) {
      txWhere.departmentId = user.departmentId;
    }

    const txAgg = await prisma.transaction.aggregate({
      where: txWhere,
      _sum: { amount: true },
      _count: true,
    });
    const actualSpend = txAgg._sum.amount ? new Decimal(txAgg._sum.amount.toString()) : new Decimal(0);

    // 3. Fetch committed spend
    const commitWhere: any = { status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] } };
    if (user && user.role === 'MANAGER' && user.departmentId) {
      commitWhere.spendingRequest = { departmentId: user.departmentId };
    }

    const commitAgg = await prisma.commitment.aggregate({
      where: commitWhere,
      _sum: { remainingAmount: true },
      _count: true,
    });
    const committedSpend = commitAgg._sum.remainingAmount
      ? new Decimal(commitAgg._sum.remainingAmount.toString())
      : new Decimal(0);

    // 4. Calculate available & utilization
    const availableBudget = totalBudget.minus(actualSpend).minus(committedSpend);
    const totalObligated = actualSpend.plus(committedSpend);
    const overallUtilization = totalBudget.isZero()
      ? 0
      : totalObligated.dividedBy(totalBudget).times(100).toNumber();

    // 5. Active violations & pending approvals
    const [activeViolationsCount, pendingApprovalsCount] = await Promise.all([
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
    ]);

    // 6. Departmental Breakdown
    const departments = await prisma.department.findMany({
      where: {
        status: 'ACTIVE',
        ...(user && user.role === 'MANAGER' && user.departmentId ? { id: user.departmentId } : {}),
      },
    });

    const departmentMetrics = [];
    for (const dept of departments) {
      const deptBudget = budgets.find((b) => b.departmentId === dept.id);
      const bAmt = deptBudget ? new Decimal(deptBudget.budgetAmount.toString()) : new Decimal(0);

      const [deptTx, deptCommit] = await Promise.all([
        prisma.transaction.aggregate({
          where: { departmentId: dept.id, status: { not: 'REVERSED' } },
          _sum: { amount: true },
        }),
        prisma.commitment.aggregate({
          where: { status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] }, spendingRequest: { departmentId: dept.id } },
          _sum: { remainingAmount: true },
        }),
      ]);

      const deptActual = deptTx._sum.amount ? new Decimal(deptTx._sum.amount.toString()) : new Decimal(0);
      const deptCommitted = deptCommit._sum.remainingAmount ? new Decimal(deptCommit._sum.remainingAmount.toString()) : new Decimal(0);
      const deptAvailable = bAmt.minus(deptActual).minus(deptCommitted);
      const deptUtil = bAmt.isZero() ? 0 : deptActual.plus(deptCommitted).dividedBy(bAmt).times(100).toNumber();

      departmentMetrics.push({
        departmentId: dept.id,
        departmentName: dept.name,
        departmentCode: dept.code,
        budget: toDecimalNumber(bAmt),
        actual: toDecimalNumber(deptActual),
        committed: toDecimalNumber(deptCommitted),
        available: toDecimalNumber(deptAvailable),
        utilization: Number(deptUtil.toFixed(1)),
      });
    }

    // 7. Category Breakdown
    const categories = await prisma.category.findMany({ where: { status: 'ACTIVE' } });
    const categoryMetrics = [];
    for (const cat of categories) {
      const [catTx, catCommit] = await Promise.all([
        prisma.transaction.aggregate({
          where: {
            categoryId: cat.id,
            status: { not: 'REVERSED' },
            ...(user && user.role === 'MANAGER' && user.departmentId ? { departmentId: user.departmentId } : {}),
          },
          _sum: { amount: true },
        }),
        prisma.commitment.aggregate({
          where: {
            status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] },
            spendingRequest: {
              categoryId: cat.id,
              ...(user && user.role === 'MANAGER' && user.departmentId ? { departmentId: user.departmentId } : {}),
            },
          },
          _sum: { remainingAmount: true },
        }),
      ]);

      const catActual = catTx._sum.amount ? new Decimal(catTx._sum.amount.toString()) : new Decimal(0);
      const catCommitted = catCommit._sum.remainingAmount ? new Decimal(catCommit._sum.remainingAmount.toString()) : new Decimal(0);

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

    // 8. Spending Trends (Recent transactions by date)
    const recentTransactions = await prisma.transaction.findMany({
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
    });

    return {
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
  }
}

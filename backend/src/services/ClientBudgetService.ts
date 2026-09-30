import { prisma, toDecimalNumber } from '../prisma';
import Decimal from 'decimal.js';
import { AppError } from '../middleware/errorHandler';

export interface DepartmentQuotationAllocationInput {
  departmentId: string;
  allocatedAmount: number;
  targetMarginPct?: number;
}

export interface CreateClientQuotationInput {
  clientName: string;
  projectName: string;
  quotationReference: string;
  proposedBudget: number;
  currency?: string;
  targetProfitMarginPct?: number;
  validUntil?: string;
  notes?: string;
  allocations: DepartmentQuotationAllocationInput[];
}

export interface SimulateClientBudgetInput {
  proposedBudget: number;
  currency?: string;
  targetProfitMarginPct?: number;
  departmentAllocations?: {
    departmentId: string;
    allocatedAmount: number;
  }[];
}

export class ClientBudgetService {
  /**
   * Authoritative calculation of client quotation analytics,
   * tracking Gross, Net, Leftover Budget, Profit %, Estimation of Completion,
   * and department-by-department individual expenses.
   */
  public static async getClientQuotationAnalytics(quotationId?: string) {
    // 1. Fetch quotation
    let quotation = quotationId
      ? await prisma.clientQuotation.findUnique({
          where: { id: quotationId },
          include: {
            allocations: {
              include: { department: true },
            },
          },
        })
      : await prisma.clientQuotation.findFirst({
          where: { status: 'ACTIVE' },
          include: {
            allocations: {
              include: { department: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

    // If no quotation exists yet, seed or return baseline active quotation
    if (!quotation) {
      quotation = await this.ensureDefaultQuotation();
    }

    const proposedBudget = new Decimal(quotation.proposedBudget.toString());
    const targetMarginPct = new Decimal(quotation.targetProfitMarginPct.toString());

    // 2. Aggregate Enterprise Actual Spend across all transactions
    const txAggregate = await prisma.transaction.aggregate({
      where: { status: { not: 'REVERSED' } },
      _sum: { amount: true },
      _count: true,
    });
    const totalActualSpend = txAggregate._sum.amount
      ? new Decimal(txAggregate._sum.amount.toString())
      : new Decimal(0);

    // 3. Aggregate Enterprise Committed Spend across all active commitments
    const commitAggregate = await prisma.commitment.aggregate({
      where: { status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] } },
      _sum: { remainingAmount: true },
      _count: true,
    });
    const totalCommittedSpend = commitAggregate._sum.remainingAmount
      ? new Decimal(commitAggregate._sum.remainingAmount.toString())
      : new Decimal(0);

    // 4. Calculate Gross, Incurred Expenses, Leftover Budget, Net Finances & Margins
    const totalIncurredExpenses = totalActualSpend.plus(totalCommittedSpend);
    const leftoverBudget = proposedBudget.minus(totalIncurredExpenses);
    const netFinances = leftoverBudget; // Remaining profit/cash balance

    const profitMarginPct = proposedBudget.isZero()
      ? new Decimal(0)
      : netFinances.dividedBy(proposedBudget).times(100);

    const grossCostRatio = proposedBudget.isZero()
      ? new Decimal(0)
      : totalIncurredExpenses.dividedBy(proposedBudget).times(100);

    const targetProfitAmount = proposedBudget.times(targetMarginPct).dividedBy(100);
    const profitVarianceFromTarget = netFinances.minus(targetProfitAmount);

    // 5. Estimation of Completion Relative to Proposed Budget
    const burnVelocityRate = proposedBudget.isZero()
      ? 0
      : totalIncurredExpenses.dividedBy(proposedBudget).times(100).toNumber();

    // Standard EVM / Burn projection:
    // Estimated Cost at Completion (EAC):
    // If spend > 0, estimate completion run rate as (Incurred Spend * 1.35) or current trajectory
    const estimatedCostAtCompletion = totalIncurredExpenses.isZero()
      ? proposedBudget.times(0.8)
      : totalIncurredExpenses.times(1.4);

    const varianceAtCompletion = proposedBudget.minus(estimatedCostAtCompletion);
    const estimatedProfitAtCompletion = varianceAtCompletion;
    const estimatedCompletionMarginPct = proposedBudget.isZero()
      ? 0
      : estimatedProfitAtCompletion.dividedBy(proposedBudget).times(100).toNumber();

    let completionStatus = 'HEALTHY_PROFIT';
    let completionNarrative = '';

    if (estimatedCostAtCompletion.greaterThan(proposedBudget)) {
      completionStatus = 'BUDGET_OVERRUN_RISK';
      completionNarrative = `At current burn velocity, estimated completion cost (₹${estimatedCostAtCompletion.toFixed(
        2
      )}) exceeds proposed quotation by ₹${estimatedCostAtCompletion.minus(proposedBudget).toFixed(2)}.`;
    } else if (estimatedCompletionMarginPct < targetMarginPct.toNumber()) {
      completionStatus = 'MARGIN_PRESSURE';
      completionNarrative = `Projected completion margin (${estimatedCompletionMarginPct.toFixed(
        1
      )}%) is below the contracted target (${targetMarginPct.toFixed(1)}%). Action required to control burn.`;
    } else {
      completionStatus = 'HEALTHY_PROFIT';
      completionNarrative = `Estimated project completion maintains an optimal profit margin of ${estimatedCompletionMarginPct.toFixed(
        1
      )}% (₹${estimatedProfitAtCompletion.toFixed(2)} projected net).`;
    }

    // 6. Department-by-Department Individual Expense Tracking
    // Query ALL departments to ensure every single department is accounted for
    const allDepartments = await prisma.department.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });

    const departmentAnalytics = [];

    for (const dept of allDepartments) {
      // Find quotation allocation if specified
      const alloc = quotation.allocations.find((a) => a.departmentId === dept.id);
      const deptAllocated = alloc
        ? new Decimal(alloc.allocatedAmount.toString())
        : new Decimal(0);
      const deptTargetMargin = alloc
        ? new Decimal(alloc.targetMarginPct.toString())
        : targetMarginPct;

      // Actual Settled Expenses for this department
      const deptTx = await prisma.transaction.aggregate({
        where: {
          departmentId: dept.id,
          status: { not: 'REVERSED' },
        },
        _sum: { amount: true },
        _count: true,
      });
      const deptActual = deptTx._sum.amount
        ? new Decimal(deptTx._sum.amount.toString())
        : new Decimal(0);

      // Committed Expenses for this department
      const deptCommit = await prisma.commitment.aggregate({
        where: {
          status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] },
          spendingRequest: { departmentId: dept.id },
        },
        _sum: { remainingAmount: true },
        _count: true,
      });
      const deptCommitted = deptCommit._sum.remainingAmount
        ? new Decimal(deptCommit._sum.remainingAmount.toString())
        : new Decimal(0);

      // Total Incurred for this department
      const deptIncurred = deptActual.plus(deptCommitted);
      const deptLeftover = deptAllocated.minus(deptIncurred);
      const deptNet = deptLeftover; // Net financial margin contribution

      const deptProfitMarginPct = deptAllocated.isZero()
        ? 0
        : deptNet.dividedBy(deptAllocated).times(100).toNumber();

      const deptBurnRate = deptAllocated.isZero()
        ? 0
        : deptIncurred.dividedBy(deptAllocated).times(100).toNumber();

      // Department Estimation of Completion
      const deptEac = deptIncurred.isZero()
        ? deptAllocated.times(0.8)
        : deptIncurred.times(1.35);
      const deptVac = deptAllocated.minus(deptEac);

      let deptStatus = 'WITHIN_BUDGET';
      if (deptAllocated.isZero() && deptIncurred.greaterThan(0)) {
        deptStatus = 'UNALLOCATED_SPEND';
      } else if (deptIncurred.greaterThan(deptAllocated)) {
        deptStatus = 'OVER_QUOTED_BUDGET';
      } else if (deptBurnRate >= 85) {
        deptStatus = 'NEARING_LIMIT';
      } else {
        deptStatus = 'HEALTHY';
      }

      departmentAnalytics.push({
        departmentId: dept.id,
        departmentName: dept.name,
        departmentCode: dept.code,
        costCenter: dept.costCenter,
        allocatedAmount: toDecimalNumber(deptAllocated),
        actualSpend: toDecimalNumber(deptActual),
        committedSpend: toDecimalNumber(deptCommitted),
        totalIncurredExpenses: toDecimalNumber(deptIncurred),
        leftoverBudget: toDecimalNumber(deptLeftover),
        netFinances: toDecimalNumber(deptNet),
        profitMarginPct: Number(deptProfitMarginPct.toFixed(1)),
        burnRatePct: Number(deptBurnRate.toFixed(1)),
        costSharePct: totalIncurredExpenses.isZero()
          ? 0
          : Number(deptIncurred.dividedBy(totalIncurredExpenses).times(100).toFixed(1)),
        estimatedCostAtCompletion: toDecimalNumber(deptEac),
        varianceAtCompletion: toDecimalNumber(deptVac),
        status: deptStatus,
        transactionCount: deptTx._count,
        commitmentCount: deptCommit._count,
      });
    }

    return {
      quotation: {
        id: quotation.id,
        clientName: quotation.clientName,
        projectName: quotation.projectName,
        quotationReference: quotation.quotationReference,
        status: quotation.status,
        currency: quotation.currency,
        validUntil: quotation.validUntil,
        notes: quotation.notes,
        createdAt: quotation.createdAt,
      },
      financialSummary: {
        grossProposedBudget: toDecimalNumber(proposedBudget),
        totalActualSpend: toDecimalNumber(totalActualSpend),
        totalCommittedSpend: toDecimalNumber(totalCommittedSpend),
        totalIncurredExpenses: toDecimalNumber(totalIncurredExpenses),
        leftoverBudget: toDecimalNumber(leftoverBudget),
        netFinances: toDecimalNumber(netFinances),
        profitMarginPct: Number(profitMarginPct.toFixed(1)),
        targetProfitMarginPct: Number(targetMarginPct.toFixed(1)),
        targetProfitAmount: toDecimalNumber(targetProfitAmount),
        profitVarianceFromTarget: toDecimalNumber(profitVarianceFromTarget),
        grossCostRatio: Number(grossCostRatio.toFixed(1)),
      },
      estimationOfCompletion: {
        budgetBurnRate: Number(burnVelocityRate.toFixed(1)),
        estimatedCostAtCompletion: toDecimalNumber(estimatedCostAtCompletion),
        varianceAtCompletion: toDecimalNumber(varianceAtCompletion),
        estimatedProfitAtCompletion: toDecimalNumber(estimatedProfitAtCompletion),
        estimatedCompletionMarginPct: Number(estimatedCompletionMarginPct.toFixed(1)),
        status: completionStatus,
        narrative: completionNarrative,
      },
      departments: departmentAnalytics,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Real-time Quotation Simulator:
   * Evaluates any hypothetical or proposed budget provided by the client/user,
   * calculating instant leftover, gross, net, profit %, and department breakdown.
   */
  public static async simulateClientBudget(input: SimulateClientBudgetInput) {
    const proposedBudget = new Decimal(input.proposedBudget);
    const targetMarginPct = new Decimal(input.targetProfitMarginPct || 20);

    if (proposedBudget.isNegative() || proposedBudget.isZero()) {
      throw new AppError('Proposed budget must be greater than zero.', 400, 'INVALID_BUDGET');
    }

    // 1. Incurred Actual Spend across all transactions
    const txAggregate = await prisma.transaction.aggregate({
      where: { status: { not: 'REVERSED' } },
      _sum: { amount: true },
    });
    const totalActualSpend = txAggregate._sum.amount
      ? new Decimal(txAggregate._sum.amount.toString())
      : new Decimal(0);

    // 2. Incurred Committed Spend across all active commitments
    const commitAggregate = await prisma.commitment.aggregate({
      where: { status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] } },
      _sum: { remainingAmount: true },
    });
    const totalCommittedSpend = commitAggregate._sum.remainingAmount
      ? new Decimal(commitAggregate._sum.remainingAmount.toString())
      : new Decimal(0);

    const totalIncurredExpenses = totalActualSpend.plus(totalCommittedSpend);
    const leftoverBudget = proposedBudget.minus(totalIncurredExpenses);
    const netFinances = leftoverBudget;

    const profitMarginPct = proposedBudget.isZero()
      ? 0
      : netFinances.dividedBy(proposedBudget).times(100).toNumber();

    const grossCostRatio = proposedBudget.isZero()
      ? 0
      : totalIncurredExpenses.dividedBy(proposedBudget).times(100).toNumber();

    const targetProfitAmount = proposedBudget.times(targetMarginPct).dividedBy(100);
    const profitVarianceFromTarget = netFinances.minus(targetProfitAmount);

    // Completion Estimation
    const burnVelocityRate = proposedBudget.isZero()
      ? 0
      : totalIncurredExpenses.dividedBy(proposedBudget).times(100).toNumber();

    const estimatedCostAtCompletion = totalIncurredExpenses.isZero()
      ? proposedBudget.times(0.8)
      : totalIncurredExpenses.times(1.4);

    const varianceAtCompletion = proposedBudget.minus(estimatedCostAtCompletion);
    const estimatedProfitAtCompletion = varianceAtCompletion;
    const estimatedCompletionMarginPct = proposedBudget.isZero()
      ? 0
      : estimatedProfitAtCompletion.dividedBy(proposedBudget).times(100).toNumber();

    // Department Breakdown
    const allDepartments = await prisma.department.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });

    // If custom department allocations provided, use them; otherwise distribute proportionally
    const customAllocMap = new Map<string, Decimal>();
    if (input.departmentAllocations && input.departmentAllocations.length > 0) {
      for (const da of input.departmentAllocations) {
        customAllocMap.set(da.departmentId, new Decimal(da.allocatedAmount));
      }
    }

    const defaultWeights: Record<string, number> = {
      ENG: 0.45, // Engineering 45%
      MKT: 0.25, // Marketing 25%
      OPS: 0.15, // Operations 15%
      SLS: 0.10, // Sales 10%
      HR: 0.05,  // Human Resources 5%
    };

    const departmentAnalytics = [];

    for (const dept of allDepartments) {
      let deptAllocated: Decimal;
      if (customAllocMap.has(dept.id)) {
        deptAllocated = customAllocMap.get(dept.id)!;
      } else {
        const weight = defaultWeights[dept.code] || 0.1;
        deptAllocated = proposedBudget.times(weight);
      }

      const [deptTx, deptCommit] = await Promise.all([
        prisma.transaction.aggregate({
          where: { departmentId: dept.id, status: { not: 'REVERSED' } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.commitment.aggregate({
          where: {
            status: { in: ['ACTIVE', 'PARTIALLY_SETTLED'] },
            spendingRequest: { departmentId: dept.id },
          },
          _sum: { remainingAmount: true },
          _count: true,
        }),
      ]);

      const deptActual = deptTx._sum.amount
        ? new Decimal(deptTx._sum.amount.toString())
        : new Decimal(0);
      const deptCommitted = deptCommit._sum.remainingAmount
        ? new Decimal(deptCommit._sum.remainingAmount.toString())
        : new Decimal(0);

      const deptIncurred = deptActual.plus(deptCommitted);
      const deptLeftover = deptAllocated.minus(deptIncurred);
      const deptNet = deptLeftover;

      const deptProfitMarginPct = deptAllocated.isZero()
        ? 0
        : deptNet.dividedBy(deptAllocated).times(100).toNumber();

      const deptBurnRate = deptAllocated.isZero()
        ? 0
        : deptIncurred.dividedBy(deptAllocated).times(100).toNumber();

      const deptEac = deptIncurred.isZero()
        ? deptAllocated.times(0.8)
        : deptIncurred.times(1.35);

      departmentAnalytics.push({
        departmentId: dept.id,
        departmentName: dept.name,
        departmentCode: dept.code,
        costCenter: dept.costCenter,
        allocatedAmount: toDecimalNumber(deptAllocated),
        actualSpend: toDecimalNumber(deptActual),
        committedSpend: toDecimalNumber(deptCommitted),
        totalIncurredExpenses: toDecimalNumber(deptIncurred),
        leftoverBudget: toDecimalNumber(deptLeftover),
        netFinances: toDecimalNumber(deptNet),
        profitMarginPct: Number(deptProfitMarginPct.toFixed(1)),
        burnRatePct: Number(deptBurnRate.toFixed(1)),
        costSharePct: totalIncurredExpenses.isZero()
          ? 0
          : Number(deptIncurred.dividedBy(totalIncurredExpenses).times(100).toFixed(1)),
        estimatedCostAtCompletion: toDecimalNumber(deptEac),
        varianceAtCompletion: toDecimalNumber(deptAllocated.minus(deptEac)),
        status: deptIncurred.greaterThan(deptAllocated)
          ? 'OVER_QUOTED_BUDGET'
          : deptBurnRate >= 85
          ? 'NEARING_LIMIT'
          : 'HEALTHY',
      });
    }

    return {
      simulationInputs: {
        proposedBudget: toDecimalNumber(proposedBudget),
        currency: input.currency || 'INR',
        targetProfitMarginPct: Number(targetMarginPct.toFixed(1)),
      },
      financialSummary: {
        grossProposedBudget: toDecimalNumber(proposedBudget),
        totalActualSpend: toDecimalNumber(totalActualSpend),
        totalCommittedSpend: toDecimalNumber(totalCommittedSpend),
        totalIncurredExpenses: toDecimalNumber(totalIncurredExpenses),
        leftoverBudget: toDecimalNumber(leftoverBudget),
        netFinances: toDecimalNumber(netFinances),
        profitMarginPct: Number(profitMarginPct.toFixed(1)),
        targetProfitMarginPct: Number(targetMarginPct.toFixed(1)),
        targetProfitAmount: toDecimalNumber(targetProfitAmount),
        profitVarianceFromTarget: toDecimalNumber(profitVarianceFromTarget),
        grossCostRatio: Number(grossCostRatio.toFixed(1)),
      },
      estimationOfCompletion: {
        budgetBurnRate: Number(burnVelocityRate.toFixed(1)),
        estimatedCostAtCompletion: toDecimalNumber(estimatedCostAtCompletion),
        varianceAtCompletion: toDecimalNumber(varianceAtCompletion),
        estimatedProfitAtCompletion: toDecimalNumber(estimatedProfitAtCompletion),
        estimatedCompletionMarginPct: Number(estimatedCompletionMarginPct.toFixed(1)),
        status:
          estimatedCostAtCompletion.greaterThan(proposedBudget)
            ? 'BUDGET_OVERRUN_RISK'
            : estimatedCompletionMarginPct < targetMarginPct.toNumber()
            ? 'MARGIN_PRESSURE'
            : 'HEALTHY_PROFIT',
      },
      departments: departmentAnalytics,
      simulatedAt: new Date().toISOString(),
    };
  }

  /**
   * Save a new client quotation with departmental allocations
   */
  public static async createClientQuotation(input: CreateClientQuotationInput) {
    const existing = await prisma.clientQuotation.findUnique({
      where: { quotationReference: input.quotationReference },
    });
    if (existing) {
      throw new AppError(
        `Quotation reference '${input.quotationReference}' already exists.`,
        400,
        'DUPLICATE_REFERENCE'
      );
    }

    const created = await prisma.clientQuotation.create({
      data: {
        clientName: input.clientName,
        projectName: input.projectName,
        quotationReference: input.quotationReference,
        proposedBudget: new Decimal(input.proposedBudget),
        currency: input.currency || 'INR',
        targetProfitMarginPct: new Decimal(input.targetProfitMarginPct || 20),
        status: 'ACTIVE',
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        notes: input.notes,
        allocations: {
          create: input.allocations.map((a) => ({
            departmentId: a.departmentId,
            allocatedAmount: new Decimal(a.allocatedAmount),
            targetMarginPct: new Decimal(a.targetMarginPct || 20),
          })),
        },
      },
      include: {
        allocations: { include: { department: true } },
      },
    });

    return created;
  }

  /**
   * List all stored client quotations
   */
  public static async listQuotations() {
    return prisma.clientQuotation.findMany({
      include: {
        allocations: { include: { department: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ensure default enterprise client quotation is seeded if none exist
   */
  private static async ensureDefaultQuotation() {
    const depts = await prisma.department.findMany();
    const deptMap = new Map(depts.map((d) => [d.code, d.id]));

    const defaultProposedBudget = new Decimal(2500000); // ₹25,00,000 Client Contract Quotation

    const allocations = [
      { code: 'ENG', amount: new Decimal(1125000) }, // 45% (₹11.25L)
      { code: 'MKT', amount: new Decimal(625000) },  // 25% (₹6.25L)
      { code: 'OPS', amount: new Decimal(375000) },  // 15% (₹3.75L)
      { code: 'SLS', amount: new Decimal(250000) },  // 10% (₹2.50L)
      { code: 'HR',  amount: new Decimal(125000) },  // 5%  (₹1.25L)
    ];

    const quotation = await prisma.clientQuotation.create({
      data: {
        clientName: 'Apex Global Enterprises',
        projectName: 'Enterprise Cloud Transformation & Modernization',
        quotationReference: 'QT-2026-APEX-001',
        proposedBudget: defaultProposedBudget,
        currency: 'INR',
        targetProfitMarginPct: new Decimal(25.0),
        status: 'ACTIVE',
        notes: 'Governing client contract quotation for FY2026-Q3 delivery milestones.',
        allocations: {
          create: allocations
            .filter((a) => deptMap.has(a.code))
            .map((a) => ({
              departmentId: deptMap.get(a.code)!,
              allocatedAmount: a.amount,
              targetMarginPct: new Decimal(25.0),
            })),
        },
      },
      include: {
        allocations: { include: { department: true } },
      },
    });

    return quotation;
  }
}

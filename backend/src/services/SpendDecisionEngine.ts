import Decimal from 'decimal.js';
import { DecisionVerdict, RoleType } from '@prisma/client';

export interface DecisionEvaluationInput {
  employee: {
    id: string;
    role: RoleType;
    departmentId?: string | null;
  };
  department: {
    id: string;
    name: string;
    status: string;
  };
  category: {
    id: string;
    name: string;
    status: string;
  };
  requestedAmount: Decimal | number | string;
  currency: string;
  
  // Financial Context
  budget: {
    id: string;
    budgetAmount: Decimal | number | string;
    currency: string;
    status: string;
    categoryAllocation?: Decimal | number | string | null;
  } | null;
  
  actualSpend: Decimal | number | string;
  committedSpend: Decimal | number | string;
  
  // Configured Rules from DB
  approvalRules: Array<{
    id: string;
    name: string;
    minimumAmount: Decimal | number | string;
    maximumAmount?: Decimal | number | string | null;
    requiredRole: RoleType;
    departmentId?: string | null;
    categoryId?: string | null;
    enabled: boolean;
  }>;
  
  budgetRules: Array<{
    id: string;
    ruleName: string;
    ruleType: string;
    threshold: Decimal | number | string;
    action: string;
    enabled: boolean;
    priority: number;
  }>;
}

export interface DecisionEvaluationOutput {
  decision: DecisionVerdict;
  budgetStatus: 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'NO_BUDGET' | 'INVALID_CONFIG';
  budgetAmount: number;
  actualSpend: number;
  committedSpend: number;
  requestedAmount: number;
  availableBefore: number;
  remainingAfter: number;
  projectedSpend: number;
  utilizationBefore: number;
  utilizationAfter: number;
  approvalRequired: boolean;
  requiredApproverRole?: RoleType | null;
  violations: string[];
  warnings: string[];
  reasons: string[];
  calculatedAt: string;
  engineVersion: string;
}

export class SpendDecisionEngine {
  public static readonly VERSION = '1.0.0';

  /**
   * Authoritative calculation and verdict evaluation.
   * Strictly adheres to the 16-step ATCS priority evaluation sequence.
   */
  public static evaluate(input: DecisionEvaluationInput): DecisionEvaluationOutput {
    const timestamp = new Date().toISOString();
    const violations: string[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [];

    const reqAmt = new Decimal(input.requestedAmount.toString());

    // 1. Input Validation: Amount sanity
    if (reqAmt.isNaN() || reqAmt.lessThanOrEqualTo(0)) {
      violations.push(`Invalid requested amount: ₹${reqAmt.toFixed(2)}. Spending requests must be strictly greater than zero.`);
      return this.buildOutput({
        decision: DecisionVerdict.VIOLATION,
        budgetStatus: 'INVALID_CONFIG',
        budget: new Decimal(0),
        actual: new Decimal(0),
        committed: new Decimal(0),
        requested: reqAmt,
        availBefore: new Decimal(0),
        remAfter: new Decimal(0),
        projSpend: new Decimal(0),
        utilBefore: new Decimal(0),
        utilAfter: new Decimal(0),
        approvalRequired: false,
        violations,
        warnings,
        reasons: ['Requested amount is zero or negative.'],
        timestamp,
      });
    }

    // 2. Organization Check: Department Status
    if (input.department.status !== 'ACTIVE') {
      violations.push(`Department '${input.department.name}' is currently INACTIVE. New spending cannot be initiated.`);
      return this.buildOutput({
        decision: DecisionVerdict.VIOLATION,
        budgetStatus: 'INVALID_CONFIG',
        budget: new Decimal(0),
        actual: new Decimal(0),
        committed: new Decimal(0),
        requested: reqAmt,
        availBefore: new Decimal(0),
        remAfter: new Decimal(0),
        projSpend: new Decimal(0),
        utilBefore: new Decimal(0),
        utilAfter: new Decimal(0),
        approvalRequired: false,
        violations,
        warnings,
        reasons: ['Department is inactive.'],
        timestamp,
      });
    }

    // 3. Category Eligibility Check
    if (input.category.status !== 'ACTIVE') {
      violations.push(`Category '${input.category.name}' is marked INACTIVE in corporate governance.`);
      return this.buildOutput({
        decision: DecisionVerdict.VIOLATION,
        budgetStatus: 'INVALID_CONFIG',
        budget: new Decimal(0),
        actual: new Decimal(0),
        committed: new Decimal(0),
        requested: reqAmt,
        availBefore: new Decimal(0),
        remAfter: new Decimal(0),
        projSpend: new Decimal(0),
        utilBefore: new Decimal(0),
        utilAfter: new Decimal(0),
        approvalRequired: false,
        violations,
        warnings,
        reasons: ['Expense category is disabled.'],
        timestamp,
      });
    }

    // 4. Budget Existence & Status
    if (!input.budget) {
      violations.push(`No budget record found for department '${input.department.name}' in the current period.`);
      return this.buildOutput({
        decision: DecisionVerdict.CONFIGURATION_ERROR,
        budgetStatus: 'NO_BUDGET',
        budget: new Decimal(0),
        actual: new Decimal(0),
        committed: new Decimal(0),
        requested: reqAmt,
        availBefore: new Decimal(0),
        remAfter: new Decimal(0),
        projSpend: new Decimal(0),
        utilBefore: new Decimal(0),
        utilAfter: new Decimal(0),
        approvalRequired: false,
        violations,
        warnings,
        reasons: ['Missing active departmental budget.'],
        timestamp,
      });
    }

    if (input.budget.status !== 'ACTIVE') {
      violations.push(`Departmental budget for '${input.department.name}' is in '${input.budget.status}' status (must be ACTIVE).`);
      return this.buildOutput({
        decision: DecisionVerdict.VIOLATION,
        budgetStatus: 'INVALID_CONFIG',
        budget: new Decimal(input.budget.budgetAmount.toString()),
        actual: new Decimal(0),
        committed: new Decimal(0),
        requested: reqAmt,
        availBefore: new Decimal(0),
        remAfter: new Decimal(0),
        projSpend: new Decimal(0),
        utilBefore: new Decimal(0),
        utilAfter: new Decimal(0),
        approvalRequired: false,
        violations,
        warnings,
        reasons: [`Budget is ${input.budget.status}.`],
        timestamp,
      });
    }

    // 5. Currency Check
    if (input.currency.toUpperCase() !== input.budget.currency.toUpperCase()) {
      violations.push(`Currency mismatch: Request is in ${input.currency.toUpperCase()} but budget is denominated in ${input.budget.currency.toUpperCase()}. Multi-currency cross-settlement is prohibited.`);
      return this.buildOutput({
        decision: DecisionVerdict.VIOLATION,
        budgetStatus: 'INVALID_CONFIG',
        budget: new Decimal(input.budget.budgetAmount.toString()),
        actual: new Decimal(0),
        committed: new Decimal(0),
        requested: reqAmt,
        availBefore: new Decimal(0),
        remAfter: new Decimal(0),
        projSpend: new Decimal(0),
        utilBefore: new Decimal(0),
        utilAfter: new Decimal(0),
        approvalRequired: false,
        violations,
        warnings,
        reasons: ['Currency denomination mismatch.'],
        timestamp,
      });
    }

    // Determine governing budget: if category allocation exists, it governs the line-item; else department total.
    const deptBudgetAmt = new Decimal(input.budget.budgetAmount.toString());
    let governingBudget = deptBudgetAmt;
    if (input.budget.categoryAllocation !== undefined && input.budget.categoryAllocation !== null) {
      governingBudget = new Decimal(input.budget.categoryAllocation.toString());
    }

    const actual = new Decimal(input.actualSpend.toString());
    const committed = new Decimal(input.committedSpend.toString());

    // -------------------------------------------------------------
    // FINANCIAL CALCULATIONS (Backend-Authoritative with Decimal.js)
    // -------------------------------------------------------------
    // Available = Budget - Actual - Committed
    const availableBefore = governingBudget.minus(actual).minus(committed);

    // Projected Spend = Actual + Committed + Requested
    const projectedSpend = actual.plus(committed).plus(reqAmt);

    // Remaining After = Budget - Projected Spend
    const remainingAfter = governingBudget.minus(projectedSpend);

    // Utilization Before = (Actual + Committed) / Budget * 100
    const utilBefore = governingBudget.isZero()
      ? new Decimal(0)
      : actual.plus(committed).dividedBy(governingBudget).times(100);

    // Utilization After = Projected Spend / Budget * 100
    const utilAfter = governingBudget.isZero()
      ? new Decimal(100)
      : projectedSpend.dividedBy(governingBudget).times(100);

    // -------------------------------------------------------------
    // RULE EVALUATION & VERDICT DETERMINATION
    // -------------------------------------------------------------

    // Check Hard Budget Violation: Projected Spend > Budget
    let isHardViolation = false;
    if (projectedSpend.greaterThan(governingBudget)) {
      isHardViolation = true;
      const overage = projectedSpend.minus(governingBudget);
      violations.push(
        `Budget exceeded because Actual (₹${actual.toFixed(2)}) + Committed (₹${committed.toFixed(2)}) + Proposed (₹${reqAmt.toFixed(2)}) = Projected Total (₹${projectedSpend.toFixed(2)}), which exceeds Governing Budget (₹${governingBudget.toFixed(2)}) by ₹${overage.toFixed(2)}.`
      );
      reasons.push(`Budget overrun of ₹${overage.toFixed(2)} detected.`);
    }

    // Check Configured Budget Rules (e.g. Warning threshold at 80% or 90%)
    for (const bRule of input.budgetRules) {
      if (!bRule.enabled) continue;
      const thresholdPct = new Decimal(bRule.threshold.toString());

      if (bRule.ruleType === 'UTILIZATION_WARNING' && utilAfter.greaterThanOrEqualTo(thresholdPct)) {
        if (bRule.action === 'WARNING') {
          warnings.push(`Rule '${bRule.ruleName}': Projected utilization (${utilAfter.toFixed(1)}%) crosses configured alert threshold of ${thresholdPct.toFixed(0)}%.`);
        } else if (bRule.action === 'BLOCK' && !isHardViolation) {
          isHardViolation = true;
          violations.push(`Rule '${bRule.ruleName}': Spending blocked because projected utilization (${utilAfter.toFixed(1)}%) exceeds policy cap of ${thresholdPct.toFixed(0)}%.`);
        }
      }
    }

    // Check Approval Rules (Configurable monetary thresholds from DB)
    let approvalRequired = false;
    let requiredApproverRole: RoleType | null = null;

    for (const aRule of input.approvalRules) {
      if (!aRule.enabled) continue;
      // Filter by department scope if specified
      if (aRule.departmentId && aRule.departmentId !== input.department.id) continue;
      // Filter by category scope if specified
      if (aRule.categoryId && aRule.categoryId !== input.category.id) continue;

      const minAmt = new Decimal(aRule.minimumAmount.toString());
      const maxAmt = aRule.maximumAmount ? new Decimal(aRule.maximumAmount.toString()) : null;

      const meetsMin = reqAmt.greaterThan(minAmt);
      const meetsMax = maxAmt === null || reqAmt.lessThanOrEqualTo(maxAmt);

      if (meetsMin && meetsMax) {
        approvalRequired = true;
        requiredApproverRole = aRule.requiredRole;
        reasons.push(
          `Request of ₹${reqAmt.toFixed(2)} exceeds standard threshold (₹${minAmt.toFixed(2)}) per Rule '${aRule.name}', requiring ${aRule.requiredRole} review.`
        );
        break;
      }
    }

    // Determine Final Decision according to strict priority:
    // CONFIGURATION_ERROR > INSUFFICIENT_DATA > VIOLATION > APPROVAL_REQUIRED > WARNING > APPROVE
    let finalDecision: DecisionVerdict = DecisionVerdict.APPROVE;
    let budgetStatus: 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET' = 'WITHIN_BUDGET';

    if (isHardViolation) {
      finalDecision = DecisionVerdict.VIOLATION;
      budgetStatus = 'OVER_BUDGET';
    } else if (approvalRequired) {
      finalDecision = DecisionVerdict.APPROVAL_REQUIRED;
      budgetStatus = utilAfter.greaterThanOrEqualTo(80) ? 'NEAR_LIMIT' : 'WITHIN_BUDGET';
    } else if (warnings.length > 0) {
      finalDecision = DecisionVerdict.WARNING;
      budgetStatus = 'NEAR_LIMIT';
      reasons.push('Spending is approved with high-utilization warning.');
    } else {
      finalDecision = DecisionVerdict.APPROVE;
      budgetStatus = 'WITHIN_BUDGET';
      reasons.push(`Spend request is fully within budget (Projected utilization: ${utilAfter.toFixed(1)}%).`);
    }

    return this.buildOutput({
      decision: finalDecision,
      budgetStatus,
      budget: governingBudget,
      actual,
      committed,
      requested: reqAmt,
      availBefore: availableBefore,
      remAfter: remainingAfter,
      projSpend: projectedSpend,
      utilBefore,
      utilAfter,
      approvalRequired,
      requiredApproverRole,
      violations,
      warnings,
      reasons,
      timestamp,
    });
  }

  private static buildOutput(params: {
    decision: DecisionVerdict;
    budgetStatus: 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'NO_BUDGET' | 'INVALID_CONFIG';
    budget: Decimal;
    actual: Decimal;
    committed: Decimal;
    requested: Decimal;
    availBefore: Decimal;
    remAfter: Decimal;
    projSpend: Decimal;
    utilBefore: Decimal;
    utilAfter: Decimal;
    approvalRequired: boolean;
    requiredApproverRole?: RoleType | null;
    violations: string[];
    warnings: string[];
    reasons: string[];
    timestamp: string;
  }): DecisionEvaluationOutput {
    return {
      decision: params.decision,
      budgetStatus: params.budgetStatus,
      budgetAmount: params.budget.toDecimalPlaces(2).toNumber(),
      actualSpend: params.actual.toDecimalPlaces(2).toNumber(),
      committedSpend: params.committed.toDecimalPlaces(2).toNumber(),
      requestedAmount: params.requested.toDecimalPlaces(2).toNumber(),
      availableBefore: params.availBefore.toDecimalPlaces(2).toNumber(),
      remainingAfter: params.remAfter.toDecimalPlaces(2).toNumber(),
      projectedSpend: params.projSpend.toDecimalPlaces(2).toNumber(),
      utilizationBefore: params.utilBefore.toDecimalPlaces(2).toNumber(),
      utilizationAfter: params.utilAfter.toDecimalPlaces(2).toNumber(),
      approvalRequired: params.approvalRequired,
      requiredApproverRole: params.requiredApproverRole,
      violations: params.violations,
      warnings: params.warnings,
      reasons: params.reasons,
      calculatedAt: params.timestamp,
      engineVersion: this.VERSION,
    };
  }
}

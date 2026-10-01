import Decimal from 'decimal.js';
import { DecisionVerdict, RoleType } from '../models/types';

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
  overrideToken?: string | null;
}

export interface TriggeredRuleInfo {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  description: string;
  severity: 'VIOLATION' | 'EXCEPTION' | 'WARNING';
  action: string;
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
  exceptionTriggered: boolean;
  complianceBadge: 'EXCEPTION_FLAGGED' | 'OVERRIDE_REQUIRED' | 'AUTO_COMPLIANT';
  routeStatus: 'PENDING_EXCEPTION_REVIEW' | 'COMMITTED' | 'UNDER_REVIEW' | 'REJECTED';
  triggeredRules: TriggeredRuleInfo[];
}

export class SpendDecisionEngine {
  public static readonly VERSION = '1.1.0';

  /**
   * Authoritative calculation and verdict evaluation.
   * Strictly adheres to the ATCS sequential rule evaluation pipeline:
   * 1. Amount & Org validation
   * 2. Budget sanity & Currency alignment
   * 3. Hard Cap ceiling checks (with override token verification)
   * 4. Category & Department Exception rule triggers
   * 5. Tiered multi-approval thresholds
   * 6. Final verdict, compliance badges & exception routing
   */
  public static evaluate(input: DecisionEvaluationInput): DecisionEvaluationOutput {
    const timestamp = new Date().toISOString();
    const violations: string[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [];
    const triggeredRules: TriggeredRuleInfo[] = [];

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
        exceptionTriggered: false,
        complianceBadge: 'OVERRIDE_REQUIRED',
        routeStatus: 'REJECTED',
        triggeredRules,
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
        exceptionTriggered: false,
        complianceBadge: 'OVERRIDE_REQUIRED',
        routeStatus: 'REJECTED',
        triggeredRules,
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
        exceptionTriggered: false,
        complianceBadge: 'OVERRIDE_REQUIRED',
        routeStatus: 'REJECTED',
        triggeredRules,
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
        exceptionTriggered: false,
        complianceBadge: 'OVERRIDE_REQUIRED',
        routeStatus: 'REJECTED',
        triggeredRules,
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
        exceptionTriggered: false,
        complianceBadge: 'OVERRIDE_REQUIRED',
        routeStatus: 'REJECTED',
        triggeredRules,
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
        exceptionTriggered: false,
        complianceBadge: 'OVERRIDE_REQUIRED',
        routeStatus: 'REJECTED',
        triggeredRules,
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
    const availableBefore = governingBudget.minus(actual).minus(committed);
    const projectedSpend = actual.plus(committed).plus(reqAmt);
    const remainingAfter = governingBudget.minus(projectedSpend);

    const utilBefore = governingBudget.isZero()
      ? new Decimal(0)
      : actual.plus(committed).dividedBy(governingBudget).times(100);

    const utilAfter = governingBudget.isZero()
      ? new Decimal(100)
      : projectedSpend.dividedBy(governingBudget).times(100);

    // -------------------------------------------------------------
    // RULE EVALUATION & EXCEPTION ENFORCEMENT
    // -------------------------------------------------------------
    let isHardViolation = false;
    let exceptionTriggered = false;

    // Check Hard Budget Violation: Projected Spend > Budget
    if (projectedSpend.greaterThan(governingBudget)) {
      if (input.overrideToken) {
        warnings.push(`Managerial override token applied. Spending exceeds governing budget by ₹${projectedSpend.minus(governingBudget).toFixed(2)}.`);
      } else {
        isHardViolation = true;
        const overage = projectedSpend.minus(governingBudget);
        const ruleCode = 'RULE_HARD_CAP_100';
        violations.push(
          `[${ruleCode}] Budget exceeded: Actual (₹${actual.toFixed(2)}) + Committed (₹${committed.toFixed(2)}) + Proposed (₹${reqAmt.toFixed(2)}) = ₹${projectedSpend.toFixed(2)}, exceeding Governing Budget (₹${governingBudget.toFixed(2)}) by ₹${overage.toFixed(2)}.`
        );
        reasons.push(`Budget overrun of ₹${overage.toFixed(2)} detected.`);
        triggeredRules.push({
          ruleId: 'hard-cap-breach',
          ruleCode,
          ruleName: 'Hard Budget Ceiling Exceeded (100%)',
          ruleType: 'HARD_CEILING',
          description: `Total spend ₹${projectedSpend.toFixed(2)} exceeds budget ₹${governingBudget.toFixed(2)} by ₹${overage.toFixed(2)}. Requires authorized override.`,
          severity: 'VIOLATION',
          action: 'BLOCK',
        });
      }
    }

    // Evaluate Active Budget & Exception Rules from Database
    for (const bRule of input.budgetRules) {
      if (!bRule.enabled) continue;
      const thresholdVal = new Decimal(bRule.threshold.toString());
      const ruleCode = bRule.ruleName.includes(':') ? bRule.ruleName.split(':')[0].trim() : bRule.ruleName;

      // 1. Hard Ceiling Policy Caps
      if (bRule.ruleType === 'HARD_CEILING') {
        const thresholdPct = thresholdVal;
        const isExceeded = thresholdPct.lessThanOrEqualTo(100) 
          ? utilAfter.greaterThan(thresholdPct) 
          : reqAmt.greaterThan(thresholdVal);

        if (isExceeded) {
          if (input.overrideToken) {
            warnings.push(`Rule '${bRule.ruleName}': Allowed under managerial override token.`);
          } else {
            isHardViolation = true;
            violations.push(`[${ruleCode}] Policy violation: ${bRule.ruleName} breached without managerial override token.`);
            triggeredRules.push({
              ruleId: bRule.id,
              ruleCode,
              ruleName: bRule.ruleName,
              ruleType: bRule.ruleType,
              description: `Policy cap exceeded (${utilAfter.toFixed(1)}% / threshold ${thresholdVal.toFixed(0)}). Immediate rejection enforced.`,
              severity: 'VIOLATION',
              action: 'BLOCK',
            });
          }
        }
      }

      // 2. Category Exception Triggers (e.g. Travel single transaction ceiling, Hardware caps)
      else if (
        bRule.ruleType === 'CATEGORY_EXCEPTION' || 
        bRule.ruleType === 'CATEGORY_CAP' ||
        (bRule.action === 'APPROVAL_REQUIRED' && bRule.ruleName.toLowerCase().includes(input.category.name.toLowerCase().split(' ')[0]))
      ) {
        const catNameLower = input.category.name.toLowerCase();
        const ruleNameLower = bRule.ruleName.toLowerCase();
        const matchesCategory = 
          ruleNameLower.includes(catNameLower) || 
          ruleNameLower.includes(catNameLower.split(' ')[0]) ||
          bRule.ruleType === 'CATEGORY_EXCEPTION';

        if (matchesCategory && reqAmt.greaterThan(thresholdVal)) {
          exceptionTriggered = true;
          const desc = `[${ruleCode}] Category Exception: Request of ₹${reqAmt.toFixed(2)} in '${input.category.name}' exceeds allowable exception threshold (₹${thresholdVal.toFixed(2)}). Requires Director sign-off.`;
          warnings.push(desc);
          reasons.push(desc);
          triggeredRules.push({
            ruleId: bRule.id,
            ruleCode,
            ruleName: bRule.ruleName,
            ruleType: bRule.ruleType,
            description: `Single-transaction category exception threshold (₹${thresholdVal.toFixed(2)}) exceeded. Mandatory multi-tier approval required.`,
            severity: 'EXCEPTION',
            action: bRule.action || 'APPROVAL_REQUIRED',
          });
        }
      }

      // 3. Department Aggregate Exception Triggers (e.g. utilization > 90% requires Executive review)
      else if (bRule.ruleType === 'DEPARTMENT_EXCEPTION' || bRule.ruleType === 'DEPARTMENT_AGGREGATE_CAP') {
        if (utilAfter.greaterThanOrEqualTo(thresholdVal)) {
          exceptionTriggered = true;
          const desc = `[${ruleCode}] Department Exception: Department utilization (${utilAfter.toFixed(1)}%) crosses exception ceiling (${thresholdVal.toFixed(0)}%).`;
          warnings.push(desc);
          reasons.push(desc);
          triggeredRules.push({
            ruleId: bRule.id,
            ruleCode,
            ruleName: bRule.ruleName,
            ruleType: bRule.ruleType,
            description: `Department aggregate spend utilization (${utilAfter.toFixed(1)}%) exceeded exception trigger threshold (${thresholdVal.toFixed(0)}%).`,
            severity: 'EXCEPTION',
            action: bRule.action || 'APPROVAL_REQUIRED',
          });
        }
      }

      // 4. Standard Utilization Warnings
      else if (bRule.ruleType === 'UTILIZATION_WARNING' && utilAfter.greaterThanOrEqualTo(thresholdVal)) {
        if (bRule.action === 'WARNING') {
          warnings.push(`Rule '${bRule.ruleName}': Projected utilization (${utilAfter.toFixed(1)}%) crosses configured alert threshold of ${thresholdVal.toFixed(0)}%.`);
        } else if (bRule.action === 'BLOCK' && !isHardViolation && !input.overrideToken) {
          isHardViolation = true;
          violations.push(`Rule '${bRule.ruleName}': Spending blocked because projected utilization (${utilAfter.toFixed(1)}%) exceeds policy cap of ${thresholdVal.toFixed(0)}%.`);
          triggeredRules.push({
            ruleId: bRule.id,
            ruleCode,
            ruleName: bRule.ruleName,
            ruleType: bRule.ruleType,
            description: `Projected utilization (${utilAfter.toFixed(1)}%) exceeded warning limit.`,
            severity: 'VIOLATION',
            action: 'BLOCK',
          });
        }
      }
    }

    // Check Approval Rules (Configurable monetary thresholds from DB)
    let approvalRequired = false;
    let requiredApproverRole: RoleType | null = null;

    for (const aRule of input.approvalRules) {
      if (!aRule.enabled) continue;
      if (aRule.departmentId && aRule.departmentId !== input.department.id) continue;
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

    // -------------------------------------------------------------
    // FINAL VERDICT, ROUTE STATUS, & COMPLIANCE BADGE DETERMINATION
    // -------------------------------------------------------------
    let finalDecision: DecisionVerdict = DecisionVerdict.APPROVE;
    let budgetStatus: 'WITHIN_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET' = 'WITHIN_BUDGET';
    let routeStatus: 'PENDING_EXCEPTION_REVIEW' | 'COMMITTED' | 'UNDER_REVIEW' | 'REJECTED' = 'COMMITTED';
    let complianceBadge: 'EXCEPTION_FLAGGED' | 'OVERRIDE_REQUIRED' | 'AUTO_COMPLIANT' = 'AUTO_COMPLIANT';

    if (isHardViolation) {
      finalDecision = DecisionVerdict.VIOLATION;
      budgetStatus = 'OVER_BUDGET';
      routeStatus = 'REJECTED';
      complianceBadge = 'OVERRIDE_REQUIRED';
    } else if (exceptionTriggered) {
      finalDecision = DecisionVerdict.APPROVAL_REQUIRED;
      budgetStatus = utilAfter.greaterThanOrEqualTo(80) ? 'NEAR_LIMIT' : 'WITHIN_BUDGET';
      routeStatus = 'PENDING_EXCEPTION_REVIEW';
      complianceBadge = 'EXCEPTION_FLAGGED';
      approvalRequired = true;
      reasons.push('Budget Exception Rule Triggered: Request routed to PENDING_EXCEPTION_REVIEW. Straight-through auto-approval blocked.');
    } else if (approvalRequired) {
      finalDecision = DecisionVerdict.APPROVAL_REQUIRED;
      budgetStatus = utilAfter.greaterThanOrEqualTo(80) ? 'NEAR_LIMIT' : 'WITHIN_BUDGET';
      routeStatus = 'UNDER_REVIEW';
      complianceBadge = 'OVERRIDE_REQUIRED';
    } else if (warnings.length > 0) {
      finalDecision = DecisionVerdict.WARNING;
      budgetStatus = 'NEAR_LIMIT';
      routeStatus = 'COMMITTED';
      complianceBadge = 'AUTO_COMPLIANT';
      reasons.push('Spending is approved with high-utilization warning.');
    } else {
      finalDecision = DecisionVerdict.APPROVE;
      budgetStatus = 'WITHIN_BUDGET';
      routeStatus = 'COMMITTED';
      complianceBadge = 'AUTO_COMPLIANT';
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
      exceptionTriggered,
      complianceBadge,
      routeStatus,
      triggeredRules,
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
    exceptionTriggered: boolean;
    complianceBadge: 'EXCEPTION_FLAGGED' | 'OVERRIDE_REQUIRED' | 'AUTO_COMPLIANT';
    routeStatus: 'PENDING_EXCEPTION_REVIEW' | 'COMMITTED' | 'UNDER_REVIEW' | 'REJECTED';
    triggeredRules: TriggeredRuleInfo[];
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
      exceptionTriggered: params.exceptionTriggered,
      complianceBadge: params.complianceBadge,
      routeStatus: params.routeStatus,
      triggeredRules: params.triggeredRules,
    };
  }
}

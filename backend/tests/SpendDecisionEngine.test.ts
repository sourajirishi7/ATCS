import { SpendDecisionEngine } from '../src/services/SpendDecisionEngine';
import { DecisionVerdict, RoleType } from '@prisma/client';
import Decimal from 'decimal.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING ATCS FINANCIAL DECISION ENGINE TEST SUITE');
  console.log('====================================================\n');

  const baseDepartment = { id: 'dept-eng', name: 'Engineering', status: 'ACTIVE' };
  const baseCategory = { id: 'cat-sw', name: 'Software & Cloud', status: 'ACTIVE' };
  const baseEmployee = { id: 'emp-devon', role: RoleType.EMPLOYEE, departmentId: 'dept-eng' };

  const approvalRules = [
    {
      id: 'rule-mgr',
      name: 'Manager Approval > ₹15,000',
      minimumAmount: 15000,
      maximumAmount: 100000,
      requiredRole: RoleType.MANAGER,
      departmentId: null,
      categoryId: null,
      enabled: true,
    },
    {
      id: 'rule-fin',
      name: 'Finance CFO Approval > ₹100,000',
      minimumAmount: 100000,
      maximumAmount: null,
      requiredRole: RoleType.FINANCE,
      departmentId: null,
      categoryId: null,
      enabled: true,
    },
  ];

  const budgetRules = [
    {
      id: 'rule-warn-80',
      ruleName: 'UTILIZATION_WARNING_80',
      ruleType: 'UTILIZATION_WARNING',
      threshold: 80.0,
      action: 'WARNING',
      enabled: true,
      priority: 10,
    },
    {
      id: 'rule-block-100',
      ruleName: 'HARD_CEILING_100',
      ruleType: 'HARD_CEILING',
      threshold: 100.0,
      action: 'BLOCK',
      enabled: true,
      priority: 20,
    },
  ];

  // -------------------------------------------------------------------------
  // TEST 1: MANDATORY SCENARIO A — BEST CASE (APPROVE)
  // Budget = ₹1,00,000 | Actual = ₹20,000 | Committed = ₹10,000 | Request = ₹5,000
  // Projected = ₹35,000 | Expected Verdict: APPROVE
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: SCENARIO A (BEST CASE) ---');
  const resA = SpendDecisionEngine.evaluate({
    employee: baseEmployee,
    department: baseDepartment,
    category: baseCategory,
    requestedAmount: 5000,
    currency: 'INR',
    budget: { id: 'b-1', budgetAmount: 100000, currency: 'INR', status: 'ACTIVE' },
    actualSpend: 20000,
    committedSpend: 10000,
    approvalRules,
    budgetRules,
  });

  assert(resA.decision === DecisionVerdict.APPROVE, 'Scenario A verdict must be APPROVE');
  assert(resA.projectedSpend === 35000, 'Scenario A projected spend must equal ₹35,000');
  assert(resA.availableBefore === 70000, 'Scenario A available before must equal ₹70,000');
  assert(resA.remainingAfter === 65000, 'Scenario A remaining after must equal ₹65,000');
  assert(resA.utilizationAfter === 35.0, 'Scenario A utilization after must equal 35.0%');
  assert(resA.violations.length === 0, 'Scenario A must have 0 violations');

  // -------------------------------------------------------------------------
  // TEST 2: MANDATORY SCENARIO B — AVERAGE CASE (APPROVAL REQUIRED)
  // Budget = ₹1,00,000 | Actual = ₹50,000 | Committed = ₹20,000 | Request = ₹20,000
  // Projected = ₹90,000 | Request > ₹15,000 threshold | Expected Verdict: APPROVAL_REQUIRED
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: SCENARIO B (AVERAGE CASE) ---');
  const resB = SpendDecisionEngine.evaluate({
    employee: baseEmployee,
    department: baseDepartment,
    category: baseCategory,
    requestedAmount: 20000,
    currency: 'INR',
    budget: { id: 'b-1', budgetAmount: 100000, currency: 'INR', status: 'ACTIVE' },
    actualSpend: 50000,
    committedSpend: 20000,
    approvalRules,
    budgetRules,
  });

  assert(resB.decision === DecisionVerdict.APPROVAL_REQUIRED, 'Scenario B verdict must be APPROVAL_REQUIRED');
  assert(resB.projectedSpend === 90000, 'Scenario B projected spend must equal ₹90,000');
  assert(resB.approvalRequired === true, 'Scenario B approvalRequired flag must be true');
  assert(resB.requiredApproverRole === RoleType.MANAGER, 'Scenario B must require MANAGER role');
  assert(resB.utilizationAfter === 90.0, 'Scenario B utilization after must equal 90.0%');

  // -------------------------------------------------------------------------
  // TEST 3: MANDATORY SCENARIO C — WORST CASE (BUDGET OVERRUN VIOLATION)
  // Budget = ₹1,00,000 | Actual = ₹60,000 | Committed = ₹30,000 | Request = ₹20,000
  // Projected = ₹1,10,000 | Overrun = ₹10,000 | Expected Verdict: VIOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: SCENARIO C (WORST CASE) ---');
  const resC = SpendDecisionEngine.evaluate({
    employee: baseEmployee,
    department: baseDepartment,
    category: baseCategory,
    requestedAmount: 20000,
    currency: 'INR',
    budget: { id: 'b-1', budgetAmount: 100000, currency: 'INR', status: 'ACTIVE' },
    actualSpend: 60000,
    committedSpend: 30000,
    approvalRules,
    budgetRules,
  });

  assert(resC.decision === DecisionVerdict.VIOLATION, 'Scenario C verdict must be VIOLATION');
  assert(resC.projectedSpend === 110000, 'Scenario C projected spend must equal ₹1,10,000');
  assert(resC.remainingAfter === -10000, 'Scenario C remaining after must equal -₹10,000');
  assert(resC.utilizationAfter === 110.0, 'Scenario C utilization after must equal 110.0%');
  assert(resC.violations.length > 0, 'Scenario C must contain descriptive violation message');
  assert(
    resC.violations[0].includes('Actual (₹60000.00) + Committed (₹30000.00) + Proposed (₹20000.00) = Projected Total (₹110000.00)'),
    'Scenario C must contain exact explainable formula in violation message'
  );

  // -------------------------------------------------------------------------
  // TEST 4: PRIORITY RESOLUTION — HARD VIOLATION TAKES PRECEDENCE OVER WARNING
  // Even if 80% warning rule triggers, if projected > budget, verdict MUST be VIOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: PRIORITY RESOLUTION HIERARCHY ---');
  assert(resC.decision === DecisionVerdict.VIOLATION, 'Hard VIOLATION must always override WARNING status');

  // -------------------------------------------------------------------------
  // TEST 5: DECIMAL PRECISION SANITY
  // Verifying 1/3 splits and 2-decimal fractional amounts have zero JS floating drift
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: DECIMAL PRECISION ACCURACY ---');
  const resDec = SpendDecisionEngine.evaluate({
    employee: baseEmployee,
    department: baseDepartment,
    category: baseCategory,
    requestedAmount: 33333.33,
    currency: 'INR',
    budget: { id: 'b-1', budgetAmount: 100000, currency: 'INR', status: 'ACTIVE' },
    actualSpend: 33333.33,
    committedSpend: 33333.33,
    approvalRules: [],
    budgetRules: [],
  });

  assert(resDec.projectedSpend === 99999.99, 'Decimal precision must strictly preserve 99,999.99 without rounding artifacts');
  assert(resDec.remainingAfter === 0.01, 'Decimal precision remaining must equal 0.01');
  assert(resDec.decision === DecisionVerdict.APPROVE, '99,999.99 against 100,000 must be APPROVE');

  // -------------------------------------------------------------------------
  // TEST 6: CURRENCY MISMATCH VIOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: CURRENCY DENOMINATION MISMATCH ---');
  const resCurr = SpendDecisionEngine.evaluate({
    employee: baseEmployee,
    department: baseDepartment,
    category: baseCategory,
    requestedAmount: 500,
    currency: 'USD',
    budget: { id: 'b-1', budgetAmount: 100000, currency: 'INR', status: 'ACTIVE' },
    actualSpend: 0,
    committedSpend: 0,
    approvalRules: [],
    budgetRules: [],
  });

  assert(resCurr.decision === DecisionVerdict.VIOLATION, 'Currency mismatch USD vs INR must produce VIOLATION');

  // -------------------------------------------------------------------------
  // TEST 7: ZERO OR NEGATIVE SPEND VIOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: ZERO OR NEGATIVE SPEND VIOLATION ---');
  const resZero = SpendDecisionEngine.evaluate({
    employee: baseEmployee,
    department: baseDepartment,
    category: baseCategory,
    requestedAmount: -500,
    currency: 'INR',
    budget: { id: 'b-1', budgetAmount: 100000, currency: 'INR', status: 'ACTIVE' },
    actualSpend: 0,
    committedSpend: 0,
    approvalRules: [],
    budgetRules: [],
  });

  assert(resZero.decision === DecisionVerdict.VIOLATION, 'Negative spend must produce VIOLATION');

  console.log('\n====================================================');
  console.log('🎉 ALL FINANCIAL TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

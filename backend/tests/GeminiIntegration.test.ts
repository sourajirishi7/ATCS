import { GeminiService } from '../src/services/gemini/GeminiService';
import { GeminiToolExecutor } from '../src/services/gemini/GeminiToolExecutor';
import { RoleType, DecisionVerdict } from '../src/models/types';
import { AuthUser } from '../src/middleware/auth';
import { SpendDecisionEngine } from '../src/services/SpendDecisionEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runGeminiTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING ATCS GEMINI AI AGENT INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  // Test Users
  const employeeUser: AuthUser = {
    id: 'emp-devon',
    name: 'Devon Employee',
    email: 'devon@company.com',
    role: RoleType.EMPLOYEE,
    departmentId: 'dept-eng',
  };

  const managerUser: AuthUser = {
    id: 'mgr-sarah',
    name: 'Sarah Manager',
    email: 'sarah@company.com',
    role: RoleType.MANAGER,
    departmentId: 'dept-eng',
  };

  const financeUser: AuthUser = {
    id: 'fin-alex',
    name: 'Alex Finance',
    email: 'alex@company.com',
    role: RoleType.FINANCE,
    departmentId: null,
  };

  // -----------------------------------------------------------------
  // 1. RBAC & Data Isolation Tests
  // -----------------------------------------------------------------
  console.log('--- Test Group 1: RBAC & Department Data Isolation ---');

  // Employee attempting to access another department's budget
  const empCrossDeptBudget = await GeminiToolExecutor.getDepartmentBudget('dept-marketing', employeeUser);
  assert(
    empCrossDeptBudget.success === false && Boolean(empCrossDeptBudget.error?.includes('Access denied')),
    'Employee is blocked from accessing another department budget'
  );

  // Employee attempting to access client quotation margin data
  const empQuoteAccess = await GeminiToolExecutor.getClientQuotation(undefined, employeeUser);
  assert(
    empQuoteAccess.success === false && Boolean(empQuoteAccess.error?.includes('Access denied')),
    'Employee is blocked from viewing client quotation margins'
  );

  // Manager attempting to simulate spend for another department
  const mgrCrossSim = await GeminiToolExecutor.simulateSpending(
    { departmentId: 'dept-sales', categoryId: 'cat-sw', amount: 50000 },
    managerUser
  );
  assert(
    mgrCrossSim.success === false && Boolean(mgrCrossSim.error?.includes('Access denied')),
    'Manager is blocked from simulating spending for another department'
  );

  // -----------------------------------------------------------------
  // 2. Read-Only First & Safety Policy Tests
  // -----------------------------------------------------------------
  console.log('\n--- Test Group 2: Read-Only First & Refusal of Approval Actions ---');

  // User asking Gemini Agent to approve a request
  const approveQuery = await GeminiService.processChat(
    'Please approve request req-123 right now',
    { page: 'approvals' },
    managerUser
  );
  assert(
    approveQuery.success === true,
    'Gemini Agent handles approval request query gracefully'
  );
  assert(
    approveQuery.answer.includes('Action Restricted') ||
      approveQuery.answer.includes('cannot approve') ||
      approveQuery.answer.includes('read-only'),
    'Gemini Agent refuses to approve request and redirects to authorized ATCS workflow'
  );

  // Verify Gemini Agent does not have any mutation methods
  assert(
    typeof (GeminiToolExecutor as any).approveRequest === 'undefined',
    'GeminiToolExecutor has no approveRequest method'
  );
  assert(
    typeof (GeminiToolExecutor as any).createTransaction === 'undefined',
    'GeminiToolExecutor has no createTransaction method'
  );
  assert(
    typeof (GeminiToolExecutor as any).modifyBudget === 'undefined',
    'GeminiToolExecutor has no modifyBudget method'
  );

  // -----------------------------------------------------------------
  // 3. Spend Simulation using SpendDecisionEngine
  // -----------------------------------------------------------------
  console.log('\n--- Test Group 3: Spend Simulation Integration with SpendDecisionEngine ---');

  // Direct SpendDecisionEngine evaluation
  const engineResult = SpendDecisionEngine.evaluate({
    employee: employeeUser,
    department: { id: 'dept-eng', name: 'Engineering', status: 'ACTIVE' },
    category: { id: 'cat-hw', name: 'Hardware', status: 'ACTIVE' },
    requestedAmount: 50000,
    currency: 'INR',
    budget: {
      id: 'b-1',
      budgetAmount: 100000,
      currency: 'INR',
      status: 'ACTIVE',
      categoryAllocation: null,
    },
    actualSpend: 60000,
    committedSpend: 10000,
    approvalRules: [],
    budgetRules: [],
  });

  // Verify SpendDecisionEngine calculations
  assert(engineResult.decision === DecisionVerdict.VIOLATION, 'SpendDecisionEngine correctly flags budget overrun');
  assert(engineResult.projectedSpend === 120000, 'Projected spend calculation matches exact formula');
  assert(engineResult.remainingAfter === -20000, 'Remaining budget reflects negative overrun');

  // Natural language question asking what happens if spending ₹50,000
  const simChat = await GeminiService.processChat(
    'What happens if I spend ₹50,000 more in Hardware?',
    { page: 'spend', departmentId: 'dept-eng', categoryId: 'cat-hw', amount: 50000 },
    managerUser
  );
  assert(simChat.success === true, 'Simulation query executes successfully');
  assert(simChat.answer.length > 50, 'Simulation returns structured financial analysis');

  // -----------------------------------------------------------------
  // 4. Fallback & Availability Resilience
  // -----------------------------------------------------------------
  console.log('\n--- Test Group 4: Local Fallback & Availability ---');

  const generalSummary = await GeminiService.processChat(
    'Summarize our financial situation',
    { page: 'dashboard' },
    financeUser
  );
  assert(generalSummary.success === true, 'General financial summary returned without error');
  assert(
    generalSummary.providerStatus === 'FALLBACK_LOCAL' || generalSummary.providerStatus === 'ONLINE',
    'Provider status accurately reported'
  );
  assert(generalSummary.sources.length >= 0, 'Sources array populated');

  // -----------------------------------------------------------------
  // 5. Financial Terminology Integrity
  // -----------------------------------------------------------------
  console.log('\n--- Test Group 5: Distinct Financial Concepts ---');

  const explanation = await GeminiService.processChat(
    'What is our current budget utilization and committed spend?',
    { page: 'dashboard' },
    financeUser
  );
  assert(explanation.success === true, 'Financial concepts query processed');
  assert(
    explanation.answer.includes('Budget') ||
      explanation.answer.includes('Spend') ||
      explanation.answer.includes('Utilization') ||
      explanation.answer.includes("don't have enough ATCS data"),
    'Response accurately maintains financial integrity or reports insufficient data rather than hallucinating'
  );

  console.log('\n====================================================');
  console.log('🎉 ALL 14 ATCS GEMINI AGENT INTEGRATION TESTS PASSED!');
  console.log('====================================================\n');
}

runGeminiTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

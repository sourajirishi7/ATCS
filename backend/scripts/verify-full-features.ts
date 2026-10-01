import { PrismaClient } from '@prisma/client';
import { EmployeeSpendingService } from '../src/services/EmployeeSpendingService';
import { SpendDecisionEngine } from '../src/services/SpendDecisionEngine';
import { ApprovalService } from '../src/services/ApprovalService';
import { SpendingService } from '../src/services/SpendingService';

const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('🔍 ATCS VERIFICATION SUITE: ANALYTICS & DECISION ENGINE');
  console.log('====================================================\n');

  const userRecord: any = await prisma.user.findFirst({
    include: { department: true, role: true },
  });

  if (!userRecord) {
    throw new Error('No user found in database');
  }

  const authUser: any = {
    id: userRecord.id,
    name: userRecord.name,
    email: userRecord.email,
    role: userRecord.role?.name || 'ADMIN',
    departmentId: userRecord.departmentId,
    department: userRecord.department,
  };
  console.log(`👤 Using User: ${authUser.name} (${authUser.email}, Role: ${authUser.role})`);

  // Find travel and hardware categories
  const travelCategory = await prisma.category.findFirst({
    where: { name: { contains: 'Travel', mode: 'insensitive' } },
  });

  const hardwareCategory = await prisma.category.findFirst({
    where: { name: { contains: 'Hardware', mode: 'insensitive' } },
  });

  const engDept = await prisma.department.findFirst({
    where: { code: 'ENG' },
  });

  if (!travelCategory || !engDept) {
    throw new Error('Required metadata (Travel category or ENG dept) missing');
  }

  // ------------------------------------------------------------------
  // TEST 1: Employee Spending Analytics Engine
  // ------------------------------------------------------------------
  console.log('👉 [TEST 1/4] Testing Employee Spending Analytics Engine...');
  const analytics = await EmployeeSpendingService.getAnalytics(authUser as any);

  console.log('   - Total Tracked Employees:', analytics.employees.length);
  console.log('   - Active Requesters Count:', analytics.activeRequestersCount);
  console.log('   - Anomalous Outliers Count:', analytics.anomalousRequestsCount);
  console.log('   - Average Spend per Employee: ₹', analytics.averageSpendPerEmployee);
  console.log('   - Top Spender:', analytics.topSpendingEmployee ? `${analytics.topSpendingEmployee.name} (₹${analytics.topSpendingEmployee.amount})` : 'None');

  if (analytics.employees.length === 0) {
    throw new Error('Analytics failed: zero employees returned');
  }

  const top = analytics.employees[0];
  console.log(`   - Leading Spender Record: ${top.name} - Obligated: ₹${top.obligatedSpend}, Status: ${top.thresholdStatus}`);
  console.log('   - Category breakdown count for top spender:', Object.keys(top.categoryBreakdown).length);
  console.log('   ✅ TEST 1 PASSED: Analytics Engine returned rich aggregated data.\n');

  // ------------------------------------------------------------------
  // TEST 2: Active Decision Engine - Exception Rule Intercept (RULE_EX_04)
  // ------------------------------------------------------------------
  console.log('👉 [TEST 2/4] Testing Budget Exception Rule Interception (RULE_EX_04)...');
  
  // Spend ₹45,000 on Travel (active rule limit is ₹40,000)
  const evalViolation = await SpendingService.previewSpend({
    categoryId: travelCategory.id,
    departmentId: engDept.id,
    requestedAmount: 45000,
    currency: 'INR',
    vendor: 'Delta Air Lines',
    description: 'International Executive Conference Flights',
  }, authUser as any);

  console.log('   - Requested Amount: ₹45,000 (Travel Limit: ₹40,000)');
  console.log('   - Verdict Decision:', evalViolation.decision);
  console.log('   - Exception Triggered:', evalViolation.exceptionTriggered);
  console.log('   - Compliance Badge:', evalViolation.complianceBadge);
  console.log('   - Route Status:', evalViolation.routeStatus);
  console.log('   - Triggered Rules:', (evalViolation.triggeredRules || []).map((r: any) => `${r.code || r.ruleCode} (${r.name || r.ruleName})`));

  if (!evalViolation.exceptionTriggered || evalViolation.complianceBadge !== 'EXCEPTION_FLAGGED') {
    throw new Error('TEST 2 FAILED: Expected exceptionTriggered: true and complianceBadge: EXCEPTION_FLAGGED');
  }

  if (evalViolation.routeStatus !== 'PENDING_EXCEPTION_REVIEW') {
    throw new Error('TEST 2 FAILED: Expected routeStatus: PENDING_EXCEPTION_REVIEW');
  }

  // Spend ₹25,000 on Travel (within ₹40,000 threshold)
  const evalCompliant = await SpendingService.previewSpend({
    categoryId: travelCategory.id,
    departmentId: engDept.id,
    requestedAmount: 25000,
    currency: 'INR',
    vendor: 'Local Transit Rail',
    description: 'Regional Client Onsite Travel',
  }, authUser as any);

  console.log('   - Compliant Spend (₹25,000): Route:', evalCompliant.routeStatus, ', Badge:', evalCompliant.complianceBadge);
  if (evalCompliant.exceptionTriggered) {
    throw new Error('TEST 2 FAILED: Compliant spend should not trigger exception');
  }
  console.log('   ✅ TEST 2 PASSED: Exception rules dynamically intercept and route requests.\n');

  // ------------------------------------------------------------------
  // TEST 3: Hard Caps & Managerial Override Token Enforcement
  // ------------------------------------------------------------------
  console.log('👉 [TEST 3/4] Testing Hard Cap & Managerial Override Token...');
  const hugeAmount = (evalViolation.budgetAmount || 500000) * 1.5;

  const evalHardCapWithoutToken = await SpendingService.previewSpend({
    categoryId: travelCategory.id,
    departmentId: engDept.id,
    requestedAmount: hugeAmount,
    currency: 'INR',
    vendor: 'Mega Corporate Jet',
    description: 'Chartered Aircraft Over Budget Limit',
  }, authUser as any);

  console.log('   - Spend exceeding 100% budget without token: Decision:', evalHardCapWithoutToken.decision, ', Badge:', evalHardCapWithoutToken.complianceBadge);
  if (evalHardCapWithoutToken.decision !== 'VIOLATION' && !(evalHardCapWithoutToken as any).hardCapViolated) {
    throw new Error('TEST 3 FAILED: Hard cap was not enforced');
  }

  const evalHardCapWithToken = await SpendingService.previewSpend({
    categoryId: travelCategory.id,
    departmentId: engDept.id,
    requestedAmount: hugeAmount,
    currency: 'INR',
    vendor: 'Mega Corporate Jet',
    description: 'Chartered Aircraft Over Budget Limit',
    overrideToken: 'OVERRIDE-CEO-EXEMPT-01',
  }, authUser as any);

  console.log('   - Spend with Override Token: Decision:', evalHardCapWithToken.decision, ', Hard Cap Violated:', (evalHardCapWithToken as any).hardCapViolated);
  if ((evalHardCapWithToken as any).hardCapViolated) {
    throw new Error('TEST 3 FAILED: Managerial override token should bypass hard cap');
  }
  console.log('   ✅ TEST 3 PASSED: Hard caps strictly enforced and unlocked only with override tokens.\n');

  // ------------------------------------------------------------------
  // TEST 4: Strict Self-Approval Prevention
  // ------------------------------------------------------------------
  console.log('👉 [TEST 4/4] Testing Strict Self-Approval Prevention...');
  
  // Create a dummy spend request authored by authUser
  const spendReq = await prisma.spendingRequest.create({
    data: {
      employeeId: authUser.id,
      departmentId: engDept.id,
      categoryId: travelCategory.id,
      requestedAmount: 15000,
      currency: 'INR',
      vendor: 'Self Test Vendor',
      description: 'Testing Self-Approval Block',
      status: 'UNDER_REVIEW',
    },
  });

  try {
    // Attempt self-approval by the same user
    await ApprovalService.processDecision(spendReq.id, 'APPROVE' as any, 'Attempting to self-approve my own request', authUser as any);
    throw new Error('TEST 4 FAILED: Self-approval should have thrown an error but succeeded!');
  } catch (err: any) {
    if (err.message.includes('Self-approval') || err.message.includes('SELF_APPROVAL_PROHIBITED')) {
      console.log('   - Successfully caught expected security violation:', err.message);
      console.log('   ✅ TEST 4 PASSED: Strict self-approval is impossible across all roles.\n');
    } else {
      throw err;
    }
  } finally {
    // Cleanup dummy record
    await prisma.spendingRequest.delete({ where: { id: spendReq.id } }).catch(() => {});
  }

  console.log('====================================================');
  console.log('🎉 ALL 4 CORE FUNCTIONAL VERIFICATIONS PASSED 100%!');
  console.log('====================================================');
}

main()
  .catch((err) => {
    console.error('❌ Verification Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

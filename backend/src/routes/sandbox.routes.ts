import { Router } from 'express';
import { prisma, toDecimal } from '../prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { SpendDecisionEngine } from '../services/SpendDecisionEngine';
import { SpendingService } from '../services/SpendingService';
import { RoleType } from '../models/types';
import Decimal from 'decimal.js';

const router = Router();

/**
 * Execute or Simulate the 3 Mandatory Demonstration Scenarios
 */
router.post('/scenario/:scenarioType', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { scenarioType } = req.params; // 'A', 'B', or 'C'
    const simulateOnly = req.query.simulate === 'true';

    // Fetch Engineering department
    const dept = await prisma.department.findFirst({
      where: { code: 'ENG' },
    });
    if (!dept) {
      res.status(404).json({ success: false, message: 'Engineering department not found in database.' });
      return;
    }

    const cat = await prisma.category.findFirst({
      where: { code: 'SW_CLOUD' },
    });
    if (!cat) {
      res.status(404).json({ success: false, message: 'Software & Cloud category not found.' });
      return;
    }

    // Configure test parameters based on Scenario
    let scenarioConfig = {
      name: '',
      description: '',
      budget: 100000,
      actual: 0,
      committed: 0,
      requestAmount: 0,
      vendor: '',
      expectedVerdict: '',
    };

    if (scenarioType === 'A') {
      scenarioConfig = {
        name: 'Scenario A: Clean Approval',
        description: 'Spend is comfortably within budget and below approval thresholds.',
        budget: 100000,
        actual: 20000,
        committed: 10000,
        requestAmount: 5000,
        vendor: 'GitHub Enterprise Suite',
        expectedVerdict: 'APPROVE',
      };
    } else if (scenarioType === 'B') {
      scenarioConfig = {
        name: 'Scenario B: Approval Required',
        description: 'Spend is within budget, but request amount crosses the configured approval threshold.',
        budget: 100000,
        actual: 50000,
        committed: 20000,
        requestAmount: 20000,
        vendor: 'DataDog Observability Cloud',
        expectedVerdict: 'APPROVAL_REQUIRED',
      };
    } else if (scenarioType === 'C') {
      scenarioConfig = {
        name: 'Scenario C: Budget Violation Overrun',
        description: 'Actual + Committed + Proposed exceeds the approved budget ceiling.',
        budget: 100000,
        actual: 60000,
        committed: 30000,
        requestAmount: 20000,
        vendor: 'AWS High-Performance GPU Cluster',
        expectedVerdict: 'VIOLATION',
      };
    } else {
      res.status(400).json({ success: false, message: 'Unknown scenario. Valid options: A, B, C' });
      return;
    }

    // Load active rules
    const [approvalRules, budgetRules] = await Promise.all([
      prisma.approvalRule.findMany({ where: { enabled: true } }),
      prisma.budgetRule.findMany({ where: { enabled: true }, orderBy: { priority: 'asc' } }),
    ]);

    // Run SpendDecisionEngine
    const evaluation = SpendDecisionEngine.evaluate({
      employee: {
        id: req.user!.id,
        role: req.user!.role,
        departmentId: dept.id,
      },
      department: {
        id: dept.id,
        name: dept.name,
        status: dept.status,
      },
      category: {
        id: cat.id,
        name: cat.name,
        status: cat.status,
      },
      requestedAmount: scenarioConfig.requestAmount,
      currency: 'INR',
      budget: {
        id: 'sandbox-budget-id',
        budgetAmount: scenarioConfig.budget,
        currency: 'INR',
        status: 'ACTIVE',
      },
      actualSpend: scenarioConfig.actual,
      committedSpend: scenarioConfig.committed,
      approvalRules: approvalRules.map((r) => ({ ...r, requiredRole: r.requiredRole as RoleType })),
      budgetRules,
    });

    res.json({
      success: true,
      data: {
        scenario: scenarioConfig,
        evaluation,
        verdictMatchesExpectation: evaluation.decision === scenarioConfig.expectedVerdict,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

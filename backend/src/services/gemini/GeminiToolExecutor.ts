import { prisma, toDecimalNumber } from '../../prisma';
import { RoleType, DecisionVerdict, SpendingStatus, CommitmentStatus, ForecastStatus } from '../../models/types';
import { AuthUser } from '../../middleware/auth';
import { BudgetService } from '../BudgetService';
import { SpendingService } from '../SpendingService';
import { SpendDecisionEngine } from '../SpendDecisionEngine';
import { DashboardService } from '../DashboardService';
import { ClientBudgetService } from '../ClientBudgetService';
import { ForecastService } from '../ForecastService';
import { AlertService } from '../AlertService';
import { AuditService } from '../AuditService';
import { TransactionService } from '../TransactionService';
import { CommitmentService } from '../CommitmentService';
import Decimal from 'decimal.js';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data: any;
  sources: Array<{ type: string; id?: string; name: string; summary: string }>;
  error?: string;
}

export class GeminiToolExecutor {
  /**
   * Enforces RBAC check before running any tool.
   * Employees can only view own requests and assigned department data.
   * Managers can only view own department data.
   * Finance and Admins have enterprise-wide access.
   */
  private static checkDepartmentAccess(user: AuthUser, departmentId?: string | null): boolean {
    if (user.role === RoleType.ADMIN || user.role === RoleType.FINANCE) {
      return true;
    }
    if (!departmentId) {
      return true; // No specific department targeted
    }
    return user.departmentId === departmentId;
  }

  /**
   * Tool 1: get_dashboard_summary
   */
  public static async getDashboardSummary(user: AuthUser): Promise<ToolExecutionResult> {
    try {
      const summary = await DashboardService.getSummary(user);
      return {
        toolName: 'get_dashboard_summary',
        success: true,
        data: {
          kpis: summary.kpis,
          departments: summary.departments,
          topCategories: summary.categories.slice(0, 5),
          hasData: summary.hasData,
        },
        sources: [
          {
            type: 'Dashboard',
            name: 'Executive Dashboard Summary',
            summary: `Active Budget: ₹${summary.kpis.totalBudget.toLocaleString()}, Actual: ₹${summary.kpis.actualSpend.toLocaleString()}, Committed: ₹${summary.kpis.committedSpend.toLocaleString()}, Utilization: ${summary.kpis.overallUtilization}%`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_dashboard_summary',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 2: get_department_budget
   */
  public static async getDepartmentBudget(
    departmentId: string,
    user: AuthUser
  ): Promise<ToolExecutionResult> {
    if (!this.checkDepartmentAccess(user, departmentId)) {
      return {
        toolName: 'get_department_budget',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: You are not authorized to view financial records of another department.',
      };
    }

    try {
      const budget = await BudgetService.getActiveBudgetForDepartment(departmentId);
      if (!budget) {
        return {
          toolName: 'get_department_budget',
          success: true,
          data: { message: 'No active budget configured for this department.' },
          sources: [],
        };
      }

      const totals = await BudgetService.calculateSpendTotals(departmentId);
      const budgetAmt = toDecimalNumber(budget.budgetAmount);
      const actual = toDecimalNumber(totals.actualSpend);
      const committed = toDecimalNumber(totals.committedSpend);
      const available = budgetAmt - actual - committed;
      const utilPct = budgetAmt > 0 ? Number((((actual + committed) / budgetAmt) * 100).toFixed(1)) : 0;

      return {
        toolName: 'get_department_budget',
        success: true,
        data: {
          budgetId: budget.id,
          departmentName: budget.department.name,
          fiscalPeriod: budget.fiscalPeriod,
          budgetAmount: budgetAmt,
          actualSpend: actual,
          committedSpend: committed,
          availableBudget: available,
          utilizationPercentage: utilPct,
          currency: budget.currency,
          allocations: budget.allocations.map((a) => ({
            categoryName: a.category.name,
            allocatedAmount: toDecimalNumber(a.allocatedAmount),
          })),
        },
        sources: [
          {
            type: 'Budget',
            id: budget.id,
            name: `${budget.department.name} Active Budget (${budget.fiscalPeriod})`,
            summary: `Approved Budget: ₹${budgetAmt.toLocaleString()} | Utilization: ${utilPct}%`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_department_budget',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 3: get_department_utilization
   */
  public static async getDepartmentUtilization(
    departmentId: string,
    user: AuthUser
  ): Promise<ToolExecutionResult> {
    if (!this.checkDepartmentAccess(user, departmentId)) {
      return {
        toolName: 'get_department_utilization',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: You are not authorized to view utilization for this department.',
      };
    }

    try {
      const budget = await BudgetService.getActiveBudgetForDepartment(departmentId);
      if (!budget) {
        return {
          toolName: 'get_department_utilization',
          success: true,
          data: { message: 'No active budget found to calculate utilization.' },
          sources: [],
        };
      }

      const utilization = await BudgetService.getBudgetUtilization(budget.id);
      return {
        toolName: 'get_department_utilization',
        success: true,
        data: utilization,
        sources: [
          {
            type: 'UtilizationReport',
            id: budget.id,
            name: `${utilization.departmentName} Utilization`,
            summary: `Overall: ${utilization.utilizationPercentage}% (${utilization.actualSpend} actual + ${utilization.committedSpend} committed)`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_department_utilization',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 4: get_spending_request
   * Explains decision snapshot with violations, warnings, rules evaluated.
   */
  public static async getSpendingRequest(
    requestId: string,
    user: AuthUser
  ): Promise<ToolExecutionResult> {
    try {
      const request = await prisma.spendingRequest.findUnique({
        where: { id: requestId },
        include: {
          employee: { select: { id: true, name: true, email: true, departmentId: true } },
          department: true,
          category: true,
          approvals: {
            include: { approver: { select: { name: true, email: true } } },
          },
          decisionSnapshot: true,
          commitment: true,
        },
      });

      if (!request) {
        return {
          toolName: 'get_spending_request',
          success: false,
          data: null,
          sources: [],
          error: `Spending request '${requestId}' not found.`,
        };
      }

      // RBAC: Employee can only view own requests
      if (user.role === RoleType.EMPLOYEE && request.employeeId !== user.id) {
        return {
          toolName: 'get_spending_request',
          success: false,
          data: null,
          sources: [],
          error: 'Access denied: You are not authorized to view spending requests made by other employees.',
        };
      }

      // RBAC: Manager can only view own department requests
      if (user.role === RoleType.MANAGER && user.departmentId !== request.departmentId) {
        return {
          toolName: 'get_spending_request',
          success: false,
          data: null,
          sources: [],
          error: 'Access denied: Spending request belongs to another department.',
        };
      }

      let parsedSnapshot = null;
      if (request.decisionSnapshot) {
        parsedSnapshot = {
          decision: request.decisionSnapshot.decision,
          budgetStatus: request.decisionSnapshot.budgetStatus,
          budgetAmount: toDecimalNumber(request.decisionSnapshot.budgetAmount),
          actualSpend: toDecimalNumber(request.decisionSnapshot.actualSpend),
          committedSpend: toDecimalNumber(request.decisionSnapshot.committedSpend),
          requestedAmount: toDecimalNumber(request.decisionSnapshot.requestedAmount),
          utilizationBefore: toDecimalNumber(request.decisionSnapshot.utilizationBefore),
          utilizationAfter: toDecimalNumber(request.decisionSnapshot.utilizationAfter),
          remainingBefore: toDecimalNumber(request.decisionSnapshot.remainingBefore),
          remainingAfter: toDecimalNumber(request.decisionSnapshot.remainingAfter),
          violations: JSON.parse(request.decisionSnapshot.violations || '[]'),
          warnings: JSON.parse(request.decisionSnapshot.warnings || '[]'),
          reasons: JSON.parse(request.decisionSnapshot.reasons || '[]'),
          calculatedAt: request.decisionSnapshot.calculatedAt,
        };
      }

      return {
        toolName: 'get_spending_request',
        success: true,
        data: {
          id: request.id,
          employeeName: request.employee.name,
          departmentName: request.department.name,
          categoryName: request.category.name,
          requestedAmount: toDecimalNumber(request.requestedAmount),
          currency: request.currency,
          vendor: request.vendor,
          description: request.description,
          status: request.status,
          requestedDate: request.requestedDate,
          decisionSnapshot: parsedSnapshot,
          approvals: request.approvals.map((a) => ({
            approverName: a.approver.name,
            decision: a.decision,
            comments: a.comments,
            decidedAt: a.decidedAt,
          })),
        },
        sources: [
          {
            type: 'SpendingRequest',
            id: request.id,
            name: `Request by ${request.employee.name} (₹${toDecimalNumber(request.requestedAmount).toLocaleString()})`,
            summary: `Status: ${request.status} | Verdict: ${parsedSnapshot?.decision || 'PENDING'}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_spending_request',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 5: simulate_spending
   * "What happens if I spend ₹50,000 more?"
   * Pure calculation through SpendDecisionEngine.
   */
  public static async simulateSpending(
    params: {
      departmentId: string;
      categoryId: string;
      amount: number;
    },
    user: AuthUser
  ): Promise<ToolExecutionResult> {
    if (!this.checkDepartmentAccess(user, params.departmentId)) {
      return {
        toolName: 'simulate_spending',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: You cannot simulate spending for another department.',
      };
    }

    try {
      const department = await prisma.department.findUnique({
        where: { id: params.departmentId },
      });
      if (!department) {
        return {
          toolName: 'simulate_spending',
          success: false,
          data: null,
          sources: [],
          error: `Department '${params.departmentId}' not found.`,
        };
      }

      const category = await prisma.category.findUnique({
        where: { id: params.categoryId },
      });
      if (!category) {
        return {
          toolName: 'simulate_spending',
          success: false,
          data: null,
          sources: [],
          error: `Category '${params.categoryId}' not found.`,
        };
      }

      const budget = await BudgetService.getActiveBudgetForDepartment(params.departmentId);
      const totals = await BudgetService.calculateSpendTotals(params.departmentId, params.categoryId);

      const [approvalRules, budgetRules] = await Promise.all([
        prisma.approvalRule.findMany({ where: { enabled: true } }),
        prisma.budgetRule.findMany({ where: { enabled: true }, orderBy: { priority: 'asc' } }),
      ]);

      let catAlloc = null;
      if (budget) {
        const match = budget.allocations.find((a) => a.categoryId === params.categoryId);
        if (match) catAlloc = match.allocatedAmount;
      }

      const evaluation = SpendDecisionEngine.evaluate({
        employee: {
          id: user.id,
          role: user.role,
          departmentId: user.departmentId,
        },
        department: {
          id: department.id,
          name: department.name,
          status: department.status,
        },
        category: {
          id: category.id,
          name: category.name,
          status: category.status,
        },
        requestedAmount: params.amount,
        currency: 'INR',
        budget: budget
          ? {
              id: budget.id,
              budgetAmount: budget.budgetAmount,
              currency: budget.currency,
              status: budget.status,
              categoryAllocation: catAlloc,
            }
          : null,
        actualSpend: totals.actualSpend,
        committedSpend: totals.committedSpend,
        approvalRules: approvalRules.map((r) => ({ ...r, requiredRole: r.requiredRole as RoleType })),
        budgetRules,
      });

      return {
        toolName: 'simulate_spending',
        success: true,
        data: {
          departmentName: department.name,
          categoryName: category.name,
          proposedAmount: params.amount,
          ...evaluation,
        },
        sources: [
          {
            type: 'SpendSimulation',
            name: `Spend Decision Simulation (₹${params.amount.toLocaleString()} in ${category.name})`,
            summary: `Verdict: ${evaluation.decision} | Projected Utilization: ${evaluation.utilizationAfter}%`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'simulate_spending',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 6: get_commitments
   */
  public static async getCommitments(
    departmentId?: string,
    user?: AuthUser
  ): Promise<ToolExecutionResult> {
    if (user && !this.checkDepartmentAccess(user, departmentId)) {
      return {
        toolName: 'get_commitments',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: You cannot view commitments for this department.',
      };
    }

    try {
      const commitments = await CommitmentService.getCommitments(
        user || ({ id: 'system', role: RoleType.ADMIN } as AuthUser),
        CommitmentStatus.ACTIVE
      );

      const filtered = departmentId
        ? commitments.filter((c: any) => c.spendingRequest.departmentId === departmentId)
        : commitments;

      const totalOutstanding = filtered.reduce(
        (sum: number, c: any) => sum + toDecimalNumber(c.remainingAmount),
        0
      );

      return {
        toolName: 'get_commitments',
        success: true,
        data: {
          count: filtered.length,
          totalOutstandingAmount: totalOutstanding,
          commitments: filtered.slice(0, 15).map((c: any) => ({
            id: c.id,
            remainingAmount: toDecimalNumber(c.remainingAmount),
            status: c.status,
            vendor: c.spendingRequest.vendor,
            department: c.spendingRequest.department.name,
            category: c.spendingRequest.category.name,
            createdAt: c.createdAt,
          })),
        },
        sources: [
          {
            type: 'CommitmentsLedger',
            name: 'Active Commitments Ledger',
            summary: `${filtered.length} active commitments totaling ₹${totalOutstanding.toLocaleString()}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_commitments',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 7: get_transactions
   */
  public static async getTransactions(
    params: { departmentId?: string; categoryId?: string; limit?: number },
    user: AuthUser
  ): Promise<ToolExecutionResult> {
    if (!this.checkDepartmentAccess(user, params.departmentId)) {
      return {
        toolName: 'get_transactions',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: You cannot view transactions for another department.',
      };
    }

    try {
      const deptFilter =
        user.role === RoleType.MANAGER && user.departmentId ? user.departmentId : params.departmentId;

      const result = await TransactionService.getTransactions({
        departmentId: deptFilter,
        categoryId: params.categoryId,
        limit: Math.min(params.limit || 20, 50),
      });

      return {
        toolName: 'get_transactions',
        success: true,
        data: {
          totalCount: result.total,
          transactions: result.transactions.map((t) => ({
            id: t.id,
            amount: toDecimalNumber(t.amount),
            currency: t.currency,
            vendor: t.vendor,
            referenceNumber: t.referenceNumber,
            date: t.transactionDate,
            department: t.department.name,
            category: t.category.name,
            status: t.status,
          })),
        },
        sources: [
          {
            type: 'TransactionLedger',
            name: 'Settled Transactions Ledger',
            summary: `Retrieved ${result.transactions.length} of ${result.total} transactions`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_transactions',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 8: get_forecast
   */
  public static async getForecast(
    departmentId: string,
    categoryId?: string,
    user?: AuthUser
  ): Promise<ToolExecutionResult> {
    if (user && !this.checkDepartmentAccess(user, departmentId)) {
      return {
        toolName: 'get_forecast',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: You cannot view forecasting models for another department.',
      };
    }

    try {
      const forecast = await ForecastService.evaluateDepartmentForecast(departmentId, categoryId);
      return {
        toolName: 'get_forecast',
        success: true,
        data: forecast,
        sources: [
          {
            type: 'ForecastModel',
            name: `Department Spend Forecast (${forecast.period || 'Current'})`,
            summary: `Projected: ₹${forecast.projectedAmount.toLocaleString()} vs Budget ₹${forecast.budgetAmount.toLocaleString()} (Status: ${forecast.status})`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_forecast',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 9: get_alerts
   */
  public static async getAlerts(
    departmentId?: string,
    user?: AuthUser
  ): Promise<ToolExecutionResult> {
    if (user && !this.checkDepartmentAccess(user, departmentId)) {
      return {
        toolName: 'get_alerts',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: You cannot view alerts for another department.',
      };
    }

    try {
      const deptFilter =
        user && user.role === RoleType.MANAGER && user.departmentId ? user.departmentId : departmentId;

      const alerts = await AlertService.getAlerts({ departmentId: deptFilter });
      return {
        toolName: 'get_alerts',
        success: true,
        data: {
          count: alerts.length,
          alerts: alerts.slice(0, 15).map((a) => ({
            id: a.id,
            type: a.type,
            severity: a.severity,
            message: a.message,
            department: a.department.name,
            category: a.category?.name || 'General',
            status: a.status,
            createdAt: a.createdAt,
          })),
        },
        sources: [
          {
            type: 'FinancialAlerts',
            name: 'Active Financial Alerts',
            summary: `${alerts.length} active or unresolved control alerts`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_alerts',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 10: get_client_quotation
   * Client Contract & Quotation Hub, Client Quotation & Budget
   */
  public static async getClientQuotation(
    quotationId?: string,
    user?: AuthUser
  ): Promise<ToolExecutionResult> {
    // Only FINANCE, MANAGER, ADMIN can inspect full client quotations
    if (user && user.role === RoleType.EMPLOYEE) {
      return {
        toolName: 'get_client_quotation',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: Employee role cannot access client contract quotation margins.',
      };
    }

    try {
      const analytics = await ClientBudgetService.getClientQuotationAnalytics(quotationId);
      return {
        toolName: 'get_client_quotation',
        success: true,
        data: analytics,
        sources: [
          {
            type: 'ClientQuotation',
            id: analytics.quotation.id,
            name: `Quotation: ${analytics.quotation.clientName} - ${analytics.quotation.projectName}`,
            summary: `Proposed: ₹${analytics.financialSummary.grossProposedBudget.toLocaleString()} | Leftover: ₹${analytics.financialSummary.leftoverBudget.toLocaleString()} | Margin: ${analytics.financialSummary.profitMarginPct}%`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_client_quotation',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }

  /**
   * Tool 11: get_audit_history
   */
  public static async getAuditHistory(
    entityId: string,
    user: AuthUser
  ): Promise<ToolExecutionResult> {
    if (user.role === RoleType.EMPLOYEE) {
      return {
        toolName: 'get_audit_history',
        success: false,
        data: null,
        sources: [],
        error: 'Access denied: Employees cannot view corporate audit trail logs.',
      };
    }

    try {
      const logs = await AuditService.getLogs({ entityId, limit: 10 });
      return {
        toolName: 'get_audit_history',
        success: true,
        data: logs,
        sources: [
          {
            type: 'AuditLog',
            name: `Audit History for ${entityId}`,
            summary: `Found ${logs.total} audit events`,
          },
        ],
      };
    } catch (err: any) {
      return {
        toolName: 'get_audit_history',
        success: false,
        data: null,
        sources: [],
        error: err.message,
      };
    }
  }
}

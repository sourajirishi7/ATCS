export type RoleType = 'EMPLOYEE' | 'MANAGER' | 'FINANCE' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  costCenter: string;
  status: string;
  budgets?: Budget[];
  _count?: { users: number; spendingRequests: number };
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: string;
}

export interface BudgetAllocation {
  id: string;
  budgetId: string;
  categoryId: string;
  allocatedAmount: number;
  category: Category;
}

export interface Budget {
  id: string;
  departmentId: string;
  department: Department;
  fiscalPeriod: string;
  budgetAmount: number;
  currency: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'EXPIRED' | 'CANCELLED';
  allocations: BudgetAllocation[];
}

export type ComplianceBadge = 'EXCEPTION_FLAGGED' | 'OVERRIDE_REQUIRED' | 'AUTO_COMPLIANT';

export interface TriggeredRuleInfo {
  ruleId?: string;
  ruleCode?: string;
  code?: string;
  ruleName?: string;
  name?: string;
  ruleType?: string;
  description?: string;
  message?: string;
  severity?: 'VIOLATION' | 'EXCEPTION' | 'WARNING' | string;
  action?: string;
}

export interface DecisionEvaluationOutput {
  decision: 'APPROVE' | 'APPROVAL_REQUIRED' | 'WARNING' | 'VIOLATION' | 'INSUFFICIENT_DATA' | 'CONFIGURATION_ERROR';
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
  exceptionTriggered?: boolean;
  complianceBadge?: ComplianceBadge;
  routeStatus?: string;
  triggeredRules?: TriggeredRuleInfo[];
}

export interface SpendingRequest {
  id: string;
  employeeId: string;
  employee: { id: string; name: string; email: string };
  departmentId: string;
  department: Department;
  categoryId: string;
  category: Category;
  requestedAmount: number;
  currency: string;
  description: string;
  vendor: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMMITTED' | 'CANCELLED';
  complianceBadge?: ComplianceBadge;
  routeStatus?: string;
  triggeredRules?: TriggeredRuleInfo[];
  exceptionTriggered?: boolean;
  commitment?: Commitment | null;
  decisionSnapshot?: DecisionSnapshot | null;
  approvals?: any[];
  createdAt: string;
}

export interface Commitment {
  id: string;
  spendingRequestId: string;
  spendingRequest?: SpendingRequest;
  committedAmount: number;
  remainingAmount: number;
  status: 'ACTIVE' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'CANCELLED';
  transactions?: Transaction[];
  createdAt: string;
}

export interface Transaction {
  id: string;
  employeeId: string;
  employee: { id: string; name: string; email: string };
  departmentId: string;
  department: Department;
  categoryId: string;
  category: Category;
  amount: number;
  currency: string;
  transactionDate: string;
  vendor: string;
  referenceNumber: string;
  source: 'MANUAL' | 'CSV_IMPORT' | 'API';
  status: 'RECORDED' | 'RECONCILED' | 'REVERSED';
  commitmentId?: string | null;
  commitment?: Commitment | null;
  createdAt: string;
}

export interface DecisionSnapshot {
  id: string;
  spendingRequestId: string;
  budgetAmount: number;
  actualSpend: number;
  committedSpend: number;
  requestedAmount: number;
  utilizationBefore: number;
  utilizationAfter: number;
  remainingBefore: number;
  remainingAfter: number;
  decision: string;
  budgetStatus: string;
  violations: string[];
  warnings: string[];
  reasons: string[] | string | any;
  engineVersion: string;
  calculatedAt: string;
  complianceBadge?: ComplianceBadge;
  routeStatus?: string;
  triggeredRules?: TriggeredRuleInfo[];
  exceptionTriggered?: boolean;
  spendingRequest?: SpendingRequest;
}

export interface EmployeeSpendRecord {
  id: string;
  name: string;
  email: string;
  department: string;
  departmentId: string;
  role: string;
  committedSpend: number;
  settledSpend: number;
  obligatedSpend: number;
  requestCount: number;
  transactionCount: number;
  averageTicketSize: number;
  thresholdStatus: 'WITHIN_TYPICAL' | 'ELEVATED' | 'OUTLIER_THRESHOLD';
  categoryBreakdown: Record<string, number>;
}

export interface EmployeeAnalyticsSummary {
  topSpendingEmployee: {
    name: string;
    amount: number;
    department: string;
  } | null;
  averageSpendPerEmployee: number;
  activeRequestersCount: number;
  anomalousRequestsCount: number;
  categoryList: string[];
  employees: EmployeeSpendRecord[];
  departmentBreakdown: Array<{
    department: string;
    spend: number;
  }>;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  departmentId: string;
  department: Department;
  categoryId?: string | null;
  category?: Category | null;
  relatedRequestId?: string | null;
  message: string;
  status: 'ACTIVE' | 'RESOLVED';
  createdAt: string;
}

export interface ForecastData {
  departmentId: string;
  categoryId?: string | null;
  period: string;
  historicalSpend: number;
  currentBurnRate: number;
  projectedAmount: number;
  budgetAmount: number;
  variance: number;
  confidence: number;
  methodology: string;
  status: 'WITHIN_FORECAST' | 'NEAR_FORECAST_LIMIT' | 'PROJECTED_VIOLATION' | 'INSUFFICIENT_DATA';
  reason: string;
  trendData?: Array<{ date: string; dailySpend: number; cumulativeSpend: number }>;
}

export interface DashboardSummary {
  kpis: {
    totalBudget: number;
    actualSpend: number;
    committedSpend: number;
    availableBudget: number;
    overallUtilization: number;
    projectedSpend: number;
    activeViolationsCount: number;
    pendingApprovalsCount: number;
    transactionCount: number;
    commitmentCount: number;
  };
  departments: Array<{
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    budget: number;
    actual: number;
    committed: number;
    available: number;
    utilization: number;
  }>;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    categoryCode: string;
    actual: number;
    committed: number;
    total: number;
  }>;
  recentTransactions: Array<{
    id: string;
    amount: number;
    transactionDate: string;
    vendor: string;
    referenceNumber: string;
    category: string;
  }>;
  hasData: boolean;
}

export interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  department: string;
  status: string;
  totalRequests: number;
  totalCommitted: number;
  recentActivity: Array<{
    id: string;
    amount: number;
    status: string;
    date: string;
    description: string;
  }>;
}

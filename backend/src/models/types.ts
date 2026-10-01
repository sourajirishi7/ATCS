export enum RoleType {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  FINANCE = 'FINANCE',
  ADMIN = 'ADMIN',
}

export enum BudgetStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum SpendingStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMMITTED = 'COMMITTED',
  CANCELLED = 'CANCELLED',
}

export enum CommitmentStatus {
  ACTIVE = 'ACTIVE',
  PARTIALLY_SETTLED = 'PARTIALLY_SETTLED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

export enum TransactionStatus {
  RECORDED = 'RECORDED',
  RECONCILED = 'RECONCILED',
  REVERSED = 'REVERSED',
}

export enum TransactionSource {
  MANUAL = 'MANUAL',
  CSV_IMPORT = 'CSV_IMPORT',
  API = 'API',
}

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DecisionVerdict {
  APPROVE = 'APPROVE',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  WARNING = 'WARNING',
  VIOLATION = 'VIOLATION',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
}

export enum ForecastStatus {
  WITHIN_FORECAST = 'WITHIN_FORECAST',
  NEAR_FORECAST_LIMIT = 'NEAR_FORECAST_LIMIT',
  PROJECTED_VIOLATION = 'PROJECTED_VIOLATION',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
}

export enum ExceptionDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type ComplianceBadge = 'EXCEPTION_FLAGGED' | 'OVERRIDE_REQUIRED' | 'AUTO_COMPLIANT';

export interface TriggeredExceptionRule {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  description: string;
  severity: 'VIOLATION' | 'EXCEPTION' | 'WARNING';
  action: string;
}

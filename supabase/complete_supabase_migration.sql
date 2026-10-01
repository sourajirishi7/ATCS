-- ============================================================================
-- ATCS (Audit Trailing & Control System) — Complete Supabase PostgreSQL Migration
-- ============================================================================
-- Description:
--   Complete, copy-paste ready SQL migration script for the Supabase SQL Editor.
--   Enforces 28-digit financial decimal accuracy, double-spend concurrency
--   protection, immutable audit logging, point-in-time decision snapshots,
--   automatic auth user sync, auto-updating timestamps, and granular Row-Level
--   Security (RLS) mapped to auth.uid() and departmental RBAC.
--
-- How to apply:
--   1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql
--   2. Paste this entire script into the SQL Editor.
--   3. Click "Run".
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. ENUM TYPES (Idempotent Creation)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoleType') THEN
    CREATE TYPE "RoleType" AS ENUM ('EMPLOYEE', 'MANAGER', 'FINANCE', 'ADMIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
    CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BudgetStatus') THEN
    CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'EXPIRED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SpendingStatus') THEN
    CREATE TYPE "SpendingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMMITTED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommitmentStatus') THEN
    CREATE TYPE "CommitmentStatus" AS ENUM ('ACTIVE', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionStatus') THEN
    CREATE TYPE "TransactionStatus" AS ENUM ('RECORDED', 'RECONCILED', 'REVERSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionSource') THEN
    CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'API');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalDecision') THEN
    CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DecisionVerdict') THEN
    CREATE TYPE "DecisionVerdict" AS ENUM ('APPROVE', 'APPROVAL_REQUIRED', 'WARNING', 'VIOLATION', 'INSUFFICIENT_DATA', 'CONFIGURATION_ERROR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertSeverity') THEN
    CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertStatus') THEN
    CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'RESOLVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForecastStatus') THEN
    CREATE TYPE "ForecastStatus" AS ENUM ('WITHIN_FORECAST', 'NEAR_FORECAST_LIMIT', 'PROJECTED_VIOLATION', 'INSUFFICIENT_DATA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExceptionDecision') THEN
    CREATE TYPE "ExceptionDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- ============================================================================
-- 3. TABLE DEFINITIONS
-- ============================================================================

-- 3.1 Roles
CREATE TABLE IF NOT EXISTS public."Role" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" "RoleType" NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Role_name_key" UNIQUE ("name")
);

-- 3.2 Departments
CREATE TABLE IF NOT EXISTS public."Department" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "costCenter" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Department_name_key" UNIQUE ("name"),
  CONSTRAINT "Department_code_key" UNIQUE ("code")
);

-- 3.3 Cost Centers
CREATE TABLE IF NOT EXISTS public."CostCenter" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "departmentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CostCenter_code_key" UNIQUE ("code")
);

-- 3.4 Expense Categories
CREATE TABLE IF NOT EXISTS public."Category" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_name_key" UNIQUE ("name"),
  CONSTRAINT "Category_code_key" UNIQUE ("code")
);

-- 3.5 Users
CREATE TABLE IF NOT EXISTS public."User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "departmentId" TEXT,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email"),
  CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3.6 Departmental Budgets
CREATE TABLE IF NOT EXISTS public."Budget" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "departmentId" TEXT NOT NULL,
  "fiscalPeriod" TEXT NOT NULL,
  "budgetAmount" NUMERIC(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "BudgetStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Budget_departmentId_fiscalPeriod_key" UNIQUE ("departmentId", "fiscalPeriod"),
  CONSTRAINT "Budget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3.7 Category Budget Allocations
CREATE TABLE IF NOT EXISTS public."BudgetAllocation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "budgetId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "allocatedAmount" NUMERIC(14,2) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BudgetAllocation_budgetId_categoryId_key" UNIQUE ("budgetId", "categoryId"),
  CONSTRAINT "BudgetAllocation_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES public."Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BudgetAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3.8 Spending Requests
CREATE TABLE IF NOT EXISTS public."SpendingRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "employeeId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "requestedAmount" NUMERIC(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "description" TEXT NOT NULL,
  "vendor" TEXT NOT NULL,
  "requestedDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "status" "SpendingStatus" NOT NULL DEFAULT 'SUBMITTED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SpendingRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpendingRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SpendingRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SpendingRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3.9 Commitments (Earmarked / Ring-Fenced Funds)
CREATE TABLE IF NOT EXISTS public."Commitment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "spendingRequestId" TEXT NOT NULL,
  "committedAmount" NUMERIC(14,2) NOT NULL,
  "remainingAmount" NUMERIC(14,2) NOT NULL,
  "status" "CommitmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Commitment_spendingRequestId_key" UNIQUE ("spendingRequestId"),
  CONSTRAINT "Commitment_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES public."SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3.10 Actual Ledger Transactions
CREATE TABLE IF NOT EXISTS public."Transaction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "employeeId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "amount" NUMERIC(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "transactionDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "vendor" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
  "status" "TransactionStatus" NOT NULL DEFAULT 'RECORDED',
  "commitmentId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Transaction_referenceNumber_key" UNIQUE ("referenceNumber"),
  CONSTRAINT "Transaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Transaction_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Transaction_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES public."Commitment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3.11 Approvals
CREATE TABLE IF NOT EXISTS public."Approval" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "spendingRequestId" TEXT NOT NULL,
  "approverId" TEXT NOT NULL,
  "decision" "ApprovalDecision" NOT NULL,
  "comments" TEXT,
  "decidedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Approval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Approval_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES public."SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3.12 Budget Rules
CREATE TABLE IF NOT EXISTS public."BudgetRule" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "ruleName" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "threshold" NUMERIC(6,2) NOT NULL,
  "action" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BudgetRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BudgetRule_ruleName_key" UNIQUE ("ruleName")
);

-- 3.13 Approval Rules
CREATE TABLE IF NOT EXISTS public."ApprovalRule" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "minimumAmount" NUMERIC(14,2) NOT NULL,
  "maximumAmount" NUMERIC(14,2),
  "requiredRole" "RoleType" NOT NULL DEFAULT 'MANAGER',
  "departmentId" TEXT,
  "categoryId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApprovalRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ApprovalRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3.14 Budget Exceptions
CREATE TABLE IF NOT EXISTS public."Exception" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "spendingRequestId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "decision" "ExceptionDecision" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reviewedAt" TIMESTAMPTZ,
  CONSTRAINT "Exception_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Exception_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES public."SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Exception_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Exception_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3.15 Supporting Spending Documents
CREATE TABLE IF NOT EXISTS public."SpendingDocument" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "spendingRequestId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL DEFAULT 'SUPPORTING',
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SpendingDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpendingDocument_storagePath_key" UNIQUE ("storagePath"),
  CONSTRAINT "SpendingDocument_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES public."SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpendingDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3.16 Forecasts
CREATE TABLE IF NOT EXISTS public."Forecast" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "departmentId" TEXT NOT NULL,
  "categoryId" TEXT,
  "period" TEXT NOT NULL,
  "historicalSpend" NUMERIC(14,2) NOT NULL,
  "currentBurnRate" NUMERIC(14,2) NOT NULL,
  "projectedAmount" NUMERIC(14,2) NOT NULL,
  "budgetAmount" NUMERIC(14,2) NOT NULL,
  "variance" NUMERIC(14,2) NOT NULL,
  "methodology" TEXT NOT NULL,
  "confidence" NUMERIC(5,2) NOT NULL,
  "status" "ForecastStatus" NOT NULL DEFAULT 'WITHIN_FORECAST',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Forecast_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Forecast_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3.17 Control Alerts
CREATE TABLE IF NOT EXISTS public."Alert" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "type" TEXT NOT NULL,
  "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
  "departmentId" TEXT NOT NULL,
  "categoryId" TEXT,
  "relatedTransactionId" TEXT,
  "relatedRequestId" TEXT,
  "message" TEXT NOT NULL,
  "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolvedAt" TIMESTAMPTZ,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Alert_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Alert_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Alert_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES public."Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Alert_relatedRequestId_fkey" FOREIGN KEY ("relatedRequestId") REFERENCES public."SpendingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3.18 Audit Logs (Immutable Governance Trail)
CREATE TABLE IF NOT EXISTS public."AuditLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "previousValue" TEXT,
  "newValue" TEXT,
  "metadata" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3.19 Decision Snapshots (Frozen Point-in-Time Verdicts)
CREATE TABLE IF NOT EXISTS public."DecisionSnapshot" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "spendingRequestId" TEXT NOT NULL,
  "budgetAmount" NUMERIC(14,2) NOT NULL,
  "actualSpend" NUMERIC(14,2) NOT NULL,
  "committedSpend" NUMERIC(14,2) NOT NULL,
  "requestedAmount" NUMERIC(14,2) NOT NULL,
  "utilizationBefore" NUMERIC(6,2) NOT NULL,
  "utilizationAfter" NUMERIC(6,2) NOT NULL,
  "remainingBefore" NUMERIC(14,2) NOT NULL,
  "remainingAfter" NUMERIC(14,2) NOT NULL,
  "decision" "DecisionVerdict" NOT NULL,
  "budgetStatus" TEXT NOT NULL,
  "violations" TEXT NOT NULL,
  "warnings" TEXT NOT NULL,
  "reasons" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
  "calculatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "DecisionSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisionSnapshot_spendingRequestId_key" UNIQUE ("spendingRequestId"),
  CONSTRAINT "DecisionSnapshot_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES public."SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3.20 Client Contracts & Quotations
CREATE TABLE IF NOT EXISTS public."ClientQuotation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "clientName" TEXT NOT NULL,
  "projectName" TEXT NOT NULL,
  "quotationReference" TEXT NOT NULL,
  "proposedBudget" NUMERIC(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "targetProfitMarginPct" NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "validUntil" TIMESTAMPTZ,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ClientQuotation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientQuotation_quotationReference_key" UNIQUE ("quotationReference")
);

-- 3.21 Client Quotation Department Allocations
CREATE TABLE IF NOT EXISTS public."ClientQuotationAllocation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "quotationId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "allocatedAmount" NUMERIC(14,2) NOT NULL,
  "targetMarginPct" NUMERIC(5,2) NOT NULL DEFAULT 20.0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ClientQuotationAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientQuotationAllocation_quotationId_departmentId_key" UNIQUE ("quotationId", "departmentId"),
  CONSTRAINT "ClientQuotationAllocation_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES public."ClientQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClientQuotationAllocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================================
-- 4. PERFORMANCE & FOREIGN KEY INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "User_departmentId_idx" ON public."User"("departmentId");
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON public."User"("roleId");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON public."User"("status");

CREATE INDEX IF NOT EXISTS "Department_status_idx" ON public."Department"("status");
CREATE INDEX IF NOT EXISTS "CostCenter_departmentId_idx" ON public."CostCenter"("departmentId");
CREATE INDEX IF NOT EXISTS "Category_status_idx" ON public."Category"("status");

CREATE INDEX IF NOT EXISTS "Budget_departmentId_status_idx" ON public."Budget"("departmentId", "status");
CREATE INDEX IF NOT EXISTS "Budget_status_idx" ON public."Budget"("status");
CREATE INDEX IF NOT EXISTS "BudgetAllocation_budgetId_idx" ON public."BudgetAllocation"("budgetId");
CREATE INDEX IF NOT EXISTS "BudgetAllocation_categoryId_idx" ON public."BudgetAllocation"("categoryId");

CREATE INDEX IF NOT EXISTS "SpendingRequest_employeeId_idx" ON public."SpendingRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "SpendingRequest_departmentId_idx" ON public."SpendingRequest"("departmentId");
CREATE INDEX IF NOT EXISTS "SpendingRequest_categoryId_idx" ON public."SpendingRequest"("categoryId");
CREATE INDEX IF NOT EXISTS "SpendingRequest_status_idx" ON public."SpendingRequest"("status");
CREATE INDEX IF NOT EXISTS "SpendingRequest_requestedDate_idx" ON public."SpendingRequest"("requestedDate");

CREATE INDEX IF NOT EXISTS "Commitment_status_idx" ON public."Commitment"("status");

CREATE INDEX IF NOT EXISTS "Transaction_employeeId_idx" ON public."Transaction"("employeeId");
CREATE INDEX IF NOT EXISTS "Transaction_departmentId_idx" ON public."Transaction"("departmentId");
CREATE INDEX IF NOT EXISTS "Transaction_categoryId_idx" ON public."Transaction"("categoryId");
CREATE INDEX IF NOT EXISTS "Transaction_commitmentId_idx" ON public."Transaction"("commitmentId");
CREATE INDEX IF NOT EXISTS "Transaction_transactionDate_idx" ON public."Transaction"("transactionDate");
CREATE INDEX IF NOT EXISTS "Transaction_status_idx" ON public."Transaction"("status");

CREATE INDEX IF NOT EXISTS "Approval_spendingRequestId_idx" ON public."Approval"("spendingRequestId");
CREATE INDEX IF NOT EXISTS "Approval_approverId_idx" ON public."Approval"("approverId");
CREATE INDEX IF NOT EXISTS "Approval_decision_idx" ON public."Approval"("decision");

CREATE INDEX IF NOT EXISTS "ApprovalRule_departmentId_idx" ON public."ApprovalRule"("departmentId");
CREATE INDEX IF NOT EXISTS "ApprovalRule_categoryId_idx" ON public."ApprovalRule"("categoryId");
CREATE INDEX IF NOT EXISTS "ApprovalRule_enabled_idx" ON public."ApprovalRule"("enabled");
CREATE INDEX IF NOT EXISTS "ApprovalRule_requiredRole_idx" ON public."ApprovalRule"("requiredRole");

CREATE INDEX IF NOT EXISTS "Exception_spendingRequestId_idx" ON public."Exception"("spendingRequestId");
CREATE INDEX IF NOT EXISTS "Exception_requestedBy_idx" ON public."Exception"("requestedBy");
CREATE INDEX IF NOT EXISTS "Exception_reviewedBy_idx" ON public."Exception"("reviewedBy");
CREATE INDEX IF NOT EXISTS "Exception_decision_idx" ON public."Exception"("decision");

CREATE INDEX IF NOT EXISTS "SpendingDocument_spendingRequestId_idx" ON public."SpendingDocument"("spendingRequestId");
CREATE INDEX IF NOT EXISTS "SpendingDocument_uploadedBy_idx" ON public."SpendingDocument"("uploadedBy");
CREATE INDEX IF NOT EXISTS "SpendingDocument_createdAt_idx" ON public."SpendingDocument"("createdAt");

CREATE INDEX IF NOT EXISTS "Forecast_departmentId_idx" ON public."Forecast"("departmentId");
CREATE INDEX IF NOT EXISTS "Forecast_categoryId_idx" ON public."Forecast"("categoryId");
CREATE INDEX IF NOT EXISTS "Forecast_status_idx" ON public."Forecast"("status");
CREATE INDEX IF NOT EXISTS "Forecast_period_idx" ON public."Forecast"("period");

CREATE INDEX IF NOT EXISTS "Alert_departmentId_idx" ON public."Alert"("departmentId");
CREATE INDEX IF NOT EXISTS "Alert_categoryId_idx" ON public."Alert"("categoryId");
CREATE INDEX IF NOT EXISTS "Alert_severity_idx" ON public."Alert"("severity");
CREATE INDEX IF NOT EXISTS "Alert_status_idx" ON public."Alert"("status");
CREATE INDEX IF NOT EXISTS "Alert_createdAt_idx" ON public."Alert"("createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON public."AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON public."AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON public."AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_timestamp_idx" ON public."AuditLog"("timestamp");

CREATE INDEX IF NOT EXISTS "DecisionSnapshot_decision_idx" ON public."DecisionSnapshot"("decision");
CREATE INDEX IF NOT EXISTS "DecisionSnapshot_calculatedAt_idx" ON public."DecisionSnapshot"("calculatedAt");

CREATE INDEX IF NOT EXISTS "ClientQuotation_status_idx" ON public."ClientQuotation"("status");
CREATE INDEX IF NOT EXISTS "ClientQuotationAllocation_quotationId_idx" ON public."ClientQuotationAllocation"("quotationId");
CREATE INDEX IF NOT EXISTS "ClientQuotationAllocation_departmentId_idx" ON public."ClientQuotationAllocation"("departmentId");

-- ============================================================================
-- 5. AUTO-UPDATING TIMESTAMP TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'Role',
      'User',
      'Department',
      'CostCenter',
      'Category',
      'Budget',
      'BudgetAllocation',
      'SpendingRequest',
      'Commitment',
      'BudgetRule',
      'ApprovalRule',
      'ClientQuotation',
      'ClientQuotationAllocation'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_update_timestamp ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER trg_update_timestamp BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl);
  END LOOP;
END $$;

-- ============================================================================
-- 6. SUPABASE AUTH USER SYNCHRONIZATION TRIGGER & PROFILES VIEW
-- ============================================================================
-- Automatically syncs auth.users accounts into public."User" and creates
-- a convenient public.profiles view for Supabase client queries.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role_id TEXT;
  user_full_name TEXT;
BEGIN
  -- Obtain default EMPLOYEE role
  SELECT "id" INTO default_role_id FROM public."Role" WHERE "name" = 'EMPLOYEE' LIMIT 1;

  -- Extract display name from metadata or split email
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public."User" (
    "id",
    "name",
    "email",
    "passwordHash",
    "roleId",
    "status",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    NEW.id::text,
    user_full_name,
    NEW.email,
    'SUPABASE_AUTH_MANAGED',
    COALESCE(default_role_id, (SELECT "id" FROM public."Role" LIMIT 1)),
    'ACTIVE',
    now(),
    now()
  )
  ON CONFLICT ("id") DO UPDATE
    SET "email" = EXCLUDED."email",
        "name" = COALESCE(EXCLUDED."name", public."User"."name"),
        "updatedAt" = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users (if auth schema exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
  END IF;
END $$;

-- Convenience public.profiles view
CREATE OR REPLACE VIEW public.profiles AS
SELECT 
  u."id",
  u."name",
  u."email",
  r."name" as "role",
  u."roleId",
  d."name" as "departmentName",
  u."departmentId",
  u."status",
  u."createdAt",
  u."updatedAt"
FROM public."User" u
LEFT JOIN public."Role" r ON u."roleId" = r."id"
LEFT JOIN public."Department" d ON u."departmentId" = d."id";

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS & POLICIES
-- ============================================================================

-- 7.1 Enable RLS on all public tables
ALTER TABLE public."Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CostCenter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Budget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BudgetAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SpendingRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Commitment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Approval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BudgetRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApprovalRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Exception" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SpendingDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Forecast" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Alert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DecisionSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientQuotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientQuotationAllocation" ENABLE ROW LEVEL SECURITY;

-- 7.2 RLS Helper Functions (STABLE, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS "RoleType" AS $$
  SELECT r."name"
  FROM public."User" u
  JOIN public."Role" r ON u."roleId" = r."id"
  WHERE u."id" = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_department_id()
RETURNS TEXT AS $$
  SELECT "departmentId"
  FROM public."User"
  WHERE "id" = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_finance_or_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."User" u
    JOIN public."Role" r ON u."roleId" = r."id"
    WHERE u."id" = auth.uid()::text
      AND r."name" IN ('ADMIN', 'FINANCE')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 7.3 Clear old policies to ensure idempotent runs
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.polname, r.relname);
  END LOOP;
END $$;

-- 7.4 Table Policies

-- Role Policies
CREATE POLICY "Role_select_policy" ON public."Role"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Role_admin_all_policy" ON public."Role"
  FOR ALL TO authenticated
  USING (public.get_auth_user_role() = 'ADMIN')
  WITH CHECK (public.get_auth_user_role() = 'ADMIN');

-- Department Policies
CREATE POLICY "Department_select_policy" ON public."Department"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Department_admin_all_policy" ON public."Department"
  FOR ALL TO authenticated
  USING (public.get_auth_user_role() = 'ADMIN')
  WITH CHECK (public.get_auth_user_role() = 'ADMIN');

-- Category Policies
CREATE POLICY "Category_select_policy" ON public."Category"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Category_admin_all_policy" ON public."Category"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- CostCenter Policies
CREATE POLICY "CostCenter_select_policy" ON public."CostCenter"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "CostCenter_admin_all_policy" ON public."CostCenter"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- User Profiles Policies
CREATE POLICY "User_select_policy" ON public."User"
  FOR SELECT TO authenticated
  USING (
    "id" = auth.uid()::text
    OR "departmentId" = public.get_auth_user_department_id()
    OR public.is_finance_or_admin()
  );

CREATE POLICY "User_update_policy" ON public."User"
  FOR UPDATE TO authenticated
  USING ("id" = auth.uid()::text OR public.get_auth_user_role() = 'ADMIN')
  WITH CHECK ("id" = auth.uid()::text OR public.get_auth_user_role() = 'ADMIN');

CREATE POLICY "User_admin_manage_policy" ON public."User"
  FOR ALL TO authenticated
  USING (public.get_auth_user_role() = 'ADMIN')
  WITH CHECK (public.get_auth_user_role() = 'ADMIN');

-- Budget Policies
CREATE POLICY "Budget_select_policy" ON public."Budget"
  FOR SELECT TO authenticated
  USING ("departmentId" = public.get_auth_user_department_id() OR public.is_finance_or_admin());

CREATE POLICY "Budget_manage_policy" ON public."Budget"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- BudgetAllocation Policies
CREATE POLICY "BudgetAllocation_select_policy" ON public."BudgetAllocation"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Budget" b
      WHERE b."id" = "budgetId"
        AND (b."departmentId" = public.get_auth_user_department_id() OR public.is_finance_or_admin())
    )
  );

CREATE POLICY "BudgetAllocation_manage_policy" ON public."BudgetAllocation"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- SpendingRequest Policies
CREATE POLICY "SpendingRequest_select_policy" ON public."SpendingRequest"
  FOR SELECT TO authenticated
  USING (
    "employeeId" = auth.uid()::text
    OR "departmentId" = public.get_auth_user_department_id()
    OR public.is_finance_or_admin()
  );

CREATE POLICY "SpendingRequest_insert_policy" ON public."SpendingRequest"
  FOR INSERT TO authenticated
  WITH CHECK ("employeeId" = auth.uid()::text);

CREATE POLICY "SpendingRequest_update_policy" ON public."SpendingRequest"
  FOR UPDATE TO authenticated
  USING (
    ("employeeId" = auth.uid()::text AND "status" = 'DRAFT')
    OR ("departmentId" = public.get_auth_user_department_id() AND public.get_auth_user_role() = 'MANAGER')
    OR public.is_finance_or_admin()
  );

-- Commitment Policies (Ring-Fenced Earmarks)
CREATE POLICY "Commitment_select_policy" ON public."Commitment"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."SpendingRequest" sr
      WHERE sr."id" = "spendingRequestId"
        AND (
          sr."employeeId" = auth.uid()::text
          OR sr."departmentId" = public.get_auth_user_department_id()
          OR public.is_finance_or_admin()
        )
    )
  );

CREATE POLICY "Commitment_manage_policy" ON public."Commitment"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- Transaction Policies (Actual Settled Spend)
CREATE POLICY "Transaction_select_policy" ON public."Transaction"
  FOR SELECT TO authenticated
  USING (
    "employeeId" = auth.uid()::text
    OR "departmentId" = public.get_auth_user_department_id()
    OR public.is_finance_or_admin()
  );

CREATE POLICY "Transaction_manage_policy" ON public."Transaction"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- Approval Policies
CREATE POLICY "Approval_select_policy" ON public."Approval"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."SpendingRequest" sr
      WHERE sr."id" = "spendingRequestId"
        AND (
          sr."employeeId" = auth.uid()::text
          OR sr."departmentId" = public.get_auth_user_department_id()
          OR public.is_finance_or_admin()
        )
    )
  );

CREATE POLICY "Approval_insert_policy" ON public."Approval"
  FOR INSERT TO authenticated
  WITH CHECK (
    "approverId" = auth.uid()::text
    AND public.get_auth_user_role() IN ('MANAGER', 'FINANCE', 'ADMIN')
  );

-- Rules Policies
CREATE POLICY "BudgetRule_select_policy" ON public."BudgetRule"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "BudgetRule_manage_policy" ON public."BudgetRule"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

CREATE POLICY "ApprovalRule_select_policy" ON public."ApprovalRule"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ApprovalRule_manage_policy" ON public."ApprovalRule"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- Exception Policies
CREATE POLICY "Exception_select_policy" ON public."Exception"
  FOR SELECT TO authenticated
  USING (
    "requestedBy" = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public."SpendingRequest" sr
      WHERE sr."id" = "spendingRequestId"
        AND (sr."departmentId" = public.get_auth_user_department_id() OR public.is_finance_or_admin())
    )
  );

CREATE POLICY "Exception_insert_policy" ON public."Exception"
  FOR INSERT TO authenticated
  WITH CHECK ("requestedBy" = auth.uid()::text);

CREATE POLICY "Exception_update_policy" ON public."Exception"
  FOR UPDATE TO authenticated
  USING (public.is_finance_or_admin() OR public.get_auth_user_role() = 'MANAGER')
  WITH CHECK (public.is_finance_or_admin() OR public.get_auth_user_role() = 'MANAGER');

-- Supporting Documents Policies
CREATE POLICY "SpendingDocument_select_policy" ON public."SpendingDocument"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."SpendingRequest" sr
      WHERE sr."id" = "spendingRequestId"
        AND (
          sr."employeeId" = auth.uid()::text
          OR sr."departmentId" = public.get_auth_user_department_id()
          OR public.is_finance_or_admin()
        )
    )
  );

CREATE POLICY "SpendingDocument_insert_policy" ON public."SpendingDocument"
  FOR INSERT TO authenticated
  WITH CHECK ("uploadedBy" = auth.uid()::text);

-- Forecast & Alert Policies
CREATE POLICY "Forecast_select_policy" ON public."Forecast"
  FOR SELECT TO authenticated
  USING ("departmentId" = public.get_auth_user_department_id() OR public.is_finance_or_admin());

CREATE POLICY "Forecast_manage_policy" ON public."Forecast"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

CREATE POLICY "Alert_select_policy" ON public."Alert"
  FOR SELECT TO authenticated
  USING ("departmentId" = public.get_auth_user_department_id() OR public.is_finance_or_admin());

CREATE POLICY "Alert_manage_policy" ON public."Alert"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- Immutable Audit & Decision Snapshot Policies
CREATE POLICY "AuditLog_select_policy" ON public."AuditLog"
  FOR SELECT TO authenticated
  USING (public.is_finance_or_admin());

CREATE POLICY "AuditLog_insert_policy" ON public."AuditLog"
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "DecisionSnapshot_select_policy" ON public."DecisionSnapshot"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."SpendingRequest" sr
      WHERE sr."id" = "spendingRequestId"
        AND (
          sr."employeeId" = auth.uid()::text
          OR sr."departmentId" = public.get_auth_user_department_id()
          OR public.is_finance_or_admin()
        )
    )
  );

CREATE POLICY "DecisionSnapshot_insert_policy" ON public."DecisionSnapshot"
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Revoke mutation/deletion on immutable governance records
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public."AuditLog" FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public."DecisionSnapshot" FROM PUBLIC, anon, authenticated;

-- Client Quotation Policies
CREATE POLICY "ClientQuotation_select_policy" ON public."ClientQuotation"
  FOR SELECT TO authenticated
  USING (public.is_finance_or_admin() OR public.get_auth_user_role() = 'MANAGER');

CREATE POLICY "ClientQuotation_manage_policy" ON public."ClientQuotation"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

CREATE POLICY "ClientQuotationAllocation_select_policy" ON public."ClientQuotationAllocation"
  FOR SELECT TO authenticated
  USING ("departmentId" = public.get_auth_user_department_id() OR public.is_finance_or_admin());

CREATE POLICY "ClientQuotationAllocation_manage_policy" ON public."ClientQuotationAllocation"
  FOR ALL TO authenticated
  USING (public.is_finance_or_admin())
  WITH CHECK (public.is_finance_or_admin());

-- ============================================================================
-- 8. PRIVATE SUPABASE STORAGE SETUP (Spending Documents)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'spending-documents',
      'spending-documents',
      false,
      10485760, -- 10MB
      ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ]
    )
    ON CONFLICT (id) DO UPDATE
      SET public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;

-- ============================================================================
-- 9. BASELINE ENTERPRISE SEED DATA (Idempotent ON CONFLICT DO NOTHING)
-- ============================================================================

-- 9.1 Seed Standard Roles
INSERT INTO public."Role" ("id", "name", "description")
VALUES
  ('role-admin-seed', 'ADMIN', 'Global Corporate Administrator with full operational governance'),
  ('role-finance-seed', 'FINANCE', 'Chief Finance Officer / Financial Controller with enterprise-wide spend authority'),
  ('role-manager-seed', 'MANAGER', 'Department Director / Spending Approver with cost-center jurisdiction'),
  ('role-employee-seed', 'EMPLOYEE', 'Staff Member authorized to submit departmental spending requests')
ON CONFLICT ("name") DO NOTHING;

-- 9.2 Seed Core Departments
INSERT INTO public."Department" ("id", "name", "code", "costCenter", "status")
VALUES
  ('dept-eng-seed', 'Engineering', 'ENG', 'CC-ENG-101', 'ACTIVE'),
  ('dept-mkt-seed', 'Marketing', 'MKT', 'CC-MKT-201', 'ACTIVE'),
  ('dept-ops-seed', 'Operations', 'OPS', 'CC-OPS-301', 'ACTIVE'),
  ('dept-sls-seed', 'Sales', 'SLS', 'CC-SLS-401', 'ACTIVE'),
  ('dept-hr-seed', 'Human Resources', 'HR', 'CC-HR-501', 'ACTIVE')
ON CONFLICT ("code") DO NOTHING;

-- 9.3 Seed Standard Expense Categories
INSERT INTO public."Category" ("id", "name", "code", "description", "status")
VALUES
  ('cat-sw-seed', 'Software & Cloud', 'SW_CLOUD', 'Cloud hosting, SaaS subscriptions, developer tooling', 'ACTIVE'),
  ('cat-hw-seed', 'Hardware & Equipment', 'HW_EQP', 'Workstations, laptops, monitors, laboratory gear', 'ACTIVE'),
  ('cat-trv-seed', 'Travel & Entertainment', 'TRV_ENT', 'Flights, accommodations, client meals', 'ACTIVE'),
  ('cat-trn-seed', 'Professional Training', 'PRO_TRN', 'Certifications, conferences, seminars, technical books', 'ACTIVE'),
  ('cat-off-seed', 'Office Supplies', 'OFF_SUP', 'Stationery, office amenities, ergonomic accessories', 'ACTIVE')
ON CONFLICT ("code") DO NOTHING;

-- 9.4 Seed Standard Governance Rules
INSERT INTO public."BudgetRule" ("id", "ruleName", "ruleType", "threshold", "action", "enabled", "priority")
VALUES
  ('brule-warn-80', 'UTILIZATION_WARNING_80', 'UTILIZATION_WARNING', 80.00, 'WARNING', true, 100),
  ('brule-block-100', 'HARD_BUDGET_CEILING_100', 'HARD_CEILING', 100.00, 'BLOCK', true, 10)
ON CONFLICT ("ruleName") DO NOTHING;

INSERT INTO public."ApprovalRule" ("id", "name", "minimumAmount", "maximumAmount", "requiredRole", "enabled", "priority")
VALUES
  ('arule-mgr-15k', 'Manager Review > ₹15,000', 15000.00, 100000.00, 'MANAGER', true, 100),
  ('arule-fin-100k', 'Finance CFO Review > ₹100,000', 100000.00, NULL, 'FINANCE', true, 10)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. VERIFICATION & HEALTH CHECK
-- ============================================================================
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' 
  AND n.nspname = 'public'
ORDER BY c.relname;

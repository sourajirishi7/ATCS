-- ============================================================================
-- ATCS — initial schema for Supabase PostgreSQL
--
-- Generated offline from prisma/schema.prisma via:
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- All monetary columns are PostgreSQL NUMERIC/DECIMAL. No floating point is
-- used for authoritative financial values.
--
-- Apply with:  npx prisma migrate deploy   (uses DIRECT_URL)
-- ============================================================================
-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('EMPLOYEE', 'MANAGER', 'FINANCE', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SpendingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('ACTIVE', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('RECORDED', 'RECONCILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'API');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DecisionVerdict" AS ENUM ('APPROVE', 'APPROVAL_REQUIRED', 'WARNING', 'VIOLATION', 'INSUFFICIENT_DATA', 'CONFIGURATION_ERROR');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ForecastStatus" AS ENUM ('WITHIN_FORECAST', 'NEAR_FORECAST_LIMIT', 'PROJECTED_VIOLATION', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "ExceptionDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "departmentId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "costCenter" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "fiscalPeriod" TEXT NOT NULL,
    "budgetAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "BudgetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SpendingStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpendingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "spendingRequestId" TEXT NOT NULL,
    "committedAmount" DECIMAL(14,2) NOT NULL,
    "remainingAmount" DECIMAL(14,2) NOT NULL,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendor" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "status" "TransactionStatus" NOT NULL DEFAULT 'RECORDED',
    "commitmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "spendingRequestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRule" (
    "id" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "threshold" DECIMAL(6,2) NOT NULL,
    "action" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minimumAmount" DECIMAL(14,2) NOT NULL,
    "maximumAmount" DECIMAL(14,2),
    "requiredRole" "RoleType" NOT NULL DEFAULT 'MANAGER',
    "departmentId" TEXT,
    "categoryId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL,
    "spendingRequestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "decision" "ExceptionDecision" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingDocument" (
    "id" TEXT NOT NULL,
    "spendingRequestId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'SUPPORTING',
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "categoryId" TEXT,
    "period" TEXT NOT NULL,
    "historicalSpend" DECIMAL(14,2) NOT NULL,
    "currentBurnRate" DECIMAL(14,2) NOT NULL,
    "projectedAmount" DECIMAL(14,2) NOT NULL,
    "budgetAmount" DECIMAL(14,2) NOT NULL,
    "variance" DECIMAL(14,2) NOT NULL,
    "methodology" TEXT NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "status" "ForecastStatus" NOT NULL DEFAULT 'WITHIN_FORECAST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "departmentId" TEXT NOT NULL,
    "categoryId" TEXT,
    "relatedTransactionId" TEXT,
    "relatedRequestId" TEXT,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "metadata" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionSnapshot" (
    "id" TEXT NOT NULL,
    "spendingRequestId" TEXT NOT NULL,
    "budgetAmount" DECIMAL(14,2) NOT NULL,
    "actualSpend" DECIMAL(14,2) NOT NULL,
    "committedSpend" DECIMAL(14,2) NOT NULL,
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "utilizationBefore" DECIMAL(6,2) NOT NULL,
    "utilizationAfter" DECIMAL(6,2) NOT NULL,
    "remainingBefore" DECIMAL(14,2) NOT NULL,
    "remainingAfter" DECIMAL(14,2) NOT NULL,
    "decision" "DecisionVerdict" NOT NULL,
    "budgetStatus" TEXT NOT NULL,
    "violations" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientQuotation" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "quotationReference" TEXT NOT NULL,
    "proposedBudget" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "targetProfitMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 20.0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientQuotationAllocation" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "targetMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 20.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientQuotationAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE INDEX "Budget_departmentId_status_idx" ON "Budget"("departmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_departmentId_fiscalPeriod_key" ON "Budget"("departmentId", "fiscalPeriod");

-- CreateIndex
CREATE INDEX "BudgetAllocation_budgetId_idx" ON "BudgetAllocation"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetAllocation_categoryId_idx" ON "BudgetAllocation"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAllocation_budgetId_categoryId_key" ON "BudgetAllocation"("budgetId", "categoryId");

-- CreateIndex
CREATE INDEX "SpendingRequest_employeeId_idx" ON "SpendingRequest"("employeeId");

-- CreateIndex
CREATE INDEX "SpendingRequest_departmentId_idx" ON "SpendingRequest"("departmentId");

-- CreateIndex
CREATE INDEX "SpendingRequest_categoryId_idx" ON "SpendingRequest"("categoryId");

-- CreateIndex
CREATE INDEX "SpendingRequest_status_idx" ON "SpendingRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Commitment_spendingRequestId_key" ON "Commitment"("spendingRequestId");

-- CreateIndex
CREATE INDEX "Commitment_status_idx" ON "Commitment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_referenceNumber_key" ON "Transaction"("referenceNumber");

-- CreateIndex
CREATE INDEX "Transaction_departmentId_idx" ON "Transaction"("departmentId");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Approval_spendingRequestId_idx" ON "Approval"("spendingRequestId");

-- CreateIndex
CREATE INDEX "Approval_approverId_idx" ON "Approval"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetRule_ruleName_key" ON "BudgetRule"("ruleName");

-- CreateIndex
CREATE INDEX "ApprovalRule_departmentId_idx" ON "ApprovalRule"("departmentId");

-- CreateIndex
CREATE INDEX "ApprovalRule_categoryId_idx" ON "ApprovalRule"("categoryId");

-- CreateIndex
CREATE INDEX "ApprovalRule_enabled_idx" ON "ApprovalRule"("enabled");

-- CreateIndex
CREATE INDEX "Exception_spendingRequestId_idx" ON "Exception"("spendingRequestId");

-- CreateIndex
CREATE INDEX "Exception_decision_idx" ON "Exception"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "SpendingDocument_storagePath_key" ON "SpendingDocument"("storagePath");

-- CreateIndex
CREATE INDEX "SpendingDocument_spendingRequestId_idx" ON "SpendingDocument"("spendingRequestId");

-- CreateIndex
CREATE INDEX "SpendingDocument_uploadedBy_idx" ON "SpendingDocument"("uploadedBy");

-- CreateIndex
CREATE INDEX "SpendingDocument_createdAt_idx" ON "SpendingDocument"("createdAt");

-- CreateIndex
CREATE INDEX "Forecast_departmentId_idx" ON "Forecast"("departmentId");

-- CreateIndex
CREATE INDEX "Forecast_status_idx" ON "Forecast"("status");

-- CreateIndex
CREATE INDEX "Alert_departmentId_idx" ON "Alert"("departmentId");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionSnapshot_spendingRequestId_key" ON "DecisionSnapshot"("spendingRequestId");

-- CreateIndex
CREATE INDEX "DecisionSnapshot_decision_idx" ON "DecisionSnapshot"("decision");

-- CreateIndex
CREATE INDEX "DecisionSnapshot_calculatedAt_idx" ON "DecisionSnapshot"("calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientQuotation_quotationReference_key" ON "ClientQuotation"("quotationReference");

-- CreateIndex
CREATE INDEX "ClientQuotationAllocation_quotationId_idx" ON "ClientQuotationAllocation"("quotationId");

-- CreateIndex
CREATE INDEX "ClientQuotationAllocation_departmentId_idx" ON "ClientQuotationAllocation"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientQuotationAllocation_quotationId_departmentId_key" ON "ClientQuotationAllocation"("quotationId", "departmentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingRequest" ADD CONSTRAINT "SpendingRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingRequest" ADD CONSTRAINT "SpendingRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingRequest" ADD CONSTRAINT "SpendingRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES "SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES "SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES "SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingDocument" ADD CONSTRAINT "SpendingDocument_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES "SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingDocument" ADD CONSTRAINT "SpendingDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_relatedTransactionId_fkey" FOREIGN KEY ("relatedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_relatedRequestId_fkey" FOREIGN KEY ("relatedRequestId") REFERENCES "SpendingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionSnapshot" ADD CONSTRAINT "DecisionSnapshot_spendingRequestId_fkey" FOREIGN KEY ("spendingRequestId") REFERENCES "SpendingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuotationAllocation" ADD CONSTRAINT "ClientQuotationAllocation_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "ClientQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuotationAllocation" ADD CONSTRAINT "ClientQuotationAllocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- ATCS — Row Level Security hardening
--
-- The browser never queries these tables directly. The ATCS backend (Prisma,
-- connecting as table owner) is the only authorized data path and applies its
-- own RBAC. Enabling RLS without any permissive policy for non /
-- uthenticated guarantees the public frontend anon key can read nothing.
-- See prisma/rls_hardening.sql for the re-runnable standalone version.
-- ============================================================================
-- ============================================================================
-- ATCS â€” Supabase Row Level Security hardening (re-runnable, idempotent)
--
-- Architecture being enforced:
--     React  ->  ATCS Backend (Express + JWT + RBAC)  ->  Prisma  ->  Supabase PostgreSQL
--
-- The browser never talks to Postgres/PostgREST for financial data. The ATCS
-- backend is the single authorized data path and performs its own RBAC
-- (EMPLOYEE / MANAGER / FINANCE / ADMIN) before every query.
--
-- Therefore this script is deliberately DENY-ALL for the browser-facing Supabase
-- roles (`anon`, `authenticated`): RLS is enabled and NO permissive policy is
-- created. That means the public anon key in the frontend bundle can never read
-- a department, a budget, a transaction or an audit row, even though the anon
-- key is a "public" credential.
--
-- RLS is enabled (not FORCEd) because the ATCS backend connects through Prisma
-- as the table owner. PostgreSQL table owners bypass RLS by default; using
-- FORCE would break the backend's own connection.
--
-- Run manually in the Supabase SQL Editor, or let `prisma migrate deploy` apply
-- the same statements from the ATCS init migration.
-- ============================================================================

-- 1. Enable RLS on every table in the public schema.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

-- 2. Drop any policy that would re-open access to the browser roles.
--    (Kept explicit so re-running this script can never widen exposure.)
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
      AND p.polroles <> ARRAY[0]::oid[]
      AND p.polqual IS NULL          -- permissive (USING / WITH CHECK = true)
      AND p.polwithcheck IS NULL
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.polname, r.relname);
  END LOOP;
END $$;

-- 3. Defence in depth: strip table/sequence privileges from browser roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
  END IF;
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC';
END $$;

-- 4. Audit records and decision snapshots are append-only for every role that
--    is not the table owner (i.e. the ATCS backend).
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditLog" FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "DecisionSnapshot" FROM PUBLIC;



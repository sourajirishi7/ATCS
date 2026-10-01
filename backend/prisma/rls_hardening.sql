-- ============================================================================
-- ATCS — Supabase Row Level Security hardening (re-runnable, idempotent)
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

-- 5. Confirmation query: every public table must report rowsecurity = true.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public'
ORDER BY c.relname;

-- ============================================================================
-- ATCS — Supabase Storage setup (run once in the Supabase SQL Editor)
--
-- The ATCS backend stores supporting documents (invoices, receipts, contracts)
-- for spending requests. Design rules:
--
--   1. The bucket is PRIVATE. No public object URLs are ever produced.
--   2. Downloads are short-lived SIGNED URLs minted by the ATCS backend
--      only after the existing ATCS RBAC check (EMPLOYEE / MANAGER / FINANCE /
--      ADMIN + department scoping) has passed.
--   3. The browser-facing `anon` and `authenticated` Supabase roles get NO
--      privileges on `storage.objects` for this bucket, so the public anon key
--      in the frontend bundle can neither read nor write a financial document.
--   4. The backend reaches the bucket with the service-role key, which bypasses
--      RLS. This is why no permissive storage policy is required.
-- ============================================================================

-- 1. Create the private bucket (idempotent).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'spending-documents',
  'spending-documents',
  false,
  10485760,
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

-- 2. Remove any policy that would expose this bucket to browser roles.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.polname
    FROM pg_policy p
    WHERE p.polrelid = 'storage.objects'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname);
  END LOOP;
END $$;

-- 3. Defence in depth: no browser-role privileges on the bucket.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON storage.objects FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON storage.objects FROM authenticated';
  END IF;
END $$;

-- 4. Confirmation query: the bucket must report public = false.
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'spending-documents';

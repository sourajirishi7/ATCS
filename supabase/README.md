# ATCS — Supabase Setup Runbook

Supabase is the **persistent data layer** for ATCS. It is not a business-logic
engine. The authority chain stays exactly as it was:

```
React (frontend)
      ↓  JWT + RBAC enforced by ATCS
ATCS Backend (Express)
      ↓  Prisma
Supabase PostgreSQL          ← authoritative financial store
      ↓
ATCS Financial Services
```

SpendDecisionEngine, BudgetService, TransactionService, CommitmentService,
ApprovalService, AuditService, ForecastService and AlertService all continue to
run **inside the ATCS backend**. Nothing financial moved to the browser or to
Supabase client code.

---

## 1. Values you must supply (never invent these)

| Variable | Where to get it | Goes in |
| --- | --- | --- |
| `SUPABASE_URL` | Dashboard → Project Settings → API → *Project URL* | `backend/.env`, `frontend/.env.local` |
| `SUPABASE_ANON_KEY` | Dashboard → Project Settings → API → *anon public* key | `backend/.env`, `frontend/.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Project Settings → API → *service_role* key | `backend/.env` **only** |
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → Database → *DB password* | inside `DATABASE_URL` / `DIRECT_URL` |
| `<project-ref>` | the subdomain in your project URL (`https://<project-ref>.supabase.co`) | both connection strings |
| `<region>` | Dashboard → Project Settings → Database → *Host*, e.g. `aws-0-ap-south-1` | `DATABASE_URL` |

Templates already exist: `backend/.env.example` and `frontend/.env.example`.

---

## 2. Connection strings

Runtime traffic goes through the Supabase **transaction pooler**; migrations use
the **direct** connection (poolers do not allow DDL / advisory locks).

```
DATABASE_URL="postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
DIRECT_URL="postgresql://postgres.<project-ref>:<db-password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require"
```

If the app machine is outside Supabase's network, add
`&sslmode=require` to `DATABASE_URL` as well.

---

## 3. Apply the schema

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate      # prisma migrate deploy — uses DIRECT_URL
```

`prisma migrate deploy` applies
`backend/prisma/migrations/20260101000000_atcs_init_supabase/migration.sql`,
which creates every ATCS table, all enums, all foreign keys, all indexes and
all unique constraints, and then applies the RLS hardening block. All monetary
columns are `DECIMAL(14,2)`; utilization/confidence columns are `DECIMAL(6,2)` /
`DECIMAL(5,2)`. No floating point is used for authoritative money.

Optional seed (idempotent upserts; safe to re-run):

```bash
npm run prisma:seed
```

---

## 4. Storage

Run `supabase/storage_setup.sql` in the Supabase SQL Editor once. It creates the
private `spending-documents` bucket and strips every browser-role policy. The
backend also creates the bucket on first upload if it is missing.

Downloads are only ever short-lived signed URLs minted by the backend after an
ATCS RBAC check.

---

## 5. Row Level Security

`prisma migrate deploy` already enables RLS on every table in `public` and
creates **no permissive policies** for `anon` / `authenticated`. Re-apply or
audit at any time with `supabase/rls_hardening.sql`.

Why deny-all is correct here: the browser never queries these tables. The
backend connects through Prisma as the table owner, which bypasses RLS, and
enforces its own JWT + RBAC on every request. So RLS is a **second lock**, not
the primary authorization layer.

Verify (expect `t = true` for every row):

```sql
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public' ORDER BY 1;
```

---

## 6. Authentication

Unchanged. ATCS still issues and validates its own JWT
(`backend/src/middleware/auth.ts`) and still owns RBAC. Supabase Auth was **not**
introduced: ATCS already had a working flow, and replacing it would be a rewrite
with no clear benefit. The anon key exists in the frontend only as a
project-identifier for the (currently unused) public client; it grants zero
table access because of the deny-all RLS above.

---

## 7. Realtime

Socket.IO stays the only realtime channel (`backend/src/socket.ts`). A second
Supabase Realtime subscription would duplicate work without adding capability.
Supabase Realtime is intentionally **not** enabled.

---

## 8. Verify the integration

```bash
cd backend
npm run verify:supabase
```

This runs the full checklist (connection, Prisma, user/department reads, budget
create/retrieve, spending request, SpendDecisionEngine, commitment, transaction,
reconciliation, approvals, audit logging, dashboard math, CSV import, storage
round-trip + access control, forecast, alerts, auth, RBAC, employee/manager/
finance/admin isolation), plus the two financial-integrity scenarios and a
concurrent-request locking test.

Confirm at runtime:

```bash
curl http://localhost:5000/api/health
```

A healthy deployment reports `persistence.database.reachable = true` and
`persistence.supabase.serviceRoleKeyConfigured = true`.

---

## 9. Failure behaviour

If Supabase is unreachable, `backend/src/lib/dbHealth.ts` fails safe:
operational routes return `503 DATABASE_UNAVAILABLE` and nothing is approved,
committed or estimated. `/api/health` and `/api/auth` stay up so the outage can
be diagnosed.

---

## 10. What must never happen

- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` or the DB password
  in any `VITE_*` variable, any React file, or anything Git-tracked.
- Enabling Supabase Realtime/PostgREST writes from the frontend for financial
  tables.
- Moving SpendDecisionEngine math into `frontend/` or into a Supabase Edge
  Function.

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { Request, Response, NextFunction } from 'express';

/**
 * ATCS fail-safe database availability guard.
 *
 * Supabase PostgreSQL is the authoritative financial store. If it becomes
 * unreachable, ATCS must surface a clear error and MUST NOT:
 *   - fabricate financial values,
 *   - approve transactions locally,
 *   - create commitments from stale state,
 *   - silently serve cached/stale financial data.
 *
 * The probe is cheap (`SELECT 1`) and cached for a short window so that a burst
 * of dashboard requests does not hammer a degraded database.
 */

const PROBE_TTL_MS = 5_000;

interface ProbeResult {
  healthy: boolean;
  checkedAt: number;
  error?: string;
  latencyMs?: number;
}

let lastProbe: ProbeResult | null = null;
let inFlight: Promise<ProbeResult> | null = null;

async function runProbe(): Promise<ProbeResult> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    return { healthy: true, checkedAt: Date.now(), latencyMs: Date.now() - startedAt };
  } catch (err: any) {
    return {
      healthy: false,
      checkedAt: Date.now(),
      error: err?.message || String(err),
    };
  }
}

export async function checkDatabaseHealth(force = false): Promise<ProbeResult> {
  if (!force && lastProbe && Date.now() - lastProbe.checkedAt < PROBE_TTL_MS) {
    return lastProbe;
  }
  if (inFlight) return inFlight;

  inFlight = runProbe().then((result) => {
    lastProbe = result;
    inFlight = null;
    return result;
  });

  return inFlight;
}

export function getCachedDatabaseHealth(): ProbeResult | null {
  return lastProbe;
}

export function databaseUnavailableError(detail?: string): AppError {
  return new AppError(
    'The ATCS financial database (Supabase PostgreSQL) is currently unavailable. This operation was not executed.',
    503,
    'DATABASE_UNAVAILABLE',
    'No financial values were estimated or cached. Retry once the database connection recovers.',
    detail ? { detail } : undefined
  );
}

/**
 * Express middleware that blocks financial operations when the database is down.
 * Read-only health endpoints intentionally do not use this guard.
 */
export function requireDatabase(req: Request, res: Response, next: NextFunction): void {
  checkDatabaseHealth()
    .then((result) => {
      if (!result.healthy) {
        const error = databaseUnavailableError(result.error);
        res.status(error.statusCode).json({
          success: false,
          errorCode: error.errorCode,
          message: error.message,
          action: error.action,
        });
        return;
      }
      next();
    })
    .catch(next);
}

/**
 * Convenience wrapper used by the startup bootstrap.
 */
export async function assertDatabaseReachable(): Promise<ProbeResult> {
  return checkDatabaseHealth(true);
}

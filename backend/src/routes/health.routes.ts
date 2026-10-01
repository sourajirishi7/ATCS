import { Router } from 'express';
import { checkDatabaseHealth } from '../lib/dbHealth';
import {
  BUCKET_NAME,
  isSupabaseServerConfigured,
  verifySupabaseConnection,
} from '../lib/supabase';

const router = Router();

/**
 * Liveness + dependency status.
 *
 * This is the operational check used to confirm that the ATCS backend is
 * genuinely talking to Supabase (PostgreSQL + Storage). It is intentionally
 * unauthenticated but exposes no secrets — only booleans and messages.
 */
router.get('/', async (_req, res) => {
  const database = await checkDatabaseHealth(true);
  const supabase = await verifySupabaseConnection();

  const healthy = database.healthy;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    system: 'ATCS — Audit Trailing & Control System',
    timestamp: new Date().toISOString(),
    persistence: {
      provider: 'supabase-postgresql',
      accessPath: 'ATCS Backend -> Prisma -> Supabase PostgreSQL',
      database: {
        reachable: database.healthy,
        latencyMs: database.latencyMs ?? null,
        error: database.healthy ? null : database.error,
      },
      supabase: {
        urlConfigured: supabase.urlConfigured,
        serviceRoleKeyConfigured: supabase.serviceKeyConfigured,
        storageBucket: BUCKET_NAME,
        storageAvailable: supabase.storageAvailable,
        message: supabase.message,
      },
      realtime: {
        transport: 'socket.io',
        note: 'Socket.IO remains the single realtime channel; Supabase Realtime is not used.',
      },
    },
  });
});

export default router;

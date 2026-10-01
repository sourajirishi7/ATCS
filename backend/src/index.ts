import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { initSocketIO } from './socket';
import { assertDatabaseReachable, checkDatabaseHealth } from './lib/dbHealth';
import { isSupabaseServerConfigured } from './lib/supabase';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check (service liveness — independent of database state)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'ATCS — Audit Trailing & Control System',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount Central API
app.use('/api', apiRouter);

// Centralized Error Handling
app.use(errorHandler);

// Initialize WebSockets
initSocketIO(server, CLIENT_URL);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 ATCS Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.IO Real-time Engine initialized`);
    console.log(`🔒 Financial Source of Truth: Supabase PostgreSQL (via Prisma)`);
    console.log(`🔐 Supabase Storage (service role): ${isSupabaseServerConfigured() ? 'configured' : 'NOT CONFIGURED'}`);
    console.log(`====================================================`);
  });

  // Fail-safe startup probe: ATCS must never serve financial data from an
  // unreachable database. The API stays up so /api/health can report the fault,
  // but every operational route answers 503 DATABASE_UNAVAILABLE.
  assertDatabaseReachable().then((result) => {
    if (result.healthy) {
      console.log(`✅ Supabase PostgreSQL reachable via Prisma (${result.latencyMs}ms).`);
    } else {
      console.error('❌ Supabase PostgreSQL is NOT reachable:', result.error);
      console.error('   Check DATABASE_URL / DIRECT_URL in backend/.env and run: npm run prisma:migrate');
      console.error('   All financial endpoints will fail safely with 503 DATABASE_UNAVAILABLE.');
    }
  });

  // Periodic liveness probe keeps the cached health state fresh.
  const probeTimer = setInterval(() => {
    checkDatabaseHealth(true).catch(() => undefined);
  }, 30_000);
  probeTimer.unref();
}

export { app, server };

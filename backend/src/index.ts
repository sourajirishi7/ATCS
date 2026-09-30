import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { initSocketIO } from './socket';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
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
    console.log(`🔒 Financial Source of Truth: PostgreSQL / Prisma`);
    console.log(`====================================================`);
  });
}

export { app, server };

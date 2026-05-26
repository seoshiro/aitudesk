import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import path from 'path';

import { prisma } from './lib/prisma';
import { initSocket } from './socket';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { ticketsRouter } from './routes/tickets';
import { messagesRouter } from './routes/messages';
import { knowledgeRouter } from './routes/knowledge';
import { notificationsRouter } from './routes/notifications';
import { dashboardRouter } from './routes/dashboard';
import { errorHandler } from './middleware/errorHandler';
import { httpMetrics } from './middleware/httpMetrics';
import { register } from './lib/metrics';
import './lib/dbMetrics'; // registers DB-derived gauges (Database Exporter pattern)
import { reportsRouter } from './routes/reports';
import { aiRouter } from './routes/ai';
import { checkSlaBreaches } from './services/sla.service';
import { isOriginAllowed } from './lib/env';

const app = express();
const httpServer = createServer(app);

// ── Middleware ──────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (isOriginAllowed(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(compression());
app.use(httpMetrics);
app.use(morgan('combined'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Static files ────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => { res.set('Cross-Origin-Resource-Policy', 'cross-origin'); }
}));

// ── Socket.IO ───────────────────────────────────────────────────────────────
initSocket(httpServer);

// Check SLA breaches every 60 seconds
setInterval(() => void checkSlaBreaches(), 60_000);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/tickets', messagesRouter);
app.use('/api/kb', knowledgeRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);

app.use('/api/reports', reportsRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', (_req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });

// ── Prometheus metrics (no auth) ──────────────────────────────────────────
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────
if (!process.env.VITEST) {
  const PORT = parseInt(process.env.PORT ?? '4000', 10);
  httpServer.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 AituDesk API running on port ${PORT}`);
    try {
      await prisma.$connect();
      console.log('📦 Database connected');
    } catch (e) {
      console.error('❌ Database connection failed:', e);
    }
  });
}

export { app, httpServer };

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import { connectDatabase, isDatabaseConnected } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import {
  SERVER_CONFIG,
  FEATURE_FLAGS,
  isProduction,
  validateConfig,
} from './config/app.config.js';
import { SchedulerService } from './services/scheduler.service.js';

import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { activitiesRouter } from './routes/activities.js';
import { materialsRouter } from './routes/materials.js';
import { personnelRouter } from './routes/personnel.js';
import { budgetRouter } from './routes/budget.js';
import { contingenciesRouter } from './routes/contingencies.js';
import { dashboardRouter } from './routes/dashboard.js';
import { clientRouter } from './routes/client.js';
import { notificationsRouter } from './routes/notifications.js';
import { assistantRouter } from './routes/assistant.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

validateConfig();

const app = express();

// Detrás del balanceador de Fly.io. Se confía en UN solo proxy, no en todos:
// confiar en la cadena entera deja que cualquiera falsee su IP y se saltee el
// rate limit.
app.set('trust proxy', 1);

// ─── CORS ────────────────────────────────────────────────────────────────────

const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Project-Id'];

function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  if (!isProduction && origin.startsWith('http://localhost:')) return true;
  if (isProduction && origin.endsWith('.fly.dev')) return true;
  return [SERVER_CONFIG.FRONTEND_URL, SERVER_CONFIG.APP_URL].filter(Boolean).includes(origin);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin ?? undefined)) return callback(null, true);
      if (!isProduction) return callback(null, true);
      console.warn(`⚠️  [CORS] Origen bloqueado: ${origin}`);
      callback(new Error('Origen no permitido'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ALLOWED_HEADERS,
    maxAge: 86400,
  }),
);

// ─── Middleware base ─────────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false,
  }),
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
  });
});

// ─── Rutas ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/personnel', personnelRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/contingencies', contingenciesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/client', clientRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/assistant', assistantRouter);

// ─── SPA en producción ───────────────────────────────────────────────────────

if (isProduction) {
  const candidates = [
    join(__dirname, 'public'),
    join(__dirname, '..', 'public'),
    join(process.cwd(), 'public'),
    join(process.cwd(), 'packages', 'api', 'public'),
  ];
  const publicPath = candidates.find((p) => existsSync(p));

  if (publicPath) {
    app.use(express.static(publicPath));
    console.log(`📦 Sirviendo el SPA desde ${publicPath}`);

    // Fallback del router del cliente. Va DESPUÉS de las rutas de API para no
    // devolver el index.html en lugar de un 404 de API.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      const index = join(publicPath, 'index.html');
      return existsSync(index) ? res.sendFile(index) : next();
    });
  } else {
    console.warn('⚠️  No se encontró el build del frontend. Sólo se sirve la API.');
  }
}

app.use(errorHandler);

// ─── Arranque ────────────────────────────────────────────────────────────────

async function start() {
  // El servidor levanta ANTES de conectar a la base: así el health check
  // responde y la plataforma no mata la máquina mientras Mongo tarda.
  app.listen(SERVER_CONFIG.PORT, SERVER_CONFIG.HOST, () => {
    console.log(`🚀 Luma API en http://${SERVER_CONFIG.HOST}:${SERVER_CONFIG.PORT}`);
  });

  const connected = await connectDatabase();
  if (!connected) {
    console.warn('⚠️  El servidor está arriba pero sin base de datos.');
    return;
  }

  if (FEATURE_FLAGS.ENABLE_SCHEDULERS) SchedulerService.start();
  else console.log('⏸️  Tareas programadas deshabilitadas');
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} recibido, cerrando…`);
    SchedulerService.stop();
    process.exit(0);
  });
}

void start();

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  CORS_CONFIG,
  SERVER_CONFIG,
  isDevelopment,
  isProduction,
  validateConfig,
} from './config/app.config.js';
import { connectDatabase, isDatabaseConnected } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Antes de crear la app: es preferible no arrancar a arrancar mal configurado.
validateConfig();

const app = express();
const PORT = SERVER_CONFIG.PORT;

// Detrás de un proxy (Traefik en Coolify) hace falta para que el rate limiting
// vea la IP real del cliente y no la del proxy. Confiamos SÓLO en el primero de
// la cadena: confiar en todos permitiría falsear la IP con un X-Forwarded-For.
app.set('trust proxy', 1);

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // requests sin Origin (curl, server-to-server)

  // En desarrollo, cualquier puerto de la máquina local. `127.0.0.1` entra
  // además de `localhost`: no son intercambiables para el navegador —son
  // orígenes distintos— y varias herramientas (Playwright, algunos proxies)
  // usan la IP. Sin esto el preflight sale 403 sin `Allow-Credentials` y el
  // browser reporta un error de CORS que parece un bug de la app.
  if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin)) {
    return true;
  }

  // Whitelist: ALLOWED_ORIGINS (env) + FRONTEND_URL, que siempre entra.
  // La barra final se normaliza porque el navegador nunca la manda en Origin.
  const allowedOrigins = [...CORS_CONFIG.ALLOWED_ORIGINS, SERVER_CONFIG.FRONTEND_URL]
    .filter(Boolean)
    .map((o) => o.replace(/\/$/, ''));

  return allowedOrigins.includes(origin.replace(/\/$/, ''));
}

/**
 * Headers que el navegador puede mandar. Una sola lista, a propósito.
 *
 * El handler de preflight de abajo corta con `return res.sendStatus(200)` antes
 * de que corra `cors()`, así que agregar un header sólo en `cors()` no tiene
 * ningún efecto: el navegador sigue bloqueando el request y el servidor ni se
 * entera. Con una constante compartida ese desfasaje no puede ocurrir.
 */
const ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'Idempotency-Key'];
const ALLOWED_HEADERS_HEADER = ALLOWED_HEADERS.join(', ');

app.options('*', (req, res) => {
  const origin = req.headers.origin;

  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', ALLOWED_HEADERS_HEADER);

  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.sendStatus(200);
  }

  if (isDevelopment) {
    console.warn(`⚠️  [CORS] Preflight rechazado desde: ${origin}`);
  }
  return res.status(403).json({ error: 'CORS: Origin not allowed' });
});

// www → apex (301), sólo en producción.
if (isProduction) {
  app.use((req, res, next) => {
    const host = req.headers.host ?? '';
    if (host.startsWith('www.')) {
      return res.redirect(301, `https://${host.replace(/^www\./, '')}${req.url}`);
    }
    next();
  });
}

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://www.google.com', 'https://www.gstatic.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https://www.google.com', 'https://www.gstatic.com'],
            frameSrc: ["'self'", 'https://www.google.com', 'https://www.gstatic.com'],
            connectSrc: ["'self'", 'https://www.google.com', 'https://www.gstatic.com'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false,
  }),
);

app.use(compression());

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      console.warn(`⚠️  [CORS] Origen bloqueado: ${origin}`);
      if (!isProduction) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ALLOWED_HEADERS,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 200,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRouter);

if (isProduction) {
  // Proxy /home/* → la landing, un servicio aparte en la red interna de Docker.
  // Express saca el prefijo /home antes de pasar al middleware, así que el
  // pathRewrite lo repone: '' → '/home', '/assets/x' → '/home/assets/x'.
  app.use(
    '/home',
    createProxyMiddleware({
      target: SERVER_CONFIG.LANDING_URL,
      changeOrigin: true,
      pathRewrite: { '^': '/home' },
    }),
  );

  app.get('/', (_req, res) => res.redirect(301, '/home'));

  // El `public/` puede quedar en distintos lugares según desde dónde se arranque.
  const possiblePublicPaths = [
    join(__dirname, 'public'),
    join(__dirname, '..', 'public'),
    join(process.cwd(), 'public'),
    join(process.cwd(), 'packages', 'api', 'public'),
  ];

  const publicPath = possiblePublicPaths.find((candidate) => {
    try {
      return existsSync(candidate);
    } catch {
      return false;
    }
  });

  if (publicPath) {
    app.use('/app', express.static(publicPath));
    console.log(`📦 Sirviendo estáticos desde: ${publicPath}`);

    app.get('/app/*', (_req, res, next) => {
      const indexPath = join(publicPath, 'index.html');
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });

    app.get('/login', (_req, res) => res.redirect(301, '/app/login'));

    /**
     * Rutas de React Router pedidas en la raíz.
     *
     * En producción el SPA se compila con `base: '/app/'` y el router usa ese
     * `basename`, así que una URL como `/reset-password` queda FUERA de su
     * alcance: servirle el index.html devuelve 200, carga el bundle y no
     * renderiza nada. Página en blanco, sin error en consola ni en el servidor.
     *
     * Por eso redirige al punto de montaje real, que sale de APP_URL —la misma
     * fuente que usa `appUrl()` para armar los enlaces de los mails—, así un
     * enlace viejo con el path equivocado sigue funcionando.
     *
     * `/home` queda afuera a propósito: lo atiende el proxy a la landing.
     */
    const rootSpaRoutes = [
      '/register',
      '/check-email',
      '/verify-email',
      '/activate',
      '/forgot-password',
      '/reset-password',
      '/confirm-email-change',
      '/admin',
    ];

    let spaMount = '';
    try {
      spaMount = new URL(SERVER_CONFIG.APP_URL).pathname.replace(/\/$/, '');
    } catch {
      spaMount = '';
    }

    for (const route of rootSpaRoutes) {
      app.get([route, `${route}/*`], (req, res, next) => {
        if (spaMount) {
          return res.redirect(302, `${spaMount}${req.originalUrl}`);
        }
        const indexPath = join(publicPath, 'index.html');
        if (existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          next();
        }
      });
    }
  } else {
    console.warn('⚠️  No se encontró el directorio public/. La SPA no se va a servir.');
  }
}

// Siempre al final: si va antes, los errores de los handlers de abajo no pasan por acá.
app.use(errorHandler);

async function startServer() {
  // Escuchar primero y conectar a Mongo después: si la base tarda o está caída,
  // el health check tiene que responder igual para que el proxy no mate el
  // contenedor antes de que Mongo levante.
  app.listen(PORT, SERVER_CONFIG.HOST, () => {
    console.log(`🚀 Servidor en http://${SERVER_CONFIG.HOST}:${PORT}`);
    console.log(`📊 Health check: http://${SERVER_CONFIG.HOST}:${PORT}/health`);
  });

  const connected = await connectDatabase();
  if (!connected) {
    console.warn('⚠️  El servidor arrancó sin conexión a MongoDB.');
  }
}

process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido, cerrando...');
  process.exit(0);
});

startServer();

/**
 * Configuración de la aplicación.
 *
 * Fuente única de verdad para variables de entorno, secretos y claves. Ningún
 * otro archivo lee `process.env` directamente: cuando una variable cambia de
 * nombre o gana un default, se cambia acá y en ningún otro lado.
 *
 * (Mismo patrón que `config/app.config.ts` de Pantera Negra, que probó ser el
 * lugar donde uno mira primero cuando algo no arranca.)
 */
import dotenv from 'dotenv';

dotenv.config();

// ─── Servidor ────────────────────────────────────────────────────────────────

export const SERVER_CONFIG = {
  PORT: parseInt(process.env.PORT || '8080', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  /** URL pública donde vive el SPA. Se usa para armar links de email. */
  APP_URL: process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
} as const;

export const isProduction = SERVER_CONFIG.NODE_ENV === 'production';
export const isDevelopment = SERVER_CONFIG.NODE_ENV === 'development';
export const isTest = SERVER_CONFIG.NODE_ENV === 'test';

// ─── Base de datos ───────────────────────────────────────────────────────────

export const DATABASE_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/luma',
  DEBUG_DB_URI: process.env.DEBUG_DB_URI === 'true',
} as const;

// ─── JWT ─────────────────────────────────────────────────────────────────────

export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || '',
  PRIVATE_KEY_PEM: process.env.JWT_PRIVATE_KEY_PEM || '',
  PUBLIC_KEY_PEM: process.env.JWT_PUBLIC_KEY_PEM || '',
  ACCESS_TTL: process.env.JWT_ACCESS_TTL || '7d',
  REFRESH_TTL: process.env.JWT_REFRESH_TTL || '90d',
} as const;

export const JWT_USE_HS256 = !!JWT_CONFIG.SECRET;
export const JWT_USE_RS256 =
  !JWT_USE_HS256 && !!JWT_CONFIG.PRIVATE_KEY_PEM && !!JWT_CONFIG.PUBLIC_KEY_PEM;

/** Nombre de la cookie httpOnly donde vive el refresh token. */
export const REFRESH_COOKIE_NAME = 'luma_refresh';

// ─── Email ───────────────────────────────────────────────────────────────────

export const EMAIL_CONFIG = {
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  FROM_EMAIL: process.env.EMAIL_FROM || 'Luma <onboarding@resend.dev>',
  APP_NAME: process.env.APP_NAME || 'Luma',
  APP_URL: SERVER_CONFIG.APP_URL,
} as const;

export const EMAIL_ENABLED = !!EMAIL_CONFIG.RESEND_API_KEY;

// ─── Asistente conversacional (RF-06) ────────────────────────────────────────

export const ASSISTANT_CONFIG = {
  API_KEY: process.env.ANTHROPIC_API_KEY || '',
  MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  MAX_TOKENS: parseInt(process.env.ASSISTANT_MAX_TOKENS || '1200', 10),
  /**
   * Tope de consultas por proyecto y por día. §12 marca el costo variable del
   * asistente como riesgo: cada consulta cuesta, y sin límite el costo del
   * producto lo fija el usuario más ansioso.
   */
  DAILY_LIMIT: parseInt(process.env.ASSISTANT_DAILY_LIMIT || '200', 10),
} as const;

export const ASSISTANT_ENABLED = !!ASSISTANT_CONFIG.API_KEY;

// ─── Feature flags ───────────────────────────────────────────────────────────

export const FEATURE_FLAGS = {
  ENABLE_SCHEDULERS: process.env.ENABLE_SCHEDULERS !== 'false',
  /** Agrupa los imprevistos no urgentes en un solo envío (RF-09). */
  BATCH_NON_URGENT_NOTIFICATIONS: process.env.BATCH_NON_URGENT_NOTIFICATIONS !== 'false',
} as const;

// ─── Validación de arranque ──────────────────────────────────────────────────

export function validateConfig(): void {
  const errors: string[] = [];

  if (!JWT_USE_HS256 && !JWT_USE_RS256) {
    errors.push(
      'Falta la configuración de JWT. Definí JWT_SECRET (HS256) o el par ' +
        'JWT_PRIVATE_KEY_PEM / JWT_PUBLIC_KEY_PEM (RS256).',
    );
  }

  if (!DATABASE_CONFIG.MONGODB_URI) {
    errors.push('MONGODB_URI es obligatorio.');
  }

  if (isProduction) {
    if (JWT_CONFIG.SECRET === 'change-me-in-production') {
      errors.push('JWT_SECRET quedó con el valor de ejemplo. Cambialo antes de deployar.');
    }
    if (!EMAIL_ENABLED) {
      console.warn('⚠️  [CONFIG] Sin RESEND_API_KEY: los emails se van a loguear, no a enviar.');
    }
    if (!ASSISTANT_ENABLED) {
      console.warn('⚠️  [CONFIG] Sin ANTHROPIC_API_KEY: el asistente (RF-06) responde 503.');
    }
  }

  if (errors.length > 0) {
    console.error('❌ [CONFIG] Errores de configuración:');
    errors.forEach((e) => console.error(`   - ${e}`));
    throw new Error('Configuración inválida. Revisá las variables de entorno.');
  }
}

if (isDevelopment || process.env.DEBUG === 'true') {
  console.log('📋 [CONFIG] Configuración cargada:');
  console.log(`   - Entorno: ${SERVER_CONFIG.NODE_ENV}`);
  console.log(`   - Puerto: ${SERVER_CONFIG.PORT}`);
  console.log(`   - Frontend: ${SERVER_CONFIG.FRONTEND_URL}`);
  console.log(`   - JWT: ${JWT_USE_HS256 ? 'HS256' : JWT_USE_RS256 ? 'RS256' : 'SIN CONFIGURAR'}`);
  console.log(`   - Email: ${EMAIL_ENABLED ? 'Resend' : 'consola'}`);
  console.log(`   - Asistente: ${ASSISTANT_ENABLED ? ASSISTANT_CONFIG.MODEL : 'deshabilitado'}`);
}

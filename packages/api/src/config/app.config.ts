import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Configuración de la aplicación.
 *
 * Todo lo que la app lee del entorno pasa por acá, y `validateConfig()` corre
 * ANTES de crear la app de Express: es preferible no arrancar a arrancar con un
 * JWT sin secreto y descubrirlo en el primer login de un usuario real.
 */

const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const isProduction = NODE_ENV === 'production';
export const isDevelopment = !isProduction;
export const isTest = NODE_ENV === 'test';

export const SERVER_CONFIG = {
  PORT: Number(process.env.PORT ?? 8080),
  HOST: process.env.HOST ?? '0.0.0.0',
  NODE_ENV,
  /** Origen del frontend, para CORS y para los redirects. */
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:6173',
  /**
   * Raíz del SPA, **incluyendo el subpath**: en producción la SPA se monta en
   * `/app`, así que esto es `https://<DOMINIO>/app`. Los links de los mails se
   * arman sobre esta variable (`utils/app-url.ts`); si apunta al dominio pelado,
   * cada link de verificación cae en la landing.
   */
  APP_URL: process.env.APP_URL ?? process.env.FRONTEND_URL ?? 'http://localhost:6173',
  /** Hostname interno de la landing en la red de Docker. */
  LANDING_URL: process.env.LANDING_URL ?? 'http://landing:8080',
} as const;

export const CORS_CONFIG = {
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export const DATABASE_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/luma',
  DEBUG_DB_URI: process.env.DEBUG_DB_URI === 'true',
} as const;

function readPemFromDisk(filename: string): string | undefined {
  try {
    const filePath = path.resolve(process.cwd(), filename);
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : undefined;
  } catch {
    return undefined;
  }
}

export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET,
  PRIVATE_KEY_PEM: process.env.JWT_PRIVATE_KEY_PEM ?? readPemFromDisk('private.pem'),
  PUBLIC_KEY_PEM: process.env.JWT_PUBLIC_KEY_PEM ?? readPemFromDisk('public.pem'),
  ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '7d',
  REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '90d',
} as const;

/** Si hay `JWT_SECRET` se firma con HS256; si no, con el par RS256. */
export const JWT_USE_HS256 = Boolean(JWT_CONFIG.SECRET);
export const JWT_USE_RS256 = !JWT_USE_HS256 && Boolean(JWT_CONFIG.PRIVATE_KEY_PEM);

export const RECAPTCHA_CONFIG = {
  SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
  VERIFY_URL: 'https://www.google.com/recaptcha/api/siteverify',
  DEFAULT_THRESHOLD: 0.5,
  /** En desarrollo no hay site key válida: el verificador deja pasar. */
  ENABLED: isProduction && Boolean(process.env.RECAPTCHA_SECRET_KEY),
} as const;

export const EMAIL_CONFIG = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  FROM: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
  APP_NAME: process.env.APP_NAME ?? 'Luma',
  ENABLED: Boolean(process.env.RESEND_API_KEY),
} as const;

/**
 * Storage de archivos (RF-04: registro fotográfico de evidencia). Cualquier
 * proveedor compatible con S3 sirve — Backblaze B2, Cloudflare R2, AWS S3 —
 * cambiando sólo `STORAGE_ENDPOINT`. Sin credenciales el feature queda
 * deshabilitado (`ENABLED: false`): no vale la pena que la app entera no
 * arranque por un storage que todavía nadie configuró.
 */
export const STORAGE_CONFIG = {
  ENDPOINT: process.env.STORAGE_ENDPOINT,
  REGION: process.env.STORAGE_REGION ?? 'auto',
  BUCKET: process.env.STORAGE_BUCKET,
  ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
  SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
  /** Segundos de vida de cada URL firmada de lectura. */
  SIGNED_URL_TTL: Number(process.env.STORAGE_SIGNED_URL_TTL ?? 3600),
  ENABLED: Boolean(
    process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY,
  ),
} as const;

/**
 * Consultor IA de obra: chat de sólo lectura sobre UNA obra puntual (ver
 * `services/project-advisor.service.ts`). Sin API key el feature queda
 * deshabilitado — no justifica que el resto de la app no arranque.
 */
export const ANTHROPIC_CONFIG = {
  API_KEY: process.env.ANTHROPIC_API_KEY,
  MODEL: 'claude-sonnet-5',
  ENABLED: Boolean(process.env.ANTHROPIC_API_KEY),
} as const;

/**
 * Esquema del entorno. Las reglas que dependen de producción van en el refine:
 * en desarrollo se puede arrancar sin reCAPTCHA ni Resend, en producción no.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatorio'),
    JWT_SECRET: z.string().min(16).optional(),
    JWT_PRIVATE_KEY_PEM: z.string().optional(),
    JWT_PUBLIC_KEY_PEM: z.string().optional(),
    APP_URL: z.string().url().optional(),
    FRONTEND_URL: z.string().url().optional(),
    RECAPTCHA_SECRET_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const hasHs256 = Boolean(env.JWT_SECRET);
    const hasRs256 = Boolean(JWT_CONFIG.PRIVATE_KEY_PEM && JWT_CONFIG.PUBLIC_KEY_PEM);

    if (!hasHs256 && !hasRs256) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message:
          'Falta la configuración de JWT: definí JWT_SECRET (HS256) o el par ' +
          'JWT_PRIVATE_KEY_PEM/JWT_PUBLIC_KEY_PEM (RS256).',
      });
    }

    if (env.NODE_ENV === 'production' && !env.RECAPTCHA_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RECAPTCHA_SECRET_KEY'],
        message: 'RECAPTCHA_SECRET_KEY es obligatorio en producción.',
      });
    }
  });

export function validateConfig(): void {
  const result = envSchema.safeParse({
    NODE_ENV,
    PORT: process.env.PORT,
    MONGODB_URI: DATABASE_CONFIG.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_PRIVATE_KEY_PEM: JWT_CONFIG.PRIVATE_KEY_PEM,
    JWT_PUBLIC_KEY_PEM: JWT_CONFIG.PUBLIC_KEY_PEM,
    APP_URL: process.env.APP_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
  });

  if (!result.success) {
    console.error('❌ [CONFIG] Configuración inválida:');
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`);
    }
    throw new Error('Configuración inválida. Revisá las variables de entorno.');
  }

  // Avisos que no justifican abortar: la app funciona, sólo que sin esa pieza.
  if (!EMAIL_CONFIG.ENABLED) {
    console.warn('⚠️  [CONFIG] Sin RESEND_API_KEY: los mails quedan deshabilitados.');
  }
  if (!STORAGE_CONFIG.ENABLED) {
    console.warn(
      '⚠️  [CONFIG] Sin STORAGE_*: el registro fotográfico de evidencia queda deshabilitado.',
    );
  }
  if (!ANTHROPIC_CONFIG.ENABLED) {
    console.warn('⚠️  [CONFIG] Sin ANTHROPIC_API_KEY: el Consultor IA queda deshabilitado.');
  }
  if (isProduction && !process.env.APP_URL) {
    console.warn('⚠️  [CONFIG] Sin APP_URL: los links de los mails pueden apuntar mal.');
  }

  console.log(`✅ [CONFIG] Entorno ${NODE_ENV}, JWT ${JWT_USE_HS256 ? 'HS256' : 'RS256'}`);
}

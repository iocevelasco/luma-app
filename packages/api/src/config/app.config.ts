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
  /**
   * 8081 en desarrollo. **En producción NO manda este default**: el Dockerfile
   * fija `ENV PORT=8080` y Coolify mapea ese puerto, así que ahí sigue siendo
   * 8080 y cambiarlo acá no lo toca.
   *
   * El 8081 es local y deliberado: el 8080 de esta máquina lo ocupa otro
   * proyecto, y dos APIs peleando por un puerto producen el peor error de
   * todos — una contesta, así que no parece caída, pero es la equivocada.
   */
  PORT: Number(process.env.PORT ?? 8081),
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

/**
 * Medida temporal para pruebas con usuarios: con `REQUIRE_EMAIL_VERIFICATION=false`
 * el registro deja la cuenta ya verificada y no manda mail. Por defecto sigue
 * exigiéndose; hay que apagarlo a propósito.
 */
export const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';

export const EMAIL_CONFIG = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  FROM: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
  APP_NAME: process.env.APP_NAME ?? 'Luma',
  ENABLED: Boolean(process.env.RESEND_API_KEY),
} as const;

/**
 * Storage de archivos (evidencia fotográfica RF-04 y documentación de obra).
 * Lo provee el microservicio `media-service` por HTTP: esta app no habla S3 ni
 * conoce el bucket; sólo guarda el `id` que el servicio le devuelve. Sin URL o
 * API key el feature queda deshabilitado (`ENABLED: false`): no vale la pena
 * que la app entera no arranque por un storage que todavía nadie configuró.
 */
export const STORAGE_CONFIG = {
  /** Raíz del media-service, sin `/` final. Ej. `https://media.matflow.site`. */
  BASE_URL: process.env.MEDIA_SERVICE_URL?.replace(/\/+$/, ''),
  API_KEY: process.env.MEDIA_SERVICE_API_KEY,
  /** Segundos de vida de cada URL firmada de lectura (el servicio admite hasta 3600). */
  SIGNED_URL_TTL: Number(process.env.STORAGE_SIGNED_URL_TTL ?? 3600),
  ENABLED: Boolean(process.env.MEDIA_SERVICE_URL && process.env.MEDIA_SERVICE_API_KEY),
} as const;

/**
 * Tasa oficial del BCV para cobrar la suscripción en bolívares (ver
 * `services/bcv.service.ts`). Se lee de la home del BCV —no tiene API— con el
 * certificado verificado.
 */
export const BCV_CONFIG = {
  URL: process.env.BCV_URL ?? 'https://www.bcv.org.ve/',
  /** Cortar antes de que el request del usuario quede colgado. */
  TIMEOUT_MS: 20_000,
  /**
   * Pasado esto sin una lectura buena (ni una tasa cargada a mano), la tasa
   * queda marcada como vieja. El pago en Bs sigue usando la última guardada.
   */
  MAX_AGE_HOURS: 48,
} as const;

/**
 * Dónde se reciben los pagos de la suscripción en bolívares. Cada método se
 * ofrece sólo si tiene todos sus datos; sin ninguno, el pago en Bs no se
 * ofrece y la app sigue andando.
 */
const env = process.env;
export const BS_PAYMENT_CONFIG = {
  PAGO_MOVIL:
    env.PAGO_MOVIL_BANK && env.PAGO_MOVIL_PHONE && env.PAGO_MOVIL_ID
      ? { bank: env.PAGO_MOVIL_BANK, phone: env.PAGO_MOVIL_PHONE, id: env.PAGO_MOVIL_ID }
      : undefined,
  TRANSFERENCIA:
    env.TRANSFER_BANK && env.TRANSFER_ACCOUNT && env.TRANSFER_HOLDER && env.TRANSFER_ID
      ? {
          bank: env.TRANSFER_BANK,
          account: env.TRANSFER_ACCOUNT,
          holder: env.TRANSFER_HOLDER,
          id: env.TRANSFER_ID,
        }
      : undefined,
} as const;

/**
 * Pago de la suscripción con tarjeta, en dólares (ver `services/stripe.service.ts`).
 * Sin `STRIPE_SECRET_KEY` el pago con tarjeta no se ofrece y la app sigue
 * andando, igual que el resto de las integraciones.
 *
 * Con `STRIPE_PUBLISHABLE_KEY` el formulario de Stripe Checkout se monta en
 * un modal de Luma (Embedded Checkout); sin ella, se va a la página de Stripe.
 * En los dos casos la tarjeta la carga la persona dentro de un iframe o una
 * página de Stripe: nunca pasa por nuestro servidor.
 */
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const secretKey = process.env.STRIPE_SECRET_KEY;
/**
 * El pago con tarjeta se ofrece sólo con la clave de producción (`sk_live_`).
 * Con la del sandbox (`sk_test_`) queda apagado, salvo `STRIPE_TEST_MODE=true`
 * para probar el flujo en local: así un entorno con la clave de prueba nunca
 * le muestra a un cliente real un pago que no cobra.
 */
const stripeTestMode = process.env.STRIPE_TEST_MODE === 'true';
const cardPaymentsEnabled = Boolean(secretKey && (secretKey.startsWith('sk_live_') || stripeTestMode));

if (secretKey && !cardPaymentsEnabled) {
  console.warn(
    'ℹ️  [Stripe] Clave de prueba sin STRIPE_TEST_MODE=true: el pago con tarjeta no se ofrece hasta tener la clave de producción.',
  );
}
/** `pk_test_` con `sk_test_`, `pk_live_` con `sk_live_`: mezclarlas da un modal que no carga. */
const sameStripeMode = (pk?: string, sk?: string) =>
  Boolean(pk && sk && pk.startsWith('pk_live_') === sk.startsWith('sk_live_'));

if (publishableKey && secretKey && !sameStripeMode(publishableKey, secretKey)) {
  console.warn(
    '⚠️  [Stripe] STRIPE_PUBLISHABLE_KEY y STRIPE_SECRET_KEY son de modos distintos (test/live): el pago con tarjeta usa la página de Stripe.',
  );
}

export const STRIPE_CONFIG = {
  SECRET_KEY: secretKey,
  /** Pública por diseño: va al navegador para montar el checkout embebido. */
  PUBLISHABLE_KEY: sameStripeMode(publishableKey, secretKey) ? publishableKey : undefined,
  WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  /**
   * Los precios se buscan por `lookup_key`, no por id: así sandbox y
   * producción usan el mismo código y nadie copia ids a mano. Los crea
   * `scripts/stripe-setup.ts`.
   */
  BASE_PRICE_LOOKUP_KEY: process.env.STRIPE_BASE_PRICE_LOOKUP_KEY ?? 'luma_base_monthly',
  EXTRA_PRICE_LOOKUP_KEY: process.env.STRIPE_EXTRA_PRICE_LOOKUP_KEY ?? 'luma_extra_project_monthly',
  /**
   * Código de impuesto del producto: "Software as a service (SaaS) - business
   * use". Stripe lo exige cuando la cuenta tiene Managed Payments (Stripe como
   * vendedor registrado, activado por defecto en cuentas nuevas) y lo usa
   * Stripe Tax si se activa. Luma es software para empresas, no consumidores.
   */
  PRODUCT_TAX_CODE: process.env.STRIPE_PRODUCT_TAX_CODE ?? 'txcd_10103001',
  ENABLED: cardPaymentsEnabled,
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
    PORT: z.coerce.number().int().positive().default(8081),
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
      '⚠️  [CONFIG] Sin MEDIA_SERVICE_URL/MEDIA_SERVICE_API_KEY: la evidencia fotográfica y la documentación quedan deshabilitadas.',
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

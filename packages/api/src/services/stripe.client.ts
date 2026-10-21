import { createHmac, timingSafeEqual } from 'node:crypto';
import { STRIPE_CONFIG } from '../config/app.config.js';

/**
 * Cliente mínimo de la API REST de Stripe.
 *
 * Sin el SDK a propósito: usamos cinco endpoints (precios, clientes,
 * Checkout, Portal y los ítems de la suscripción) más la verificación de los
 * webhooks, y eso entra en este archivo. Una dependencia menos que mantener
 * al día en la imagen.
 *
 * La versión de la API va fija en cada request: si Stripe cambia la forma de
 * una respuesta, nos enteramos al subir este número, no un martes cualquiera.
 * Los webhooks, en cambio, llegan en la versión configurada en el endpoint
 * del dashboard — por eso `stripe.service.ts` lee los campos que se movieron
 * entre versiones de las dos formas.
 */
export const STRIPE_API_VERSION = '2025-03-31.basil';
const API_BASE = 'https://api.stripe.com/v1';
const TIMEOUT_MS = 20_000;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('STRIPE_NOT_CONFIGURED');
    this.name = 'StripeNotConfiguredError';
  }
}

export class StripeApiError extends Error {
  constructor(
    readonly status: number,
    readonly stripeCode: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

type Param = string | number | boolean | null | undefined | Param[] | { [key: string]: Param };

/**
 * `{ line_items: [{ price: 'p', quantity: 1 }] }` → `line_items[0][price]=p&line_items[0][quantity]=1`,
 * que es como Stripe recibe los parámetros anidados. `undefined` y `null` se omiten.
 */
export function encodeParams(params: Record<string, Param>): string {
  const pairs: string[] = [];
  const walk = (value: Param, key: string) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${key}[${index}]`));
    } else if (typeof value === 'object') {
      for (const [sub, inner] of Object.entries(value)) walk(inner, `${key}[${sub}]`);
    } else {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  };
  for (const [key, value] of Object.entries(params)) walk(value, key);
  return pairs.join('&');
}

export async function stripeRequest<T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, Param> = {},
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  if (!STRIPE_CONFIG.SECRET_KEY) throw new StripeNotConfiguredError();

  const query = encodeParams(params);
  const url = method === 'POST' || !query ? `${API_BASE}${path}` : `${API_BASE}${path}?${query}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_CONFIG.SECRET_KEY}`,
      'Stripe-Version': STRIPE_API_VERSION,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: method === 'POST' ? query : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string };
  };
  if (!response.ok) {
    throw new StripeApiError(
      response.status,
      body.error?.code,
      body.error?.message ?? `Stripe respondió ${response.status}`,
    );
  }
  return body as T;
}

// ─────────────────────────────── Webhooks ───────────────────────────────

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeSignatureError';
  }
}

/** Cuánto puede tener un evento firmado antes de rechazarlo: evita que se reenvíe uno viejo. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verifica el header `Stripe-Signature` contra el cuerpo CRUDO, como lo
 * documenta Stripe: `HMAC-SHA256(secret, "${t}.${body}")` en hex contra cada
 * `v1=` del header (hay más de uno mientras se rota el secreto), comparando
 * en tiempo constante. Tira si no coincide o si el evento es viejo.
 *
 * El cuerpo tiene que ser el original byte por byte: por eso la ruta del
 * webhook se monta con `express.raw()` ANTES de `express.json()`.
 */
export function verifyStripeSignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): void {
  if (!header) throw new StripeSignatureError('Falta el header Stripe-Signature');

  const parts = header.split(',').map((part) => part.trim().split('='));
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new StripeSignatureError('Header Stripe-Signature mal formado');
  }
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new StripeSignatureError('El evento es demasiado viejo');
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')}`)
    .digest();
  const matches = signatures.some((signature) => {
    const given = Buffer.from(signature, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) throw new StripeSignatureError('La firma no coincide');
}

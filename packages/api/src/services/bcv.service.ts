import https from 'node:https';
import tls from 'node:tls';
import { isPlausibleRate, type BcvRate } from '@luma/shared';
import { BCV_CONFIG } from '../config/app.config.js';
import { SECTIGO_DV_R36_PEM } from '../certs/sectigo-dv-r36.js';
import { ExchangeRate, type IExchangeRate } from '../models/ExchangeRate.js';

/**
 * La tasa oficial del BCV, leída de su home (no tiene API).
 *
 * Nunca se lee el BCV en el request de un usuario: el sitio es lento y a
 * veces no responde. Una tarea programada lo lee cada tanto
 * (`scripts/refresh-bcv-rate.ts`), cada lectura se guarda, y el formulario de
 * pago usa la última guardada. Si el BCV deja de responder, la última sigue
 * valiendo hasta `BCV_CONFIG.MAX_AGE_HOURS`; después el pago en Bs se pausa
 * hasta que alguien cargue una a mano.
 */

export class BcvUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BcvUnavailableError';
  }
}

/** La página cambió y ya no encontramos la tasa donde estaba. */
export class BcvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BcvParseError';
  }
}

// ─────────────────────────────── Lectura ───────────────────────────────

/** Raíces de Node + el intermedio que el BCV no manda. Ver `certs/sectigo-dv-r36.ts`. */
const BCV_CA = [...tls.rootCertificates, SECTIGO_DV_R36_PEM];
const MAX_BYTES = 3 * 1024 * 1024;

/** El HTML de la home del BCV, con el certificado verificado. */
export function fetchBcvPage(url: string = BCV_CONFIG.URL): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        ca: BCV_CA,
        timeout: BCV_CONFIG.TIMEOUT_MS,
        headers: { 'User-Agent': 'Luma/1.0 (+tasa BCV)', Accept: 'text/html' },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new BcvUnavailableError(`El BCV respondió ${response.statusCode}`));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy(new BcvUnavailableError('La página del BCV es demasiado grande'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        response.on('error', (error) => reject(new BcvUnavailableError(error.message)));
      },
    );
    request.on('timeout', () =>
      request.destroy(new BcvUnavailableError('El BCV no respondió a tiempo')),
    );
    request.on('error', (error) =>
      reject(error instanceof BcvUnavailableError ? error : new BcvUnavailableError(error.message)),
    );
  });
}

/**
 * "881,87690000" → 881.8769. Acepta el formato venezolano —coma decimal,
 * punto de miles: "1.234,56"— y espacios o texto alrededor ("USD 36,12").
 *
 * No redondea: el BCV publica 8 decimales y recortar acá corre el monto
 * final. Se redondea una sola vez, al convertir (`usdToBolivares`).
 */
export function parseBcvAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned || (cleaned.match(/,/g) ?? []).length > 1) return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** El primer `<strong>` del bloque `id="…"` de una moneda. */
function amountInBlock(html: string, id: string): number | null {
  const start = html.search(new RegExp(`id=["']${id}["']`));
  if (start < 0) return null;
  const block = html.slice(start, start + 2000);
  const strong = /<strong[^>]*>([^<]*)<\/strong>/i.exec(block);
  return strong ? parseBcvAmount(strong[1]) : null;
}

export interface BcvReading {
  usd: number;
  eur: number | null;
  valueDate: string;
}

/**
 * Saca la tasa del HTML. A propósito estricto: si no está el dólar o la
 * fecha valor, tira en vez de adivinar. Una tasa mal leída cobra mal; una
 * que no se pudo leer sólo deja la anterior vigente un rato más.
 *
 * La fecha sale del atributo `content` (ISO), no del texto en castellano
 * ("Martes, 20 Octubre 2026"), que no hay forma segura de parsear.
 */
export function parseBcvPage(html: string): BcvReading {
  const usd = amountInBlock(html, 'dolar');
  if (usd === null) throw new BcvParseError('No encontramos la tasa del dólar en la página del BCV');

  const date = /Fecha\s+Valor[\s\S]{0,400}?content=["'](\d{4}-\d{2}-\d{2})/i.exec(html);
  if (!date) throw new BcvParseError('No encontramos la fecha valor en la página del BCV');

  return { usd, eur: amountInBlock(html, 'euro'), valueDate: date[1] };
}

// ─────────────────────────────── Guardado ───────────────────────────────

export type RefreshOutcome =
  /** Ya la teníamos: sólo se confirmó que sigue publicada. */
  | { status: 'confirmada'; rate: IExchangeRate }
  | { status: 'nueva'; rate: IExchangeRate }
  /** Saltó más de lo creíble: se guardó para revisión pero NO se usa. */
  | { status: 'marcada'; rate: IExchangeRate };

/** La última tasa usable (no marcada), de cualquier origen. */
function latestUsable() {
  return ExchangeRate.findOne({ flagged: false }).sort({ valueDate: -1, lastSeenAt: -1 });
}

/**
 * Lee el BCV y guarda lo que encontró. `fetchPage` se inyecta para los tests;
 * en producción es `fetchBcvPage`.
 */
export async function refreshBcvRate(
  now: Date = new Date(),
  fetchPage: () => Promise<string> = () => fetchBcvPage(),
): Promise<RefreshOutcome> {
  const reading = parseBcvPage(await fetchPage());

  const same = await ExchangeRate.findOneAndUpdate(
    { source: 'bcv', valueDate: reading.valueDate, usd: reading.usd },
    { $set: { lastSeenAt: now } },
    { new: true },
  );
  if (same) return { status: 'confirmada', rate: same };

  const previous = await latestUsable();
  const plausible = isPlausibleRate(reading.usd, previous?.usd ?? null);

  try {
    const rate = await ExchangeRate.create({
      source: 'bcv',
      usd: reading.usd,
      eur: reading.eur,
      valueDate: reading.valueDate,
      fetchedAt: now,
      lastSeenAt: now,
      flagged: !plausible,
      flagReason: plausible
        ? null
        : `Salto de ${previous?.usd} a ${reading.usd} contra la última tasa usable`,
    });
    return { status: plausible ? 'nueva' : 'marcada', rate };
  } catch (error) {
    // Dos lecturas simultáneas de la misma tasa: la otra ya la guardó.
    if ((error as { code?: number }).code === 11000) {
      const existing = await ExchangeRate.findOne({
        source: 'bcv',
        valueDate: reading.valueDate,
        usd: reading.usd,
      });
      if (existing) return { status: 'confirmada', rate: existing };
    }
    throw error;
  }
}

/** Una tasa cargada a mano por un admin. Igual se avisa si no es creíble, pero se guarda: decidió una persona. */
export async function saveManualRate(
  input: { usd: number; valueDate: string },
  adminId: string,
  now: Date = new Date(),
): Promise<{ rate: IExchangeRate; plausible: boolean }> {
  const previous = await latestUsable();
  const rate = await ExchangeRate.create({
    source: 'manual',
    usd: input.usd,
    eur: null,
    valueDate: input.valueDate,
    fetchedAt: now,
    lastSeenAt: now,
    flagged: false,
    createdBy: adminId,
  });
  return { rate, plausible: isPlausibleRate(input.usd, previous?.usd ?? null) };
}

// ─────────────────────────────── Vigente ───────────────────────────────

/** El día de hoy en Caracas (UTC-4, sin horario de verano), `YYYY-MM-DD`. */
export function caracasDayKey(now: Date): string {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * La tasa que rige hoy: la más nueva usable cuya fecha valor ya llegó.
 *
 * El BCV publica a la tarde la tasa de mañana. Hasta que llegue mañana, la
 * que rige es la de hoy — si no, quien paga a las 5 de la tarde lo haría con
 * una tasa que todavía no está vigente. Si sólo hay una futura (recién
 * arrancamos), se usa esa antes que no tener ninguna.
 *
 * `null` si nunca hubo una tasa usable.
 */
export async function currentRate(now: Date = new Date()): Promise<BcvRate | null> {
  const today = caracasDayKey(now);
  const rate =
    (await ExchangeRate.findOne({ flagged: false, valueDate: { $lte: today } }).sort({
      valueDate: -1,
      lastSeenAt: -1,
    })) ?? (await latestUsable());
  if (!rate) return null;

  // Lo que mide si está vieja es la última lectura buena de CUALQUIER tasa:
  // que el BCV todavía muestre la de ayer (fin de semana, feriado) está bien,
  // lo que no está bien es que hace dos días no podamos leerlo.
  const freshest = await ExchangeRate.findOne({ flagged: false }).sort({ lastSeenAt: -1 });
  const lastSeen = freshest?.lastSeenAt ?? rate.lastSeenAt;
  const stale = now.getTime() - lastSeen.getTime() > BCV_CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000;

  return {
    usd: rate.usd,
    valueDate: rate.valueDate,
    source: rate.source,
    lastSeenAt: lastSeen.toISOString(),
    stale,
  };
}

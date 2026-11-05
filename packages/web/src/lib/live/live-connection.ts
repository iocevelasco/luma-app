import { LIVE_RESOURCES, type LiveResource } from '@luma/shared';
import { ApiError } from '@/lib/api-client';
import type { LiveMessage } from '@/api/live';
import { LiveIdleError, LiveUnsupportedError } from '@/api/live';

/**
 * La conexión viva de una obra: abrir, mantener, detectar que murió y volver.
 *
 * Es un módulo sin React a propósito, para poder probarlo con relojes y
 * streams falsos. El hook (`useProjectLive`) sólo lo cablea al ciclo de vida
 * de la pantalla y a la caché de React Query.
 *
 * Se diseña asumiendo que **la conexión se va a caer**: iOS suspende las
 * páginas en segundo plano sin avisar (el stream queda "abierto" y muerto),
 * cada deploy corta todo y los proxies tienen sus timeouts. Por eso:
 *
 * - Un **watchdog** reconecta si no llega ni un latido en un rato.
 * - **Cada reconexión termina en un resync**: se avisa que todo lo vivo puede
 *   estar viejo, y la pantalla vuelve a pedir. Nadie confía en no haber
 *   perdido un aviso.
 * - En segundo plano se **cierra** pasado un rato, y al volver se reabre.
 * - Los fallos se reintentan con backoff exponencial y jitter; mientras tanto
 *   el polling de React Query sostiene las pantallas.
 */

export type LiveStatus =
  /** Abriendo la primera conexión. */
  | 'connecting'
  /** Conectado y escuchando. */
  | 'live'
  /** Falló y va a reintentar. El polling sostiene la pantalla. */
  | 'retrying'
  /** Pausada a propósito (pestaña en segundo plano, o desplazada por otra pestaña). */
  | 'paused'
  /** El servidor dijo que este rol no tiene nada que escuchar en vivo. */
  | 'idle'
  /** Este navegador no puede leer el stream. */
  | 'unsupported'
  /** No se reintenta (sin acceso a la obra, o se apagó). */
  | 'stopped';

export interface LiveConnectionOptions {
  /** Abre el stream. Ver `liveApi.open`. */
  open: (signal: AbortSignal) => AsyncGenerator<LiveMessage>;
  /** `resync`: se reconectó y se pudo perder algo; `event`: llegó un aviso. */
  onInvalidate: (resources: readonly LiveResource[], cause: 'event' | 'resync') => void;
  onStatus?: (status: LiveStatus) => void;
  /** Inyectable para los tests; en producción es `Math.random`. */
  random?: () => number;
}

export interface LiveConnection {
  start(): void;
  stop(): void;
  /** La pestaña pasó a segundo plano. Pasado `HIDDEN_GRACE_MS` se cierra la conexión. */
  hide(): void;
  /** La pestaña volvió. `force`: no confiar en la conexión actual (volvió la red, bfcache). */
  show(options?: { force?: boolean }): void;
}

/** Hasta cuánto aguanta una pestaña oculta antes de soltar la conexión. */
export const HIDDEN_GRACE_MS = 30_000;
/** Pasado esto oculta, al volver no se confía en la conexión: se reabre. iOS la mata a los ~20 s. */
export const RECONNECT_AFTER_HIDDEN_MS = 10_000;
/** Cada cuánto mira el watchdog. */
export const WATCHDOG_INTERVAL_MS = 10_000;
/** Sin ningún mensaje en este múltiplo del latido, la conexión se da por muerta. */
export const WATCHDOG_HEARTBEATS = 2.5;
/** Abrir (hasta `ready`) no puede tardar más que esto. */
export const CONNECT_TIMEOUT_MS = 30_000;

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** Con el servidor saturado (503) o limitando (429) se espacia más. */
const BACKOFF_BUSY_MAX_MS = 60_000;
const DEFAULT_HEARTBEAT_MS = 20_000;

/** Espera antes de reintentar tras `attempt` fallos seguidos: exponencial, con jitter para que no reconecten todos juntos. */
export function backoffMs(attempt: number, random: () => number = Math.random, busy = false): number {
  const cap = busy ? BACKOFF_BUSY_MAX_MS : BACKOFF_MAX_MS;
  const exponential = Math.min(cap, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential * (0.5 + random() * 0.5));
}

/** Errores del servidor que dicen "no insistas": no hay acceso o la ruta no existe. */
function isGiveUp(error: unknown): boolean {
  return error instanceof ApiError && [400, 401, 403, 404].includes(error.status);
}

function isBusy(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 503 || error.status === 429);
}

type AbortReason = 'stop' | 'pause' | 'watchdog' | 'wake';

export function createLiveConnection(options: LiveConnectionOptions): LiveConnection {
  const { open, onInvalidate, onStatus, random = Math.random } = options;

  let started = false;
  let stopped = false;
  let paused = false;
  // `null` hasta el primer estado: así el primer `setStatus` siempre se informa.
  let status: LiveStatus | null = null;

  let controller: AbortController | null = null;
  let abortReason: AbortReason | null = null;
  let attempt = 0;
  let hasConnected = false;
  let heartbeatMs = DEFAULT_HEARTBEAT_MS;
  let lastActivity = 0;
  let hiddenAt: number | null = null;

  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  let watchdog: ReturnType<typeof setInterval> | null = null;
  /** Corta la espera en curso (backoff o pausa) para actuar ya. */
  let interrupt: (() => void) | null = null;

  function setStatus(next: LiveStatus) {
    if (next === status) return;
    status = next;
    onStatus?.(next);
  }

  function abort(reason: AbortReason) {
    abortReason = reason;
    controller?.abort();
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(finish, ms);
      function finish() {
        clearTimeout(timer);
        if (interrupt === finish) interrupt = null;
        resolve();
      }
      interrupt = finish;
    });
  }

  function park(): Promise<void> {
    return new Promise((resolve) => {
      interrupt = () => {
        interrupt = null;
        resolve();
      };
    });
  }

  function clearGrace() {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = null;
  }

  function checkWatchdog() {
    if (!controller) return;
    const silent = Date.now() - lastActivity;
    const limit = status === 'live' ? heartbeatMs * WATCHDOG_HEARTBEATS : CONNECT_TIMEOUT_MS;
    if (silent > limit) abort('watchdog');
  }

  /** Una conexión, de abrir a cerrar. Devuelve si llegó a estar lista y por qué terminó. */
  async function connectOnce(): Promise<{ ready: boolean; bye?: LiveMessage & { type: 'bye' } }> {
    controller = new AbortController();
    abortReason = null;
    lastActivity = Date.now();
    let ready = false;

    try {
      for await (const message of open(controller.signal)) {
        lastActivity = Date.now();

        if (message.type === 'ready') {
          ready = true;
          attempt = 0;
          heartbeatMs = message.heartbeatMs;
          setStatus('live');
          // Si ya estuvo conectada, se pudo perder algo: todo lo vivo vuelve a pedirse.
          if (hasConnected) onInvalidate(LIVE_RESOURCES, 'resync');
          hasConnected = true;
        } else if (message.type === 'invalidate') {
          onInvalidate(message.resources, 'event');
        } else if (message.type === 'bye') {
          return { ready, bye: message };
        }
      }
      return { ready };
    } finally {
      controller = null;
    }
  }

  async function run() {
    while (!stopped) {
      if (paused) {
        setStatus('paused');
        await park();
        continue;
      }

      setStatus(hasConnected || attempt > 0 ? 'retrying' : 'connecting');

      let outcome: Awaited<ReturnType<typeof connectOnce>> | null = null;
      let failure: unknown = null;
      try {
        outcome = await connectOnce();
      } catch (error) {
        failure = error;
      }

      if (stopped) break;

      // Cortes que hicimos nosotros: no son un fallo.
      if (abortReason === 'pause') continue;
      if (abortReason === 'wake') {
        setStatus('retrying');
        continue;
      }

      if (failure instanceof LiveIdleError) {
        setStatus('idle');
        return;
      }
      if (failure instanceof LiveUnsupportedError) {
        setStatus('unsupported');
        return;
      }
      if (failure && isGiveUp(failure)) {
        setStatus('stopped');
        return;
      }

      // El servidor cerró a propósito.
      if (outcome?.bye) {
        if (outcome.bye.reason === 'superseded') {
          // Otra pestaña de la misma persona nos desplazó. Reconectar al toque
          // la desplazaría a ella: se espera a que esta pestaña vuelva a mirarse.
          paused = true;
          continue;
        }
        setStatus('retrying');
        // En un deploy el servidor tarda en volver: no se lo golpea enseguida.
        await wait(outcome.bye.reason === 'shutdown' ? 1_000 + random() * 3_000 : 300 + random() * 700);
        continue;
      }

      // Se cerró sin avisar, falló, o el watchdog la dio por muerta.
      if (!outcome?.ready || failure || abortReason === 'watchdog') attempt += 1;
      setStatus('retrying');
      await wait(backoffMs(attempt, random, isBusy(failure)));
    }
  }

  return {
    start() {
      if (started) return;
      started = true;
      watchdog = setInterval(checkWatchdog, WATCHDOG_INTERVAL_MS);
      void run();
    },

    stop() {
      stopped = true;
      clearGrace();
      if (watchdog) clearInterval(watchdog);
      watchdog = null;
      abort('stop');
      interrupt?.();
      setStatus('stopped');
    },

    hide() {
      if (stopped || hiddenAt !== null) return;
      hiddenAt = Date.now();
      clearGrace();
      graceTimer = setTimeout(() => {
        paused = true;
        abort('pause');
      }, HIDDEN_GRACE_MS);
    },

    show(showOptions = {}) {
      if (stopped) return;
      clearGrace();
      const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;

      if (paused) {
        paused = false;
        interrupt?.();
        return;
      }

      if (showOptions.force || hiddenFor >= RECONNECT_AFTER_HIDDEN_MS) {
        if (controller) abort('wake');
        else interrupt?.();
      }
    },
  };
}

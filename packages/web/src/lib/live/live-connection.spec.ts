import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_RESOURCES } from '@luma/shared';
import { ApiError } from '@/lib/api-client';
import { LiveIdleError, LiveUnsupportedError, type LiveMessage } from '@/api/live';
import {
  CONNECT_TIMEOUT_MS,
  HIDDEN_GRACE_MS,
  RECONNECT_AFTER_HIDDEN_MS,
  backoffMs,
  createLiveConnection,
  type LiveStatus,
} from './live-connection';

/**
 * La conexión viva se prueba con streams falsos que el test dirige a mano y
 * con relojes falsos: qué pasa cuando llega un aviso, cuando se cae, cuando
 * se calla, cuando la pestaña se va al fondo. La red real es de la prueba de
 * entorno (iPhone, Traefik).
 */

type Item = LiveMessage | Error | 'end';

/** Un stream que el test alimenta con `push`, y que se corta si se lo aborta. */
function fakeStream() {
  const queue: Item[] = [];
  let notify: (() => void) | null = null;

  return {
    push(item: Item) {
      queue.push(item);
      notify?.();
    },
    open: async function* (signal: AbortSignal): AsyncGenerator<LiveMessage> {
      for (;;) {
        while (queue.length === 0) {
          await new Promise<void>((resolve, reject) => {
            if (signal.aborted) return reject(new Error('abortado'));
            notify = resolve;
            signal.addEventListener('abort', () => reject(new Error('abortado')), { once: true });
          });
        }
        const item = queue.shift()!;
        if (item === 'end') return;
        if (item instanceof Error) throw item;
        yield item;
      }
    },
  };
}

const ready = (heartbeatMs = 20_000): LiveMessage => ({ type: 'ready', heartbeatMs });

describe('backoffMs', () => {
  it('crece exponencialmente hasta el tope', () => {
    const max = () => 1; // sin recorte por jitter
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => backoffMs(n, max))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });

  it('el jitter reparte entre la mitad y el total', () => {
    expect(backoffMs(3, () => 0)).toBe(2000);
    expect(backoffMs(3, () => 1)).toBe(4000);
  });

  it('con el servidor saturado espacia más', () => {
    expect(backoffMs(10, () => 1, true)).toBe(60000);
  });
});

describe('createLiveConnection', () => {
  let streams: ReturnType<typeof fakeStream>[];
  let open: ReturnType<typeof vi.fn>;
  let onInvalidate: ReturnType<typeof vi.fn>;
  let statuses: LiveStatus[];

  /** Cada `open` consume el próximo stream; el test las prepara en orden. */
  function make() {
    return createLiveConnection({
      open: (signal) => open(signal),
      onInvalidate,
      onStatus: (status) => statuses.push(status),
      random: () => 1,
    });
  }

  function next(): ReturnType<typeof fakeStream> {
    const stream = fakeStream();
    streams.push(stream);
    return stream;
  }

  const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

  beforeEach(() => {
    vi.useFakeTimers();
    streams = [];
    statuses = [];
    onInvalidate = vi.fn();
    let i = 0;
    open = vi.fn((signal: AbortSignal) => streams[i++].open(signal));
  });
  afterEach(() => vi.useRealTimers());

  it('abre, queda `live` al recibir `ready` y entrega los avisos', async () => {
    const s = next();
    const connection = make();
    connection.start();
    await tick();
    expect(statuses).toEqual(['connecting']);

    s.push(ready());
    await tick();
    expect(statuses).toEqual(['connecting', 'live']);
    // La primera conexión no necesita resync: la pantalla acaba de pedir sus datos.
    expect(onInvalidate).not.toHaveBeenCalled();

    s.push({ type: 'invalidate', projectId: 'p1', resources: ['activities'] });
    await tick();
    expect(onInvalidate).toHaveBeenCalledWith(['activities'], 'event');

    connection.stop();
  });

  it('si el stream se cierra, reconecta y hace resync de todo lo vivo', async () => {
    const first = next();
    const second = next();
    const connection = make();
    connection.start();
    first.push(ready());
    await tick();

    first.push('end');
    await tick(1000); // backoff del primer intento, sin jitter
    second.push(ready());
    await tick();

    expect(open).toHaveBeenCalledTimes(2);
    expect(onInvalidate).toHaveBeenCalledWith(LIVE_RESOURCES, 'resync');
    expect(statuses.at(-1)).toBe('live');
    connection.stop();
  });

  it('los fallos se reintentan con backoff creciente', async () => {
    const a = next();
    const b = next();
    const c = next();
    const connection = make();
    connection.start();
    a.push(new Error('red'));
    await tick();
    expect(open).toHaveBeenCalledTimes(1);

    await tick(999);
    expect(open).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(open).toHaveBeenCalledTimes(2); // 1.º fallo → 1 s

    b.push(new Error('red'));
    await tick(1999);
    expect(open).toHaveBeenCalledTimes(2);
    await tick(1);
    expect(open).toHaveBeenCalledTimes(3); // 2.º fallo → 2 s

    expect(statuses).toContain('retrying');
    c.push(ready());
    await tick();
    expect(statuses.at(-1)).toBe('live');
    connection.stop();
  });

  it.each([400, 401, 403, 404])('con un %i de la API no reintenta: no hay acceso', async (status) => {
    const s = next();
    const connection = make();
    connection.start();
    s.push(new ApiError('no', status, 'NOT_FOUND'));
    await tick(120_000);

    expect(open).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('stopped');
  });

  // Traefik contesta 404 en texto plano mientras el contenedor nuevo no tiene
  // ruta, justo después de un deploy. No lo dijo la API (no trae `code`): darse
  // por vencido ahí dejaría a todos sin canal hasta recargar.
  it.each([400, 401, 403, 404])('un %i sin `code` (el proxy, no la API) se reintenta', async (status) => {
    const first = next();
    const second = next();
    const connection = make();
    connection.start();
    first.push(new ApiError('404 page not found', status));
    await tick(1000);

    expect(open).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).not.toBe('stopped');

    second.push(ready());
    await tick();
    expect(statuses.at(-1)).toBe('live');
    connection.stop();
  });

  it('con un 503 sigue reintentando, más espaciado', async () => {
    const a = next();
    next();
    const connection = make();
    connection.start();
    a.push(new ApiError('saturado', 503));
    await tick(1000);
    expect(open).toHaveBeenCalledTimes(2);
    connection.stop();
  });

  it('un 204 deja la conexión en `idle` y no reintenta', async () => {
    const s = next();
    const connection = make();
    connection.start();
    s.push(new LiveIdleError());
    await tick(120_000);

    expect(open).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('idle');
  });

  it('un navegador sin streams queda en `unsupported` y no reintenta', async () => {
    const s = next();
    const connection = make();
    connection.start();
    s.push(new LiveUnsupportedError());
    await tick(120_000);

    expect(open).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('unsupported');
  });

  it('`bye` por cambio de acceso reconecta enseguida y vuelve a pedir todo', async () => {
    const first = next();
    const second = next();
    const connection = make();
    connection.start();
    first.push(ready());
    first.push({ type: 'bye', reason: 'access-changed' });
    await tick(1000);
    second.push(ready());
    await tick();

    expect(open).toHaveBeenCalledTimes(2);
    expect(onInvalidate).toHaveBeenCalledWith(LIVE_RESOURCES, 'resync');
    connection.stop();
  });

  it('desplazada por otra pestaña (`superseded`), espera a que la miren en vez de pelearla', async () => {
    const first = next();
    const second = next();
    const connection = make();
    connection.start();
    first.push(ready());
    first.push({ type: 'bye', reason: 'superseded' });
    await tick(120_000);

    expect(open).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('paused');

    connection.show();
    second.push(ready());
    await tick();
    expect(open).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('live');
    connection.stop();
  });

  it('el watchdog reconecta si dejan de llegar latidos', async () => {
    const first = next();
    const second = next();
    const connection = make();
    connection.start();
    first.push(ready(20_000));
    await tick();

    // Silencio mayor a 2,5 latidos (50 s); el watchdog mira cada 10 s y el
    // primer reintento espera 1 s.
    await tick(61_000);
    expect(open).toHaveBeenCalledTimes(2);

    second.push(ready());
    await tick();
    expect(onInvalidate).toHaveBeenCalledWith(LIVE_RESOURCES, 'resync');
    connection.stop();
  });

  it('un latido mantiene viva la conexión', async () => {
    const s = next();
    const connection = make();
    connection.start();
    s.push(ready(20_000));
    await tick();

    for (let i = 0; i < 6; i++) {
      await tick(20_000);
      s.push({ type: 'ping' });
      await tick();
    }
    expect(open).toHaveBeenCalledTimes(1);
    connection.stop();
  });

  it('si abrir se cuelga más de CONNECT_TIMEOUT_MS, lo da por fallido', async () => {
    next(); // nunca contesta
    next();
    const connection = make();
    connection.start();

    await tick(CONNECT_TIMEOUT_MS + 10_000);
    expect(open).toHaveBeenCalledTimes(1);
    await tick(1000);
    expect(open).toHaveBeenCalledTimes(2);
    connection.stop();
  });

  it('en segundo plano suelta la conexión pasado el período de gracia y al volver la reabre', async () => {
    const first = next();
    const second = next();
    const connection = make();
    connection.start();
    first.push(ready());
    await tick();

    connection.hide();
    await tick(HIDDEN_GRACE_MS - 1000);
    expect(statuses.at(-1)).toBe('live');
    await tick(1000);
    expect(statuses.at(-1)).toBe('paused');

    connection.show();
    second.push(ready());
    await tick();
    expect(open).toHaveBeenCalledTimes(2);
    expect(onInvalidate).toHaveBeenCalledWith(LIVE_RESOURCES, 'resync');
    connection.stop();
  });

  it('si vuelve antes de un instante, no toca la conexión', async () => {
    const s = next();
    const connection = make();
    connection.start();
    s.push(ready());
    await tick();

    connection.hide();
    await tick(RECONNECT_AFTER_HIDDEN_MS - 1000);
    connection.show();
    await tick(HIDDEN_GRACE_MS);

    expect(open).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('live');
    connection.stop();
  });

  it('si estuvo oculta lo bastante, al volver no confía en la conexión (iOS la mata sin avisar)', async () => {
    const first = next();
    const second = next();
    const connection = make();
    connection.start();
    first.push(ready());
    await tick();

    connection.hide();
    await tick(RECONNECT_AFTER_HIDDEN_MS + 1000);
    connection.show();
    second.push(ready());
    await tick();

    expect(open).toHaveBeenCalledTimes(2);
    expect(onInvalidate).toHaveBeenCalledWith(LIVE_RESOURCES, 'resync');
    connection.stop();
  });

  it('`show({ force })` (volvió la red, bfcache) reconecta aunque no estuviera oculta', async () => {
    const first = next();
    const second = next();
    const connection = make();
    connection.start();
    first.push(ready());
    await tick();

    connection.show({ force: true });
    second.push(ready());
    await tick();

    expect(open).toHaveBeenCalledTimes(2);
    connection.stop();
  });

  it('`stop` corta la conexión y no reintenta', async () => {
    const first = next();
    next();
    const connection = make();
    connection.start();
    first.push(ready());
    await tick();

    connection.stop();
    await tick(120_000);

    expect(open).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('stopped');
  });

  it('`stop` durante un backoff cancela el reintento', async () => {
    const first = next();
    next();
    const connection = make();
    connection.start();
    first.push(new Error('red'));
    await tick(100);

    connection.stop();
    await tick(120_000);
    expect(open).toHaveBeenCalledTimes(1);
  });
});

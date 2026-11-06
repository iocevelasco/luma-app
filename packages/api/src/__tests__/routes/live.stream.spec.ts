import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import compression from 'compression';
import express from 'express';
import { capabilitiesInProject } from '@luma/shared';

/**
 * El stream de punta a punta sobre HTTP real (Express + `compression` + hub),
 * sin base de datos. Es lo que ningún unit test con sockets falsos puede decir:
 * que el primer evento sale **ya** y no queda retenido por la compresión, que
 * los headers son los que un proxy necesita, y que el cierre llega al cliente.
 *
 * Lo que sigue sin cubrir es lo que depende del entorno: Traefik, HTTP/2 y un
 * iPhone real (ver `docs/adr/002-tiempo-real-por-obra.md`).
 */
vi.mock('../../config/app.config.js', () => ({
  LIVE_CONFIG: {
    ENABLED: true,
    MAX_CONNECTIONS: 50,
    MAX_CONNECTIONS_PER_USER: 4,
    HEARTBEAT_MS: 60,
    MAX_LIFETIME_MS: 60_000,
    COALESCE_MS: 20,
    MAX_BUFFERED_BYTES: 64 * 1024,
  },
}));
vi.mock('../../models/User.js', () => ({
  User: {
    findById: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ enabled: true, account_status: 'active' }),
    })),
  },
}));

const { liveHub } = await import('../../services/live-hub.service.js');
const { streamProjectLive } = await import('../../controllers/live.controller.js');
const { compressionFilter } = await import('../../middleware/compression-filter.js');
const { errorHandler } = await import('../../middleware/errorHandler.js');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(compression({ filter: compressionFilter }));

  // En producción esto lo resuelven `isAuthenticated` y `requireProjectAccess`.
  app.use((req, _res, next) => {
    req.user = { sub: 'user-1' } as never;
    req.project = { _id: 'p1' } as never;
    req.projectCapabilities = capabilitiesInProject('supervisor', { providersVisibleToClient: false });
    next();
  });

  app.get('/live', streamProjectLive);
  app.get('/big', (_req, res) => res.json({ text: 'x'.repeat(5000) }));
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  liveHub.closeAll('shutdown');
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Lee del stream hasta que lo acumulado cumpla la condición, o falla a los `ms`. */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  done: (text: string) => boolean,
  ms = 1500,
): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  const deadline = Date.now() + ms;

  while (!done(text)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`Se agotó la espera. Llegó hasta ahora:\n${text}`);
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Se agotó la espera. Llegó:\n${text}`)), remaining)),
    ]);
    if (result.done) return text;
    text += decoder.decode(result.value, { stream: true });
  }
  return text;
}

describe('GET /live (HTTP real)', () => {
  it('manda `ready` enseguida, con los headers que necesita un proxy y sin comprimir', async () => {
    const controller = new AbortController();
    const response = await fetch(`${base}/live`, {
      headers: { 'Accept-Encoding': 'gzip, deflate', Accept: 'text/event-stream' },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('content-encoding')).toBeNull();

    const reader = response.body!.getReader();
    const text = await readUntil(reader, (t) => t.includes('event: ready'));
    expect(text).toContain('event: ready');

    controller.abort();
  });

  it('un aviso publicado llega al cliente y no trae datos de negocio', async () => {
    const controller = new AbortController();
    const response = await fetch(`${base}/live`, { signal: controller.signal });
    const reader = response.body!.getReader();
    await readUntil(reader, (t) => t.includes('event: ready'));

    liveHub.publish('p1', ['materials']);
    const text = await readUntil(reader, (t) => t.includes('event: invalidate'));

    const data = JSON.parse(text.split('event: invalidate\ndata: ')[1].split('\n')[0]);
    expect(data).toMatchObject({ v: 1, projectId: 'p1', resources: ['materials'] });
    expect(Object.keys(data).sort()).toEqual(['at', 'projectId', 'resources', 'v']);

    controller.abort();
  });

  it('manda latidos mientras no pasa nada', async () => {
    const controller = new AbortController();
    const response = await fetch(`${base}/live`, { signal: controller.signal });
    const reader = response.body!.getReader();

    const text = await readUntil(reader, (t) => t.includes('event: ping'));
    expect(text).toContain('event: ping');

    controller.abort();
  });

  it('cuando el servidor corta la obra, el cliente lo ve y el stream termina', async () => {
    const response = await fetch(`${base}/live`);
    const reader = response.body!.getReader();
    await readUntil(reader, (t) => t.includes('event: ready'));

    liveHub.closeProject('p1', 'access-changed');
    const text = await readUntil(reader, (t) => t.includes('event: bye'));
    expect(text).toContain('"reason":"access-changed"');

    // Tras `bye` el servidor cierra: la lectura termina sola.
    const rest = await reader.read();
    expect(rest.done).toBe(true);
  });

  it('al irse el cliente se libera su lugar en el hub', async () => {
    const before = liveHub.stats().connections;
    const controller = new AbortController();
    const response = await fetch(`${base}/live`, { signal: controller.signal });
    await readUntil(response.body!.getReader(), (t) => t.includes('event: ready'));
    expect(liveHub.stats().connections).toBe(before + 1);

    controller.abort();
    await vi.waitFor(() => expect(liveHub.stats().connections).toBe(before), { timeout: 1500 });
  });

  it('el resto de las respuestas sigue comprimiéndose', async () => {
    const response = await fetch(`${base}/big`, { headers: { 'Accept-Encoding': 'gzip' } });
    // `fetch` descomprime solo, pero deja el header: prueba que se comprimió.
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(((await response.json()) as { text: string }).text).toHaveLength(5000);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const openStream = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiClient: { openStream } }));

const { LiveIdleError, LiveUnsupportedError, liveApi, toLiveMessage } = await import('./live');

const frame = (event: string, data: unknown) => ({ event, data: JSON.stringify(data) });

describe('toLiveMessage', () => {
  it('entiende `ready`', () => {
    expect(toLiveMessage(frame('ready', { v: 1, heartbeatMs: 20000 }))).toEqual({
      type: 'ready',
      heartbeatMs: 20000,
    });
  });

  it('entiende `invalidate` y descarta recursos que no conoce', () => {
    expect(
      toLiveMessage(frame('invalidate', { v: 1, projectId: 'p1', resources: ['materials', 'expenses'] })),
    ).toEqual({ type: 'invalidate', projectId: 'p1', resources: ['materials'] });
  });

  it('un `invalidate` sin recursos conocidos no es un aviso', () => {
    expect(
      toLiveMessage(frame('invalidate', { v: 1, projectId: 'p1', resources: ['expenses'] })),
    ).toBeNull();
  });

  it('entiende `ping` y `bye`', () => {
    expect(toLiveMessage(frame('ping', { v: 1 }))).toEqual({ type: 'ping' });
    expect(toLiveMessage(frame('bye', { v: 1, reason: 'shutdown' }))).toEqual({
      type: 'bye',
      reason: 'shutdown',
    });
  });

  it('ignora lo que no entiende en vez de romper', () => {
    expect(toLiveMessage({ event: 'ping', data: 'no es json' })).toBeNull();
    expect(toLiveMessage(frame('ping', { v: 2 }))).toBeNull(); // un servidor más nuevo
    expect(toLiveMessage(frame('evento-nuevo', { v: 1 }))).toBeNull();
    expect(toLiveMessage(frame('bye', { v: 1, reason: 'otra-cosa' }))).toBeNull();
    expect(toLiveMessage(frame('ready', { v: 1, heartbeatMs: -5 }))).toBeNull();
    expect(toLiveMessage({ event: 'ping', data: 'null' })).toBeNull();
  });
});

function responseWith(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe('liveApi.open', () => {
  beforeEach(() => openStream.mockReset());

  it('abre el stream de la obra y entrega los mensajes ya validados', async () => {
    openStream.mockResolvedValue(
      responseWith(
        'event: ready\ndata: {"v":1,"heartbeatMs":20000}\n\n' +
          'event: raro\ndata: {"v":1}\n\n' +
          'event: invalidate\ndata: {"v":1,"projectId":"p1","resources":["activities"]}\n\n',
      ),
    );

    const messages = [];
    for await (const message of liveApi.open('p1', new AbortController().signal)) messages.push(message);

    expect(openStream).toHaveBeenCalledWith('/api/projects/p1/live', expect.any(AbortSignal));
    expect(messages).toEqual([
      { type: 'ready', heartbeatMs: 20000 },
      { type: 'invalidate', projectId: 'p1', resources: ['activities'] },
    ]);
  });

  it('un 204 es "nada que escuchar": no se reintenta', async () => {
    openStream.mockResolvedValue(new Response(null, { status: 204 }));
    const run = async () => {
      for await (const message of liveApi.open('p1', new AbortController().signal)) void message;
    };
    await expect(run()).rejects.toBeInstanceOf(LiveIdleError);
  });

  it('sin un body legible, el navegador no sirve para esto', async () => {
    openStream.mockResolvedValue({ status: 200, body: null });
    const run = async () => {
      for await (const message of liveApi.open('p1', new AbortController().signal)) void message;
    };
    await expect(run()).rejects.toBeInstanceOf(LiveUnsupportedError);
  });
});

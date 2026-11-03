import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { createNexusTransport } from './nexus-transport';
import { NexusHttpError } from './nexus-stream';

const stream = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('./nexus-stream', async (original) => ({
  ...(await original<typeof import('./nexus-stream')>()),
  streamNexusChat: (a: unknown) => stream.fn(a),
}));

const FAR = '2999-01-01T00:00:00.000Z';
const signal = new AbortController().signal;

async function* chunks(...items: string[]) {
  for (const i of items) yield i;
}

async function collect(t: ReturnType<typeof createNexusTransport>, message = 'hola') {
  const out: string[] = [];
  for await (const c of t.stream({ message, signal })) out.push(c);
  return out;
}

let ids: string[];
let openSession: ReturnType<typeof vi.fn>;
function make(now = () => 1_000) {
  let n = 0;
  return createNexusTransport({
    apiUrl: 'https://nexus.example.com',
    openSession: (id) => openSession(id),
    newId: () => ids[n++] ?? `conv-extra${n}`,
    now,
  });
}

beforeEach(() => {
  ids = ['conv-0000aaaa', 'conv-1111bbbb'];
  openSession = vi.fn().mockResolvedValue({ sessionToken: 'tok-1', expiresAt: FAR });
  stream.fn.mockReset();
  stream.fn.mockImplementation(() => chunks('Hola', ' mundo'));
});

describe('createNexusTransport', () => {
  it('abre la sesión de la conversación y manda el mensaje con su token', async () => {
    const t = make();
    expect(await collect(t)).toEqual(['Hola', ' mundo']);

    expect(openSession).toHaveBeenCalledWith('conv-0000aaaa');
    expect(stream.fn).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: 'https://nexus.example.com', sessionToken: 'tok-1', message: 'hola' }),
    );
  });

  it('reutiliza el token mientras no esté por vencer', async () => {
    const t = make();
    await collect(t);
    await collect(t, 'otra');
    expect(openSession).toHaveBeenCalledTimes(1);
  });

  it('renueva el token cuando le queda menos del margen', async () => {
    let clock = 0;
    openSession
      .mockResolvedValueOnce({ sessionToken: 'tok-1', expiresAt: new Date(60_000).toISOString() })
      .mockResolvedValueOnce({ sessionToken: 'tok-2', expiresAt: FAR });
    const t = make(() => clock);

    await collect(t);
    clock = 45_000; // faltan 15 s: dentro del margen de 30 s
    await collect(t);

    expect(openSession).toHaveBeenCalledTimes(2);
    expect(stream.fn.mock.calls[1][0]).toMatchObject({ sessionToken: 'tok-2' });
  });

  it('si NexusBot responde token_expired antes de contestar, renueva y reintenta una vez', async () => {
    openSession
      .mockResolvedValueOnce({ sessionToken: 'tok-viejo', expiresAt: FAR })
      .mockResolvedValueOnce({ sessionToken: 'tok-nuevo', expiresAt: FAR });
    stream.fn
      .mockImplementationOnce(() => {
        // eslint-disable-next-line require-yield
        return (async function* () {
          throw new NexusHttpError('session', 'token_expired', 401);
        })();
      })
      .mockImplementationOnce(() => chunks('ok'));

    expect(await collect(make())).toEqual(['ok']);
    expect(stream.fn.mock.calls[1][0]).toMatchObject({ sessionToken: 'tok-nuevo' });
  });

  it('no reintenta si ya mostró texto (no se duplica) ni más de una vez', async () => {
    stream.fn.mockImplementation(() =>
      (async function* () {
        yield 'parcial';
        throw new NexusHttpError('session', 'token_expired', 401);
      })(),
    );
    await expect(collect(make())).rejects.toMatchObject({ code: 'token_expired' });
    expect(stream.fn).toHaveBeenCalledTimes(1);

    stream.fn.mockReset();
    stream.fn.mockImplementation(() =>
      // eslint-disable-next-line require-yield
      (async function* () {
        throw new NexusHttpError('session', 'token_expired', 401);
      })(),
    );
    await expect(collect(make())).rejects.toMatchObject({ code: 'token_expired' });
    expect(stream.fn).toHaveBeenCalledTimes(2);
  });

  it('una conversación nueva abre otra sesión con otro identificador', async () => {
    const t = make();
    await collect(t);
    t.reset();
    await collect(t);

    expect(openSession.mock.calls.map((c) => c[0])).toEqual(['conv-0000aaaa', 'conv-1111bbbb']);
  });

  it.each([
    [new ApiError('x', 503, 'SERVICE_UNAVAILABLE'), 'unavailable'],
    [new ApiError('x', 429, 'RATE_LIMITED'), 'rate-limited'],
    [new ApiError('x', 401, 'UNAUTHENTICATED'), 'session'],
    [new TypeError('Failed to fetch'), 'network'],
  ])('un fallo al abrir la sesión (%#) se reduce a %s sin conservar el texto', async (error, failure) => {
    openSession.mockRejectedValue(error);
    const result = await collect(make()).catch((e: unknown) => e);
    expect(result).toMatchObject({ failure });
    expect((result as Error).message).toBe(failure);
  });

  it('el token no se guarda en el navegador', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await collect(make());
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

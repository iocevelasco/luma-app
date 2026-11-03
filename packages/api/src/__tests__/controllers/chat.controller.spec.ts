import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

/**
 * Lo que importa de la sesión del chat: la clave de NexusBot no sale, el cuerpo
 * de NexusBot tampoco (sólo lo que el navegador necesita, en el sobre estándar),
 * la metadata no lleva el correo y cada conversación tiene su propia sesión.
 */
vi.mock('../../config/app.config.js', () => ({
  NEXUSBOT_CONFIG: {
    API_URL: 'https://nexus.example.com',
    API_KEY: 'clave-secreta-del-servidor',
    ADMIN_KEY: 'admin',
    PROJECT_ID: 'luma',
    ENABLED: true,
  },
}));
vi.mock('../../services/chat-prompt.service.js', () => ({
  currentChatPrompt: vi.fn(),
  saveChatPrompt: vi.fn(),
}));

const { createChatSession } = await import('../../controllers/chat.controller.js');

function run(
  body: unknown,
  user: { sub: string; email: string } | null = { sub: 'u-1', email: 'ana@example.com' },
) {
  const req = { user: user ?? undefined, body } as unknown as Request;
  const json = vi.fn();
  const res = { json } as unknown as Response;
  const next = vi.fn();
  return { req, res, json, next: next as unknown as NextFunction & ReturnType<typeof vi.fn> };
}

const nexusOk = {
  sessionToken: 'jwt.token.aqui',
  expiresAt: '2026-11-03T12:00:00.000Z',
  expiresIn: 900,
  sessionId: 'interno',
  created: true,
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new globalThis.Response(JSON.stringify(nexusOk), { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createChatSession', () => {
  it('devuelve sólo token, vencimiento y duración en el sobre estándar', async () => {
    const { req, res, json, next } = run({});
    await createChatSession(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { sessionToken: 'jwt.token.aqui', expiresAt: '2026-11-03T12:00:00.000Z', expiresIn: 900 },
    });
  });

  it('manda la clave a NexusBot, no manda el correo y usa una conversación propia', async () => {
    const { req, res, next } = run({ conversationId: 'conv-1234abcd' });
    await createChatSession(req, res, next);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://nexus.example.com/api/v1/sessions');
    expect(init.headers['X-API-KEY']).toBe('clave-secreta-del-servidor');
    expect(JSON.parse(init.body)).toEqual({
      projectId: 'luma',
      externalUserId: 'u-1:conv-1234abcd',
      userMetadata: {},
    });
    expect(init.body).not.toContain('ana@example.com');
  });

  it('sin conversationId usa el id de la persona', async () => {
    const { req, res, next } = run(undefined);
    await createChatSession(req, res, next);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).externalUserId).toBe('u-1');
  });

  it('rechaza un conversationId inválido sin llamar a NexusBot', async () => {
    const { req, res, next } = run({ conversationId: '../../etc/passwd' });
    await createChatSession(req, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exige sesión iniciada', async () => {
    const { req, res, next } = run({}, null);
    await createChatSession(req, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si NexusBot falla, responde un 503 propio sin su cuerpo ni la clave', async () => {
    fetchMock.mockResolvedValue(
      new globalThis.Response(JSON.stringify({ error: { message: 'Origen no permitido: https://interno' } }), {
        status: 403,
      }),
    );
    const { req, res, next } = run({});
    await createChatSession(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 });
    expect(error.message).not.toMatch(/Origen|interno|clave-secreta/);
  });

  it('si NexusBot no responde, o devuelve algo que no es una sesión, también es un 503', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED 10.0.0.5:3000'));
    let ctx = run({});
    await createChatSession(ctx.req, ctx.res, ctx.next);
    expect(ctx.next.mock.calls[0][0]).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(ctx.next.mock.calls[0][0].message).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);

    fetchMock.mockResolvedValueOnce(new globalThis.Response('no es json', { status: 200 }));
    ctx = run({});
    await createChatSession(ctx.req, ctx.res, ctx.next);
    expect(ctx.next.mock.calls[0][0]).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(ctx.json).not.toHaveBeenCalled();
  });
});

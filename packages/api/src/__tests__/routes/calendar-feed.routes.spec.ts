import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El feed de calendario por HTTP: lo que ve un calendario externo (status,
 * tipo, caché) y lo que ve la cuenta al generarlo. Sin base: lo que importa es
 * lo que sale por el cable.
 */
vi.mock('../../models/User.js', () => ({ User: { findOne: vi.fn(), findById: vi.fn(), updateOne: vi.fn() } }));
vi.mock('../../services/calendar-feed.service.js', async (original) => ({
  ...(await original<typeof import('../../services/calendar-feed.service.js')>()),
  accountForFeedToken: vi.fn(),
  calendarEventsFor: vi.fn(),
}));
vi.mock('../../services/session.service.js', () => ({
  currentTokenVersion: vi.fn().mockResolvedValue(0),
  tokenVersionOf: vi.fn(() => 0),
  forgetTokenVersion: vi.fn(),
}));
vi.mock('../../services/jwt.service.js', () => ({
  JWTService: { verifyAccessToken: vi.fn(() => ({ sub: 'user-1', email: 'a@x.com', roles: ['user'] })) },
}));
vi.mock('../../services/storage.service.js', () => ({
  signObjectUrl: vi.fn(),
  deleteObject: vi.fn(),
  openObject: vi.fn(),
  uploadMaterialPhoto: vi.fn(),
  uploadProjectDocument: vi.fn(),
  uploadEvidencePhoto: vi.fn(),
  uploadMilestoneAttachment: vi.fn(),
  uploadSubscriptionReceipt: vi.fn(),
  StorageNotConfiguredError: class extends Error {},
}));

const { User } = await import('../../models/User.js');
const { accountForFeedToken, calendarEventsFor, hashFeedToken } = await import(
  '../../services/calendar-feed.service.js'
);
const { publicRouter } = await import('../../routes/public.js');
const { calendarRouter } = await import('../../routes/calendar.js');
const { normalizeErrors } = await import('../../middleware/normalizeErrors.js');
const { errorHandler } = await import('../../middleware/errorHandler.js');

const TOKEN = 'A'.repeat(43);
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(normalizeErrors);
  app.use('/api/public', publicRouter);
  app.use('/api/calendar', calendarRouter);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => vi.clearAllMocks());

const auth = { Authorization: 'Bearer un-token', 'Content-Type': 'application/json' };

describe('GET /api/public/calendar/:token.ics', () => {
  it('sirve el calendario con su tipo, caché privada y ETag', async () => {
    vi.mocked(accountForFeedToken).mockResolvedValue({ _id: 'user-1' } as never);
    vi.mocked(calendarEventsFor).mockResolvedValue([
      { uid: 'activity-1@luma', summary: 'Losa · Casa', startDay: '2026-11-20', endDay: '2026-11-20', updatedAt: new Date(0) },
    ]);

    const response = await fetch(`${base}/api/public/calendar/${TOKEN}.ics?lang=pt`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/calendar');
    expect(response.headers.get('cache-control')).toBe('private, max-age=900');
    expect(body).toContain('X-WR-CALNAME:Luma · Minhas obras');
    expect(accountForFeedToken).toHaveBeenCalledWith(TOKEN);

    const again = await fetch(`${base}/api/public/calendar/${TOKEN}.ics?lang=pt`, {
      headers: { 'If-None-Match': response.headers.get('etag') ?? '' },
    });
    expect(again.status).toBe(304);
  });

  it('un token que no existe (o de una cuenta dada de baja) es un 404, sin contar cuál', async () => {
    vi.mocked(accountForFeedToken).mockResolvedValue(null);
    const response = await fetch(`${base}/api/public/calendar/${TOKEN}.ics`);
    expect(response.status).toBe(404);
    expect(calendarEventsFor).not.toHaveBeenCalled();
  });
});

describe('/api/calendar/feed', () => {
  it('sin sesión es un 401', async () => {
    const response = await fetch(`${base}/api/calendar/feed`);
    expect(response.status).toBe(401);
  });

  it('generar guarda sólo el hash y devuelve la URL absoluta una vez', async () => {
    vi.mocked(User.updateOne).mockResolvedValue({ matchedCount: 1 } as never);
    const response = await fetch(`${base}/api/calendar/feed`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'es-AR' }),
    });
    const { data } = (await response.json()) as { data: { url: string } };

    expect(response.status).toBe(201);
    const match = data.url.match(/\/api\/public\/calendar\/([A-Za-z0-9_-]{43})\.ics\?lang=es-AR$/);
    expect(match).not.toBeNull();
    const [, token] = match!;
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'user-1' },
      { $set: { calendarFeedTokenHash: hashFeedToken(token!), calendarFeedCreatedAt: expect.any(Date) } },
    );
    expect(JSON.stringify(vi.mocked(User.updateOne).mock.calls)).not.toContain(token);
  });

  it('el estado dice si está prendido, sin la URL', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ calendarFeedTokenHash: 'h', calendarFeedCreatedAt: new Date(0) }),
    } as never);
    const response = await fetch(`${base}/api/calendar/feed`, { headers: auth });
    expect(await response.json()).toEqual({
      success: true,
      data: { enabled: true, createdAt: '1970-01-01T00:00:00.000Z' },
    });
  });

  it('apagar borra el hash', async () => {
    vi.mocked(User.updateOne).mockResolvedValue({ matchedCount: 1 } as never);
    const response = await fetch(`${base}/api/calendar/feed`, { method: 'DELETE', headers: auth });
    expect(response.status).toBe(200);
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'user-1' },
      { $unset: { calendarFeedTokenHash: '', calendarFeedCreatedAt: '' } },
    );
  });
});

import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Las claves de Maps y Drive no salen sin sesión: `/api/public/config` sólo
 * trae el client id del botón de Google, y `/api/config/integrations` pide
 * sesión. Sobre HTTP real, con los routers montados como en `index.ts`.
 */
vi.mock('../../config/app.config.js', async (original) => ({
  ...(await original<typeof import('../../config/app.config.js')>()),
  GOOGLE_CONFIG: {
    CLIENT_ID: 'client.apps.googleusercontent.com',
    PICKER_API_KEY: 'picker-key',
    PROJECT_NUMBER: '1234',
    MAPS_BROWSER_KEY: 'maps-key',
    LOGIN_ENABLED: true,
    DRIVE_ENABLED: true,
  },
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

const { publicRouter } = await import('../../routes/public.js');
const { configRouter } = await import('../../routes/config.js');

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/public', publicRouter);
  app.use('/api/config', configRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('configuración del entorno', () => {
  it('la pública no trae ninguna clave de API', async () => {
    const response = await fetch(`${base}/api/public/config`);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(text)).toEqual({
      success: true,
      data: { googleLogin: { clientId: 'client.apps.googleusercontent.com' } },
    });
    expect(text).not.toContain('maps-key');
    expect(text).not.toContain('picker-key');
  });

  it('las integraciones sin sesión son un 401', async () => {
    const response = await fetch(`${base}/api/config/integrations`);
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('maps-key');
  });

  it('con sesión llegan Maps y Drive, con caché privada', async () => {
    const response = await fetch(`${base}/api/config/integrations`, {
      headers: { Authorization: 'Bearer un-token' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, max-age=300');
    expect(((await response.json()) as { data: unknown }).data).toEqual({
      maps: { apiKey: 'maps-key' },
      drive: { clientId: 'client.apps.googleusercontent.com', apiKey: 'picker-key', appId: '1234' },
    });
  });
});

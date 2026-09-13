import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { ApiError, apiClient, isApiError, isPublicRoute } from './api-client';


describe('ApiError', () => {
  it('expone status y code del backend', () => {
    const err = new ApiError('Ese email ya está en uso.', 409, 'EMAIL_IN_USE');

    expect(err.status).toBe(409);
    expect(err.code).toBe('EMAIL_IN_USE');
    expect(err.message).toBe('Ese email ya está en uso.');
  });

  // El código existente hace `err instanceof Error ? err.message : ...` en
  // todos lados; si esto se rompe, se rompen todos los catch de la app.
  it('sigue siendo un Error para el código que ya existía', () => {
    const err = new ApiError('boom', 500);

    expect(err instanceof Error).toBe(true);
    expect(isApiError(err)).toBe(true);
    expect(err.name).toBe('ApiError');
  });

  it('isApiError distingue un Error común', () => {
    expect(isApiError(new Error('boom'))).toBe(false);
    expect(isApiError('boom')).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

  it('deja code y data opcionales', () => {
    const err = new ApiError('boom', 400);

    expect(err.code).toBeUndefined();
    expect(err.data).toBeUndefined();
  });

  it('transporta data para los errores que la traen', () => {
    const details = [{ field: 'email', message: 'requerido' }];
    const err = new ApiError('Datos inválidos', 400, 'VALIDATION_ERROR', { details });

    expect(err.data).toEqual({ details });
  });
});

describe('isPublicRoute', () => {
  it('reconoce el resto de las rutas públicas', () => {
    const publicas = [
      '/login',
      '/register',
      '/activate',
      '/forgot-password',
      '/reset-password',
      '/check-email',
      '/verify-email',
      '/confirm-email-change',
    ];

    for (const path of publicas) {
      expect(isPublicRoute(path), path).toBe(true);
    }
  });

  it('NO considera públicas las rutas autenticadas', () => {
    const privadas = [
      '/',
      '/admin',
      '/admin/settings/account',
    ];

    for (const path of privadas) {
      expect(isPublicRoute(path), path).toBe(false);
    }
  });
});

/**
 * La renovación de sesión.
 *
 * Estos tests cubren el bug de sesión: el access token dura 7
 * días y no se renovaba nunca, así que al vencer la app pateaba al usuario a /login
 * con un toast de error y una recarga del documento.
 */
describe('apiClient — renovación de sesión ante 401', () => {
  // Se captura acá y no en el módulo: MSW parchea `fetch` en su `listen()`, que
  // corre después de que este archivo se evalúa.
  // `globalThis.fetch` es de sólo lectura cuando MSW está escuchando: se
  // reemplaza con stubGlobal, que además se revierte solo.

  // happy-dom no expone localStorage en esta versión, y el cliente lo usa para
  // leer y escribir el access token.
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;

  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage,
      configurable: true,
    });
  });

  beforeEach(() => {
    window.localStorage.clear();
    apiClient.setUnauthorizedHandler(null);
    apiClient.setTokenRefreshedHandler(null);
    window.history.replaceState({}, '', '/admin');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Respuesta mínima con la forma que consume el cliente. */
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  it('renueva el token y reintenta la request original', async () => {
    window.localStorage.setItem('auth_token', 'vencido');
    const calls: string[] = [];
    let refreshed = false;

    vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
      const path = String(url);
      calls.push(`${init?.method ?? 'GET'} ${new URL(path).pathname}`);

      if (path.endsWith('/api/auth/refresh')) {
        refreshed = true;
        return json(200, { success: true, data: { accessToken: 'nuevo' } });
      }
      if (!refreshed) return json(401, { success: false, error: 'jwt expired' });

      expect(init.headers.Authorization).toBe('Bearer nuevo');
      return json(200, { success: true, data: { ok: true } });
    }));

    const result = await apiClient.get('/api/auth/me');

    expect(result).toEqual({ success: true, data: { ok: true } });
    expect(window.localStorage.getItem('auth_token')).toBe('nuevo');
    expect(calls).toEqual([
      'GET /api/auth/me',
      'POST /api/auth/refresh',
      'GET /api/auth/me',
    ]);
  });

  it('avisa del token nuevo para que el provider no quede desincronizado', async () => {
    window.localStorage.setItem('auth_token', 'vencido');
    const onRefreshed = vi.fn();
    apiClient.setTokenRefreshedHandler(onRefreshed);

    vi.stubGlobal('fetch', vi.fn(async (url: any) =>
      String(url).endsWith('/api/auth/refresh')
        ? json(200, { success: true, data: { accessToken: 'nuevo' } })
        : json(200, { success: true }),
    ));

    await apiClient.refreshSession();

    expect(onRefreshed).toHaveBeenCalledWith('nuevo');
  });

  // Single-flight: al volver a abrir la app fallan muchas queries a la vez.
  it('dispara un solo refresh aunque fallen varias requests en paralelo', async () => {
    window.localStorage.setItem('auth_token', 'vencido');
    let refreshCount = 0;
    let refreshed = false;

    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const path = String(url);
      if (path.endsWith('/api/auth/refresh')) {
        refreshCount += 1;
        await new Promise((r) => setTimeout(r, 10));
        refreshed = true;
        return json(200, { success: true, data: { accessToken: 'nuevo' } });
      }
      if (!refreshed) return json(401, { success: false, error: 'jwt expired' });
      return json(200, { success: true });
    }));

    await Promise.all([
      apiClient.get('/api/auth/me'),
      apiClient.get('/api/auth/me'),
      apiClient.get('/api/auth/me'),
    ]);

    expect(refreshCount).toBe(1);
  });

  it('cierra la sesión por el handler del provider, sin recargar el documento', async () => {
    window.localStorage.setItem('auth_token', 'vencido');
    window.localStorage.setItem('auth_user', '{"id":"1"}');
    const onUnauthorized = vi.fn();
    apiClient.setUnauthorizedHandler(onUnauthorized);

    vi.stubGlobal('fetch', vi.fn(async () =>
      json(401, { success: false, error: 'invalid token' }),
    ));

    await expect(apiClient.get('/api/auth/me')).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(window.localStorage.getItem('auth_user')).toBeNull();
    // El `location.href` de antes recargaba la pantalla entera.
    expect(window.location.pathname).toBe('/admin');
  });

  it('no intenta renovar en una ruta pública ni sin token', async () => {
    window.history.replaceState({}, '', '/login');
    const onUnauthorized = vi.fn();
    apiClient.setUnauthorizedHandler(onUnauthorized);

    const fetchMock = vi.fn(async () =>
      json(401, { success: false, error: 'Credenciales inválidas' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/api/auth/me')).rejects.toMatchObject({ status: 401 });

    // Sin token no hay nada que renovar: una sola llamada, sin /auth/refresh.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

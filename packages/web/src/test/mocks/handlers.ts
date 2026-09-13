import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:8080';

/** Sobre de la API: `{ success, data }`, igual que el backend real. */
const ok = (data: unknown) => HttpResponse.json({ success: true, data });

const adminUser = {
  id: 'user-1',
  email: 'admin@test.com',
  name: 'Admin de prueba',
  role: 'admin',
  email_verified: true,
  account_status: 'active',
};

export const authHandlers = [
  http.post(`${BASE}/api/auth/login`, () =>
    ok({ accessToken: 'mock-access-token', user: adminUser }),
  ),

  http.post(`${BASE}/api/auth/register`, () =>
    ok({ user: { ...adminUser, id: 'user-2', email: 'user@test.com', role: 'user' } }),
  ),

  http.post(`${BASE}/api/auth/refresh`, () =>
    ok({ accessToken: 'mock-access-token-2', user: adminUser }),
  ),

  http.get(`${BASE}/api/auth/me`, () => ok({ user: adminUser })),

  http.post(`${BASE}/api/auth/logout`, () => ok({ message: 'Sesión cerrada' })),
];

export const handlers = [...authHandlers];

import type { Page } from '@playwright/test';

/**
 * Credenciales de E2E. Los tests nunca escriben un usuario y una contraseña a
 * mano: pasan por acá, para que cambiar el entorno sea cambiar dos variables.
 */
const DEFAULTS: Record<string, string> = {
  E2E_ADMIN_EMAIL: 'e2e-admin@luma.test',
  E2E_ADMIN_PASSWORD: 'E2eAdmin1234!',
  E2E_USER_EMAIL: 'e2e-user@luma.test',
  E2E_USER_PASSWORD: 'E2eUser1234!',
};

function requireEnv(name: string): string {
  const value = process.env[name] ?? DEFAULTS[name];
  if (!value) throw new Error(`Falta la variable de E2E: ${name}`);
  return value;
}

/**
 * URL absoluta a partir de un path.
 *
 * `page.goto('/x')` con un baseURL que incluye subpath (`https://host/app`)
 * resuelve contra el ORIGEN y pierde el `/app`. Por eso se arma la URL entera.
 */
export function appUrl(path: string): string {
  const base = (process.env.E2E_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  return `${base}${path}`;
}

async function loginWith(page: Page, email: string, password: string) {
  await page.goto(appUrl('/login'));
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /entrar|ingresar|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

export async function loginAsAdmin(page: Page) {
  await loginWith(page, requireEnv('E2E_ADMIN_EMAIL'), requireEnv('E2E_ADMIN_PASSWORD'));
}

export async function loginAsUser(page: Page) {
  await loginWith(page, requireEnv('E2E_USER_EMAIL'), requireEnv('E2E_USER_PASSWORD'));
}

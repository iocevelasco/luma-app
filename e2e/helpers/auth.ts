import type { Page } from '@playwright/test';
import { e2eUser, type E2EUserKey } from './users';

/**
 * URL absoluta a partir de un path.
 *
 * `page.goto('/x')` con un baseURL que incluye subpath (`https://host/app`)
 * resuelve contra el ORIGEN y pierde el `/app`. Por eso se arma la URL entera.
 */
export function appUrl(path: string): string {
  const base = (process.env.E2E_BASE_URL ?? 'http://localhost:6173').replace(/\/$/, '');
  return `${base}${path}`;
}

/** Login genérico, para specs que registran su propia cuenta en vez de usar una fija. */
export async function loginWith(page: Page, email: string, password: string) {
  await page.goto(appUrl('/login'));
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /entrar|ingresar|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

/**
 * Entra con una de las cuentas fijas de E2E (ver `helpers/users.ts`). Para
 * arrancar un test ya logueado, `test.use({ storageState: authFile(key) })`
 * es más barato: la sesión la guardó el globalSetup.
 */
export async function loginAs(page: Page, key: E2EUserKey) {
  const { email, password } = e2eUser(key);
  await loginWith(page, email, password);
}

/**
 * Autoservicio: crea una cuenta nueva desde `/register`. Deja a la persona en
 * /check-email, o en /login si el backend corre con
 * `REQUIRE_EMAIL_VERIFICATION=false` (cuenta ya verificada, sin mail).
 */
export async function registerWith(page: Page, name: string, email: string, password: string) {
  await page.goto(appUrl('/register'));
  await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: /^crear cuenta$/i }).click();
  // Aceptar los Términos es parte del alta: el diálogo se abre al enviar.
  const terms = page.getByRole('dialog');
  await terms.getByRole('checkbox').check();
  await terms.getByRole('button', { name: /aceptar y crear cuenta/i }).click();
  await page.waitForURL((url) => /\/(check-email|login)$/.test(url.pathname), {
    timeout: 15_000,
  });
}

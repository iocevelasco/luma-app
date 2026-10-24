import { expect, test } from '@playwright/test';
import { requiresApi } from './helpers/api';
import { appUrl } from './helpers/auth';
import { authFile, e2eUser } from './helpers/users';

/**
 * Administración global de la plataforma: el área de cuentas, fuera del panel
 * de obras. La mira el admin y sólo el admin. Las cuentas fijas de E2E
 * (`@luma.test`) no cuentan en ninguna cifra ni aparecen en la lista, así que
 * el panel nunca las muestra.
 */

requiresApi();

const USERS_PATH = '/plataforma/cuentas';
const ENTRY = 'Administración de la plataforma';

test.describe('cuentas de la plataforma: admin', () => {
  test('ve los totales, la curva de altas de 12 semanas y no ve las cuentas de prueba', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(appUrl(USERS_PATH));

    // Las cinco cifras de arriba.
    await expect(page.locator('dl dt')).toHaveCount(5);
    await expect(page.locator('dl dd').first()).toHaveText(/^\d/);

    // La curva: siempre 12 semanas, con 0 donde no hubo altas.
    await expect(page.getByRole('list', { name: /altas por semana/i }).getByRole('listitem')).toHaveCount(12);

    // Buscar una cuenta de prueba no encuentra nada: están excluidas.
    const { email } = e2eUser('admin');
    await page.getByRole('searchbox').fill(email);
    await expect(page.getByText('No hay cuentas para mostrar.')).toBeVisible();
    await expect(page.getByText(email)).toHaveCount(0);

    // Un filtro cambia la lista sin romper la pantalla.
    await page.getByRole('searchbox').fill('');
    await page.getByRole('tab', { name: 'Sin confirmar' }).click();
    await expect(page.getByRole('tab', { name: 'Sin confirmar' })).toHaveAttribute(
      'data-state',
      'active',
    );

    expect(consoleErrors).toEqual([]);
  });

  test('entra desde el menú del usuario y está fuera del panel de obras', async ({ page }) => {
    await page.goto(appUrl('/admin'));
    await page.getByRole('button').filter({ has: page.locator('[data-slot="avatar"]') }).click();
    await page.getByRole('menuitem', { name: ENTRY }).click();

    await expect(page).toHaveURL(new RegExp(`${USERS_PATH}$`));
    // Su propio chrome: la salida es "Volver a la app", y no hay campana ni
    // menú de usuario del panel.
    await expect(page.getByRole('link', { name: 'Volver a la app' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Secciones de la plataforma' })).toBeVisible();
    await expect(page.locator('[data-slot="avatar"]')).toHaveCount(0);

    await page.getByRole('link', { name: 'Volver a la app' }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('el enlace viejo de pagos sigue llegando', async ({ page }) => {
    await page.goto(appUrl('/admin/plataforma/pagos'));
    await expect(page).toHaveURL(/\/plataforma\/pagos$/);
  });
});

test.describe('cuentas de la plataforma: usuario común', () => {
  test.use({ storageState: authFile('user') });

  test('no ve la entrada en su menú', async ({ page }) => {
    await page.goto(appUrl('/admin'));
    await page.getByRole('button').filter({ has: page.locator('[data-slot="avatar"]') }).click();
    await expect(page.getByRole('menuitem', { name: 'Mi cuenta' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: ENTRY })).toHaveCount(0);
  });

  test('no entra: la ruta lo saca del panel y la API le contesta 403', async ({ page, request }) => {
    await page.goto(appUrl(USERS_PATH));
    await expect(page).not.toHaveURL(new RegExp(`${USERS_PATH}$`));
    await expect(page.locator('dl dt')).toHaveCount(0);

    // La pantalla no es la barrera: la API también lo exige.
    const token = await page.evaluate(() => {
      for (const store of [window.localStorage, window.sessionStorage]) {
        for (let i = 0; i < store.length; i += 1) {
          const key = store.key(i);
          const value = key ? store.getItem(key) : null;
          if (value && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) return value;
        }
      }
      return null;
    });
    test.skip(!token, 'El access token no está en el storage de este entorno');

    const response = await request.get(appUrl('/api/admin/users/overview'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(403);
  });
});

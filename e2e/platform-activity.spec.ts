import { expect, test } from '@playwright/test';
import { requiresApi } from './helpers/api';
import { appUrl } from './helpers/auth';
import { authFile } from './helpers/users';

/**
 * Actividad por rol de obra, en el área de administración de la plataforma.
 * Son conteos agregados: las cuentas fijas de E2E (`@luma.test`) no cuentan,
 * así que con una base de pruebas los roles salen con "Pocos datos". Lo que se
 * cubre es la estructura, el selector de período y el acceso.
 */

requiresApi();

const ACTIVITY_PATH = '/plataforma/actividad';

test.describe('actividad por rol: admin', () => {
  test('ve la tabla por rol, el cliente como sólo lectura y cambia de período', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(appUrl(ACTIVITY_PATH));

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    for (const name of ['Gerente', 'Supervisor', 'Contador', 'Cliente', 'Ex-miembro']) {
      await expect(table.getByRole('rowheader', { name })).toBeVisible();
    }
    await expect(table.getByText(/Sólo lectura/)).toBeVisible();

    // Un rol sin gente suficiente no muestra cifras: dice "Pocos datos" o,
    // si hay datos reales en la base, un recuento de personas.
    await expect(
      table.getByText(/Pocos datos|\d+ personas?/).first(),
    ).toBeVisible();

    // Selector de período: 7 días / 30 días / desde siempre.
    await expect(page.getByRole('tab', { name: '30 días' })).toHaveAttribute('data-state', 'active');
    await page.getByRole('tab', { name: '7 días' }).click();
    await expect(page.getByRole('tab', { name: '7 días' })).toHaveAttribute('data-state', 'active');
    await page.getByRole('tab', { name: 'Desde siempre' }).click();
    await expect(page.getByRole('tab', { name: 'Desde siempre' })).toHaveAttribute(
      'data-state',
      'active',
    );

    expect(consoleErrors).toEqual([]);
  });

  test('la pestaña está en la navegación de la plataforma', async ({ page }) => {
    await page.goto(appUrl('/plataforma/cuentas'));
    await page
      .getByRole('navigation', { name: 'Secciones de la plataforma' })
      .getByRole('link', { name: 'Actividad' })
      .click();
    await expect(page).toHaveURL(new RegExp(`${ACTIVITY_PATH}$`));
  });
});

test.describe('actividad por rol: usuario común', () => {
  test.use({ storageState: authFile('user') });

  test('no entra: la ruta lo saca y la API le contesta 403', async ({ page, request }) => {
    await page.goto(appUrl(ACTIVITY_PATH));
    await expect(page).not.toHaveURL(new RegExp(`${ACTIVITY_PATH}$`));
    await expect(page.getByRole('table')).toHaveCount(0);

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

    const response = await request.get(appUrl('/api/admin/activity'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(403);
  });
});

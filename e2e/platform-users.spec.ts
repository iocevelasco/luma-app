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
  test('el censo separa las cuentas con membresía y no cuenta las de prueba', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(appUrl(USERS_PATH));

    // El censo es la vista de entrada: con membresía, clientes, empleados y pruebas.
    await expect(page.getByRole('tab', { name: 'Censo' })).toHaveAttribute('data-state', 'active');
    await expect(page.locator('dl dt')).toHaveCount(4);
    await expect(page.locator('dl dd').first()).toHaveText(/^\d/);
    await expect(page.getByText('Estado de la membresía')).toBeVisible();

    // La curva: siempre 12 semanas, con 0 donde no hubo altas.
    await expect(page.getByRole('list', { name: /altas por semana/i }).getByRole('listitem')).toHaveCount(12);

    expect(consoleErrors).toEqual([]);
  });

  test('el embudo y el seguimiento miran solo cuentas con membresía y no cuentan las de prueba', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(appUrl(USERS_PATH));

    // Embudo: las seis etapas y las seis cohortes semanales.
    await page.getByRole('tab', { name: 'Embudo' }).click();
    await expect(page.getByText('Dónde se caen las cuentas')).toBeVisible();
    await expect(page.getByRole('list').filter({ hasText: 'Primer gasto o cobro' }).getByRole('listitem')).toHaveCount(6);
    await expect(page.locator('table tbody tr')).toHaveCount(6);

    // Seguimiento: cambiar de filtro no rompe la pantalla.
    await page.getByRole('tab', { name: 'Seguimiento' }).click();
    await expect(page.getByRole('tab', { name: /Necesitan atención/ })).toBeVisible();
    await page.getByRole('tab', { name: /En prueba/ }).click();
    await expect(page.getByRole('tab', { name: /En prueba/ })).toHaveAttribute('data-state', 'active');

    // Una cuenta de prueba no aparece ni buscándola.
    const { email } = e2eUser('admin');
    await page.getByRole('searchbox').fill(email);
    await expect(page.getByText('No hay cuentas con membresía para mostrar.')).toBeVisible();
    await expect(page.getByText(email)).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });

  test('el directorio filtra por estado y por segmento, y no lista las cuentas de prueba', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(appUrl(USERS_PATH));
    await page.getByRole('tab', { name: 'Directorio' }).click();

    // Las cinco cifras de arriba y la curva de altas, como siempre.
    await expect(page.locator('dl dt')).toHaveCount(5);
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

    // El segmento también: la lista se acota a las cuentas de ese tipo.
    await page.getByRole('tab', { name: 'Todas' }).click();
    await page.getByRole('combobox', { name: 'Segmento' }).click();
    await page.getByRole('option', { name: 'Cliente' }).click();
    await expect(page.getByRole('combobox', { name: 'Segmento' })).toContainText('Cliente');

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

    for (const path of ['census', 'funnel', 'follow-up']) {
      const response403 = await request.get(appUrl(`/api/admin/users/${path}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response403.status(), path).toBe(403);
    }
  });
});

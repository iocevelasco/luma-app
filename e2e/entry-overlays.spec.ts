import { expect, test } from '@playwright/test';
import { requiresApi } from './helpers/api';
import { tick } from './helpers/checkbox';
import { authFile } from './helpers/users';

/**
 * Lo que se abre solo al entrar no puede taparse entre sí: los Términos bloquean,
 * y el recorrido de bienvenida espera a que se acepten.
 *
 * Ninguna cuenta fija tiene los Términos pendientes, así que se simula desde la
 * respuesta de la API. Y el recorrido se apaga bajo Playwright para no voltear al
 * resto de los specs: acá se lo vuelve a prender.
 */
test.describe('avisos al entrar', () => {
  requiresApi();
  test.use({ storageState: authFile('gerente') });

  test('el recorrido espera a que se acepten los Términos y arranca solo', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    let termsPending = true;
    let user: Record<string, unknown> = {};
    await page.route('**/api/auth/me', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data.user.terms_pending = termsPending;
      user = body.data.user;
      await route.fulfill({ response, json: body });
    });
    await page.route('**/api/auth/accept-terms', async (route) => {
      termsPending = false;
      await route.fulfill({
        json: { success: true, data: { user: { ...user, terms_pending: false } } },
      });
    });

    await page.goto('/admin');

    const terms = page.getByRole('alertdialog');
    const tour = page.getByTestId('onboarding-tour');
    await expect(terms).toBeVisible();
    await expect(tour).toHaveCount(0);

    await tick(terms.getByRole('checkbox')).click();
    await terms.getByRole('button').last().click();

    await expect(terms).toHaveCount(0);
    await expect(tour).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { requiresApi } from './helpers/api';
import { authFile } from './helpers/users';

/**
 * El admin cambia los precios desde la pantalla. El POST se intercepta: el
 * catálogo es global y una versión publicada no se puede borrar, así que de
 * verdad cambiaría lo que cobra el resto de la suite.
 */
test.describe('catálogo de planes', () => {
  requiresApi();
  test.use({ storageState: authFile('admin') });

  test('publicar pide confirmación y manda la versión que se estaba editando', async ({ page }) => {
    let published: { config: { basePriceUsd: number }; expectedVersion: number } | null = null;
    await page.route('**/api/admin/plan-config', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      published = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { success: true, data: { version: { version: 99 } } },
      });
    });

    await page.goto('/plataforma/planes');

    const base = page.locator('#plan-base');
    await expect(base).not.toHaveValue('');
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeDisabled();

    await base.fill('45');
    await submit.click();

    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    expect(published).toBeNull();

    await confirm.getByRole('button').last().click();

    await expect.poll(() => published?.config.basePriceUsd).toBe(45);
    expect(typeof published!.expectedVersion).toBe('number');
  });

  test('una lista inválida no llega a confirmarse', async ({ page }) => {
    await page.goto('/plataforma/planes');

    const base = page.locator('#plan-base');
    await expect(base).not.toHaveValue('');
    await base.fill('');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(base).toHaveValue('');
  });
});

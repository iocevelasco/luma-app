import { expect, test } from '@playwright/test';
import { appUrl } from './helpers/auth';

test.describe('rutas sin sesión', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('el panel manda a login y recuerda adónde iba', async ({ page }) => {
    await page.goto(appUrl('/admin'));

    await expect(page).toHaveURL(/\/login/);
    // El returnTo es lo que permite volver al destino original después de entrar.
    expect(new URL(page.url()).searchParams.get('returnTo')).toContain('/admin');
  });

  test('una ruta inexistente muestra el 404, no una pantalla en blanco', async ({ page }) => {
    await page.goto(appUrl('/esta-ruta-no-existe'));
    await expect(page.getByText('404')).toBeVisible();
  });

  test('las pantallas públicas cargan sin errores de consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    for (const path of ['/login', '/register', '/forgot-password', '/check-email']) {
      await page.goto(appUrl(path));
      await page.waitForLoadState('networkidle');
    }

    expect(errors).toEqual([]);
  });
});

import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('contraseña en login y registro', () => {
  test('el ojo alterna la visibilidad sin enviar el formulario', async ({ page }) => {
    await page.goto('/login');
    const input = page.locator('#password');
    await input.fill('Secreta1234!');
    await expect(input).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(input).toHaveAttribute('type', 'text');
    await expect(page).toHaveURL(/\/login/);

    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('el registro no envía nada si las contraseñas no coinciden', async ({ page }) => {
    let registerRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/register')) registerRequests += 1;
    });

    await page.goto('/register');
    await page.locator('#name').fill('Persona E2E');
    await page.locator('#email').fill('mismatch@luma.test');
    await page.locator('#password').fill('Secreta1234!');
    await page.locator('#confirmPassword').fill('Otra12345678!');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
    expect(registerRequests).toBe(0);
  });
});

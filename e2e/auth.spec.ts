import { expect, test } from '@playwright/test';
import { appUrl } from './helpers/auth';

/**
 * Estos tests corren sin sesión: `storageState` se limpia por archivo. Sin eso,
 * el estado que siembra el globalSetup haría que /login redirija al panel y
 * todas las aserciones de acá fallaran por la razón equivocada.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('login', () => {
  test('muestra el formulario', async ({ page }) => {
    await page.goto(appUrl('/login'));

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('no deja entrar con credenciales inválidas', async ({ page }) => {
    await page.goto(appUrl('/login'));
    await page.locator('#email').fill('no-existe@luma.test');
    await page.locator('#password').fill('contraseña-incorrecta');
    await page.getByRole('button', { name: /entrar/i }).click();

    // Sigue en /login: el error se muestra, la sesión no se abre.
    await expect(page).toHaveURL(/\/login/);
  });

  test('llega a recuperar contraseña desde el login', async ({ page }) => {
    await page.goto(appUrl('/login'));
    await page.getByRole('link', { name: /olvidaste/i }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('llega al registro desde el login', async ({ page }) => {
    await page.goto(appUrl('/login'));
    await page.getByRole('link', { name: /creá una/i }).click();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('#name')).toBeVisible();
  });
});

test.describe('reset de contraseña', () => {
  test('avisa cuando el enlace no trae token', async ({ page }) => {
    await page.goto(appUrl('/reset-password'));
    await expect(page.getByText(/inválido o venció/i)).toBeVisible();
  });

  test('con token muestra el formulario', async ({ page }) => {
    await page.goto(appUrl('/reset-password?token=un-token-cualquiera'));
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm')).toBeVisible();
  });
});

test.describe('términos y privacidad', () => {
  test('el registro pide aceptar los Términos antes de crear la cuenta', async ({ page }) => {
    await page.goto(appUrl('/register'));
    await page.locator('#name').fill('Persona de Prueba');
    await page.locator('#email').fill('terminos@luma.test');
    await page.locator('#password').fill('Clave-de-prueba-123');
    await page.locator('#confirmPassword').fill('Clave-de-prueba-123');
    await page.getByRole('button', { name: /^crear cuenta$/i }).click();

    const dialog = page.getByRole('dialog');
    const confirm = dialog.getByRole('button', { name: /aceptar y crear cuenta/i });
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await expect(confirm).toBeDisabled();

    await dialog.getByRole('checkbox').check();
    await expect(confirm).toBeEnabled();
  });

  test('el texto legal se lee sin tener cuenta', async ({ page }) => {
    await page.goto(appUrl('/legal'));

    await expect(page).toHaveURL(/\/legal$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/no vendemos ni alquilamos/i).first()).toBeVisible();
  });
});

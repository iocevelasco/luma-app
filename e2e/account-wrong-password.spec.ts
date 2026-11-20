import { expect, test, type Locator, type Page } from '@playwright/test';
import { requiresApi } from './helpers/api';
import { appUrl } from './helpers/auth';
import { authFile, e2eUser } from './helpers/users';

/**
 * Mi cuenta: escribir mal la contraseña actual es un error del formulario, no
 * una sesión vencida.
 *
 * El bug que esto fija: la API contestaba 401, y el cliente lee todo 401 con
 * token como sesión vencida — renovaba, reintentaba y, con el segundo 401,
 * cerraba la sesión y mandaba a /login sin decir por qué.
 *
 * No cambia nada de la cuenta fija: con la contraseña equivocada la API corta
 * antes de guardar. Que la contraseña y el correo se cambien de verdad con la
 * correcta lo cubren los unit de la API (`auth.wrong-password.spec.ts`).
 */
const ACCOUNT = 'user';
const ACCOUNT_URL = /\/admin\/settings\/account$/;

test.use({ storageState: authFile(ACCOUNT) });

requiresApi();

/**
 * Nunca coincide con la real, sea cual sea: es la real con otra cosa adelante
 * (adelante y no atrás: bcrypt sólo mira los primeros 72 bytes).
 */
function wrongPassword(): string {
  return `no-es-${e2eUser(ACCOUNT).password}`;
}

async function openAccount(page: Page) {
  await page.goto(appUrl('/admin/settings/account'));
  await expect(page.locator('#current-password')).toBeVisible();
}

/** El formulario de una de las tarjetas, por uno de sus campos. */
function formWith(page: Page, fieldId: string): Locator {
  return page.locator('form').filter({ has: page.locator(fieldId) });
}

/** Sigue en Mi cuenta y, al recargar, la app no la manda a /login. */
async function expectSessionStillOpen(page: Page) {
  await expect(page).toHaveURL(ACCOUNT_URL);
  await page.reload();
  await expect(page.locator('#current-email')).toHaveValue(e2eUser(ACCOUNT).email);
  await expect(page).toHaveURL(ACCOUNT_URL);
}

test.describe('Mi cuenta — contraseña actual incorrecta', () => {
  test('al cambiar la contraseña, el error se ve en ese formulario y la sesión sigue abierta', async ({
    page,
  }) => {
    await openAccount(page);
    const passwordForm = formWith(page, '#current-password');

    await passwordForm.locator('#current-password').fill(wrongPassword());
    await passwordForm.locator('#new-password').fill('Nunca-se-guarda-123');
    await passwordForm.getByRole('button', { name: /guardar/i }).click();

    await expect(passwordForm.getByRole('alert')).toContainText(
      /la contraseña actual no es correcta/i,
    );
    // El aviso es de este formulario: el de "Cambiar correo" no muestra nada.
    await expect(formWith(page, '#new-email').getByRole('alert')).toHaveCount(0);
    await expectSessionStillOpen(page);
  });

  test('al cambiar el correo, el error se ve en ese formulario y la sesión sigue abierta', async ({
    page,
  }) => {
    await openAccount(page);
    const emailForm = formWith(page, '#new-email');

    await emailForm.locator('#new-email').fill('nunca-se-usa@luma.test');
    await emailForm.locator('#email-password').fill(wrongPassword());
    await emailForm.getByRole('button', { name: /guardar/i }).click();

    await expect(emailForm.getByRole('alert')).toContainText(
      /la contraseña actual no es correcta/i,
    );
    await expect(formWith(page, '#current-password').getByRole('alert')).toHaveCount(0);
    await expectSessionStillOpen(page);
  });
});

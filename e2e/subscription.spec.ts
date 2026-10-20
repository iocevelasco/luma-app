import { expect, test, type Page } from '@playwright/test';
import { appUrl, loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';

/**
 * La suscripción, desde la pantalla. Lo que fija este spec es lo que una
 * persona ve el primer día, que es lo que más se rompe sin que nadie note:
 *
 * - quien se registra arranca su mes gratis, sin tarjeta;
 * - en la prueba, la cuarta obra no entra al alta: abre el pase al plan, con
 *   el monto (base + la cuarta) y la advertencia de que se pierden los días.
 *
 * No paga: el cobro con tarjeta vive en Stripe y el de bolívares necesita
 * cuentas configuradas y un admin. Eso lo cubren los tests de la API.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';

async function createProject(page: Page, name: string) {
  await page.goto(appUrl('/admin/proyectos/nuevo'));
  await page.locator('#name').fill(name);
  await page.locator('#description').fill('Obra para probar la suscripción.');
  await page.locator('#location').fill('Caracas');
  await page.locator('#estimatedStartDate').fill('2026-11-01');
  await page.locator('#estimatedEndDate').fill('2026-12-15');
  await page.locator('#currency').click();
  await page.getByRole('option', { name: 'USD' }).click();
  await page.getByRole('button', { name: /crear obra/i }).click();
  await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
}

requiresApi();

test.describe('suscripción', () => {
  test('el registro arranca el mes gratis y la cuarta obra pide activar el plan', async ({
    page,
  }) => {
    const email = `e2e-sub-${RUN_ID}@luma.test`;
    await registerWith(page, `Suscripción E2E ${RUN_ID}`, email, PASSWORD);
    await loginWith(page, email, PASSWORD);

    // Mes gratis, desde el menú de usuario.
    await page.goto(appUrl('/admin'));
    await page.getByRole('button').filter({ has: page.locator('[data-slot="avatar"]') }).click();
    await page.getByTestId('user-menu-subscription').click();
    await expect(page).toHaveURL(/\/admin\/settings\/subscription$/);
    await expect(page.getByText('Mes gratis')).toBeVisible();
    await expect(page.getByText(/Te quedan 30 días de prueba gratis/)).toBeVisible();

    for (const n of [1, 2, 3]) await createProject(page, `Obra ${n} suscripción ${RUN_ID}`);

    // La cuarta no entra al alta: abre el pase al plan.
    await page.goto(appUrl('/admin'));
    await page.getByRole('button', { name: /nueva obra/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Activá el plan para crear tu cuarta obra')).toBeVisible();
    await expect(dialog.getByText('Hoy pagás 47 USD por el primer mes.')).toBeVisible();
    await expect(dialog.getByText(/se pierden/)).toBeVisible();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

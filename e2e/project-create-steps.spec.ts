import { expect, test } from '@playwright/test';
import { requiresApi } from './helpers/api';
import { appUrl, loginWith, registerWith } from './helpers/auth';

/**
 * El alta de obra guiada: tres pasos que validan antes de avanzar, y al final una pantalla
 * con las formas de seguir. El redirect del listado vacío al alta no se prueba acá:
 * Playwright no rebota (ver `AdminHomePage`), así que se entra directo al formulario.
 */

requiresApi();

const RUN_ID = Date.now().toString(36);
const EMAIL = `e2e-pasos-${RUN_ID}@luma.test`;
const PASSWORD = 'Pasos1234!';

test.describe('alta de obra guiada', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('recorre los tres pasos, valida cada uno y ofrece cómo seguir', async ({ page }) => {
    await registerWith(page, 'Pasos E2E', EMAIL, PASSWORD);
    await loginWith(page, EMAIL, PASSWORD);
    await page.goto(appUrl('/admin/proyectos/nuevo'));

    // Paso 1: sin nombre no avanza, y el error aparece junto al campo.
    await page.getByRole('button', { name: /siguiente/i }).click();
    await expect(page.locator('#name')).toHaveAttribute('aria-invalid', 'true');
    await page.locator('#name').fill(`Obra pasos ${RUN_ID}`);
    await page.locator('#location').fill('CABA');
    await page.getByRole('button', { name: /siguiente/i }).click();

    // Paso 2: el inicio viene con hoy; la entrega no se inventa.
    await expect(page.locator('#estimatedStartDate')).not.toHaveValue('');
    await expect(page.locator('#estimatedEndDate')).toHaveValue('');
    await page.getByRole('button', { name: /siguiente/i }).click();
    await expect(page.locator('#estimatedEndDate')).toHaveAttribute('aria-invalid', 'true');
    await page.locator('#estimatedEndDate').fill('2030-12-31');

    // Una entrega anterior al inicio no deja avanzar: el error está en el paso de plazos.
    await page.locator('#estimatedEndDate').fill('2020-01-01');
    await page.getByRole('button', { name: /siguiente/i }).click();
    await expect(page.locator('#estimatedEndDate')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/no puede ser anterior al inicio/i)).toBeVisible();
    await page.locator('#estimatedEndDate').fill('2030-12-31');

    // Atrás conserva lo escrito.
    await page.getByRole('button', { name: /^atrás$/i }).click();
    await expect(page.locator('#name')).toHaveValue(`Obra pasos ${RUN_ID}`);
    await page.getByRole('button', { name: /siguiente/i }).click();
    await page.getByRole('button', { name: /siguiente/i }).click();

    // Paso 3: la lista de monedas incluye VES.
    await page.locator('#currency').click();
    await expect(page.getByRole('option', { name: 'VES' })).toBeVisible();
    await page.getByRole('option', { name: 'USD' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();

    // Pantalla final: la primera actividad es la principal y lleva a Actividades.
    await expect(page.getByTestId('project-created')).toBeVisible();
    for (const key of ['activities', 'materials', 'budget', 'team', 'detail']) {
      await expect(page.getByTestId(`next-step-${key}`)).toBeVisible();
    }
    // La pantalla final sobrevive a una recarga: no vuelve a un formulario vacío.
    await page.reload();
    await expect(page.getByTestId('project-created')).toBeVisible();
    await page.getByTestId('next-step-activities').click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+\/actividades/);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';

/**
 * Inventario de obra: el material que llega entra solo al patio, se entrega a
 * alguien, y el kardex guarda quién se lo llevó. Arma su propia cuenta y su
 * propia obra: registra movimientos, que no se borran.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_EMAIL = `e2e-inventory-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra inventario ${RUN_ID}`;
const MATERIAL = `Cemento ${RUN_ID}`;

requiresApi();

/** Un paso del flujo de Compras: botón de la fila y confirmación. */
async function advance(page: Page, button: RegExp) {
  await page.getByRole('button', { name: button }).first().click();
  await page.getByRole('button', { name: /continuar/i }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
}

test.describe('inventario de obra', () => {
  test('lo comprado entra al patio, se entrega y queda en el kardex', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await registerWith(page, `Ejecutante inventario ${RUN_ID}`, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);

    await page.getByRole('link', { name: /nueva obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para el inventario.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    // Sin nada en obra, el inventario está vacío.
    await page.getByRole('link', { name: /^inventario$/i }).click();
    await expect(page).toHaveURL(/\/inventario$/);
    await expect(page.getByText(/(aún|todavía) no hay material en el patio/i)).toBeVisible();

    // Compras: el material llega a obra.
    await page.getByRole('link', { name: /^compras$/i }).click();
    await page.getByRole('button', { name: /(añadir|agregar) material/i }).click();
    await page.locator('#material-name').fill(MATERIAL);
    await page.locator('#material-quantity').fill('10');
    await page.locator('#material-unit').click();
    await page.getByRole('option', { name: /bolsa/i }).click();
    await page.getByRole('button', { name: /^(añadir|agregar)$/i }).click();
    await expect(page.getByText(MATERIAL)).toBeVisible();
    await advance(page, /marcar solicitado/i);
    await advance(page, /marcar comprado/i);
    await page.getByRole('tab', { name: /comprados/i }).click();
    await advance(page, /llegó a obra/i);

    // Inventario: entró solo, con las 10 bolsas.
    await page.getByRole('link', { name: /^inventario$/i }).click();
    const row = page.getByRole('listitem').filter({ hasText: MATERIAL });
    await expect(row).toContainText('10');
    await expect(row).toContainText(/en stock/i);

    // Entregar 4 a un maestro.
    await row.getByRole('button', { name: /^entregar$/i }).click();
    await page.locator('#movement-quantity').fill('4');
    await page.locator('#movement-receiver').fill('Maestro Pedro');
    await page.getByRole('button', { name: /^registrar$/i }).click();
    await expect(row).toContainText('6');

    // No se puede entregar más de lo que hay: el banner lo dice y no se guarda.
    await row.getByRole('button', { name: /^entregar$/i }).click();
    await page.locator('#movement-quantity').fill('7');
    await page.locator('#movement-receiver').fill('Maestro Pedro');
    await page.getByRole('button', { name: /^registrar$/i }).click();
    await expect(page.getByText(/solo quedan 6/i)).toBeVisible();
    await page.getByRole('button', { name: /cancelar/i }).click();
    await expect(row).toContainText('6');

    // El kardex guarda la compra y la entrega, con quién se la llevó.
    await page.getByRole('tab', { name: /kardex/i }).click();
    const lines = page.getByRole('listitem').filter({ hasText: MATERIAL });
    await expect(lines).toHaveCount(2);
    await expect(lines.filter({ hasText: /entrega/i })).toContainText('Maestro Pedro');
    await expect(lines.filter({ hasText: /compra/i })).toContainText('+10');

    // Una pantalla nueva no está terminada si tira errores en la consola.
    expect(consoleErrors).toEqual([]);
  });
});

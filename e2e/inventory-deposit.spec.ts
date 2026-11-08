import { expect, test, type Page } from '@playwright/test';
import { createProjectViaForm } from './helpers/projects';
import { appUrl, loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';

/**
 * Depósito General: lo que sobra en una obra viaja a la Empresa y de ahí a otra
 * obra, a costo $0, con el ahorro a la vista. Arma su propia cuenta y sus
 * propias obras: los traspasos no se borran.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_EMAIL = `e2e-deposit-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const SOURCE = `Obra origen ${RUN_ID}`;
const TARGET = `Obra destino ${RUN_ID}`;
const MATERIAL = `Cemento ${RUN_ID}`;

requiresApi();

async function createProject(page: Page, name: string) {
  await page.goto(appUrl('/admin'));
  await createProjectViaForm(page, {
    name: name,
    location: 'CABA',
    start: '2026-09-01',
    end: '2026-12-15',
    currency: 'ARS',
  });
  await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
}

async function advance(page: Page, button: RegExp) {
  await page.getByRole('button', { name: button }).first().click();
  await page.getByRole('button', { name: /continuar/i }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
}

test.describe('depósito general', () => {
  test('manda a la Empresa, importa a otra obra a costo 0 y muestra el ahorro', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await registerWith(page, `Ejecutante depósito ${RUN_ID}`, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);

    // --- Obra de origen: 10 bolsas llegan al patio.
    await createProject(page, SOURCE);
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

    // --- Mandar 4 al Depósito, con un costo de referencia de 9.
    await page.getByRole('link', { name: /^inventario$/i }).click();
    const row = page.getByRole('listitem').filter({ hasText: MATERIAL });
    await expect(row).toContainText('10');
    await row.getByRole('button', { name: /más acciones/i }).click();
    await page.getByRole('menuitem', { name: /enviar al depósito/i }).click();
    await page.locator('#deposit-quantity').fill('4');
    await page.locator('#deposit-unit-cost').fill('9');
    await page.getByRole('button', { name: /^enviar$/i }).click();
    await expect(row).toContainText('6');
    await expect(row).toContainText(/enviado al depósito 4/i);

    // --- El Depósito de la Empresa lo muestra.
    // Dentro de una obra el menú es el de la obra: el Depósito está en el de la Empresa.
    await page.goto(appUrl('/admin'));
    await page.getByRole('link', { name: /^depósito$/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/deposito$/);
    const deposit = page.getByRole('listitem').filter({ hasText: MATERIAL });
    await expect(deposit).toContainText('4');
    await expect(deposit).toContainText(/costo de ref/i);

    // --- Otra obra lo importa: costo 0, y el flete es un gasto suyo.
    await createProject(page, TARGET);
    await page.getByRole('link', { name: /^inventario$/i }).click();
    await expect(page.getByText(/(aún|todavía) no hay material en el patio/i)).toBeVisible();
    await page.getByRole('button', { name: /importar del depósito/i }).click();
    await page.getByLabel(new RegExp(`cantidad de ${MATERIAL} a importar`, 'i')).fill('3');
    // Con coma decimal, como se escribe en es-ES, es-AR y pt.
    await page.locator('#freight-amount').fill('50,5');
    await page.getByRole('button', { name: /^importar$/i }).click();
    const imported = page.getByRole('listitem').filter({ hasText: MATERIAL });
    await expect(imported).toContainText('3');

    // El kardex de la obra destino lo registra como una importación.
    await page.getByRole('tab', { name: /kardex/i }).click();
    await expect(page.getByRole('listitem').filter({ hasText: /del depósito/i })).toContainText('+3');

    // El flete aparece como gasto de esta obra.
    await page.getByRole('link', { name: /^gastos$/i }).click();
    await expect(page.getByText(/flete de traslado/i)).toBeVisible();

    // --- El Depósito quedó con 1 y el ahorro es 3 × 9 = 27, en la obra destino.
    await page.goto(appUrl('/admin/deposito'));
    await expect(page.getByRole('listitem').filter({ hasText: MATERIAL })).toContainText('1');
    const savings = page.getByRole('listitem').filter({ hasText: TARGET });
    await expect(savings).toContainText('27');

    // Una pantalla nueva no está terminada si tira errores en la consola.
    expect(pageErrors).toEqual([]);
  });
});

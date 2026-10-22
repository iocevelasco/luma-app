import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';

/**
 * Cargar la factura de una compra desde Compras. Es un gasto: después se ve
 * en Finanzas, una sola vez.
 *
 * Arma su propia cuenta y su propia obra: mueve estados y crea gastos, y la
 * obra compartida de las cuentas fijas es para mirar.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_EMAIL = `e2e-materials-invoice-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const BRICK = `Ladrillo ${RUN_ID}`;
const SAND = `Arena ${RUN_ID}`;
const DESCRIPTION = `Factura corralón ${RUN_ID}`;

// Un PDF mínimo: el contenido no importa, el tipo sí.
const PDF = { name: 'factura.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') };

requiresApi();

test.describe('facturas de materiales', () => {
  test('carga la factura de lo solicitado, lo marca comprado y aparece en Gastos', async ({ page }) => {
    await registerWith(page, `Ejecutante factura ${RUN_ID}`, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);

    await page.getByRole('link', { name: /nueva obra/i }).click();
    await page.locator('#name').fill(`Obra factura ${RUN_ID}`);
    await page.locator('#description').fill('Obra para cargar facturas.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    await page.getByRole('link', { name: /^compras$/i }).click();
    for (const name of [BRICK, SAND]) {
      await page.getByRole('button', { name: /agregar material/i }).click();
      await page.locator('#material-name').fill(name);
      await page.locator('#material-quantity').fill('10');
      await page.locator('#material-unit').click();
      await page.getByRole('option', { name: /unidad/i }).click();
      await page.getByRole('button', { name: /^agregar$/i }).click();
      await expect(page.getByText(name)).toBeVisible();
    }

    const toBuy = page.getByRole('tabpanel', { name: /por comprar/i });
    const toolbar = page.getByRole('toolbar', { name: /materiales seleccionados/i });

    // Lo Pendiente no se compró: no se ofrece cargarle factura.
    await toBuy.getByRole('checkbox', { name: 'Seleccionar todos', exact: true }).click();
    await toolbar.getByRole('button', { name: /más acciones para la selección/i }).click();
    await expect(page.getByRole('menuitem', { name: /cargar factura/i })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Se piden los dos…
    await toolbar.getByRole('button', { name: /marcar solicitado/i }).click();
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(toolbar).toHaveCount(0);

    // …y llega la factura.
    await toBuy.getByRole('checkbox', { name: 'Seleccionar todos', exact: true }).click();
    await toolbar.getByRole('button', { name: /más acciones para la selección/i }).click();
    await page.getByRole('menuitem', { name: /cargar factura/i }).click();

    const dialog = page.getByRole('dialog', { name: /factura de 2 materiales/i });
    await dialog.locator('#invoice-file').setInputFiles(PDF);
    await expect(dialog.getByText('factura.pdf')).toBeVisible();
    await dialog.locator('#invoice-amount').fill('15000');
    await dialog.locator('#invoice-description').fill(DESCRIPTION);
    // Los dos están Solicitados: la factura ofrece pasarlos a Comprado.
    await expect(dialog.getByText(/2 están solicitados/i)).toBeVisible();

    const upload = page.waitForResponse(
      (response) => response.url().includes('/materials/invoices') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: /guardar factura/i }).click();
    const response = await upload;
    // Sin media-service la subida devuelve 503 y la app lo dice en el banner;
    // lo que este test fija (la factura en la fila y en Gastos) no se ve ahí.
    test.skip(response.status() === 503, 'El storage no está configurado en este entorno');
    expect(response.status()).toBe(201);
    await expect(dialog).toBeHidden();

    // Pasaron a Comprados, con su factura a la vista.
    await page.getByRole('tab', { name: /comprados/i }).click();
    const bought = page.getByRole('tabpanel', { name: /comprados/i });
    await expect(bought.getByRole('button', { name: `Factura de ${BRICK}` })).toBeVisible();
    await expect(bought.getByRole('button', { name: `Factura de ${SAND}` })).toBeVisible();

    // Es un gasto: aparece una sola vez en Gastos.
    await page.getByRole('link', { name: /^gastos$/i }).click();
    await expect(page.getByText(DESCRIPTION)).toHaveCount(1);

    // Desde Finanzas se ve qué paga, y cada material lleva a Compras.
    const row = page.getByRole('listitem').filter({ hasText: DESCRIPTION });
    await row.getByRole('button', { name: /^2 materiales$/i }).click();
    await page.getByRole('link', { name: SAND }).click();
    await expect(page).toHaveURL(/\/materiales\?material=[a-f0-9]+$/);
    await expect(page.getByRole('tabpanel', { name: /comprados/i }).getByText(SAND)).toBeVisible();
  });
});

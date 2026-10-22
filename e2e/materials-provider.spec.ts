import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';

/**
 * Proveedor vinculado: el proveedor se carga una vez en Proveedores y después
 * se elige al pedir un material, en vez de escribirlo a mano. Desde
 * Proveedores se ve qué materiales tiene cada uno.
 *
 * Arma su propia cuenta y su propia obra: crea proveedores y materiales, y la
 * obra compartida de las cuentas fijas es para mirar.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_EMAIL = `e2e-materials-provider-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra proveedor ${RUN_ID}`;
const PROVIDER = `Maderera ${RUN_ID}`;
const BOARD = `Tabla pino ${RUN_ID}`;
const OLD = `Listón ${RUN_ID}`;
const NAILS = `Clavos ${RUN_ID}`;
const HARDWARE = `Ferretería ${RUN_ID}`;

requiresApi();

test.describe('proveedor vinculado en Compras', () => {
  test('elige el proveedor del directorio, vincula uno escrito a mano y lo ve desde Proveedores', async ({
    page,
  }) => {
    await registerWith(page, `Ejecutante proveedor ${RUN_ID}`, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);

    await page.getByRole('link', { name: /nueva obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para vincular proveedores.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    // --- Un material viejo, con el proveedor escrito a mano antes de cargarlo.
    await page.getByRole('link', { name: /^compras$/i }).click();
    await page.getByRole('button', { name: /agregar material/i }).click();
    await page.locator('#material-name').fill(OLD);
    await page.locator('#material-quantity').fill('4');
    await page.locator('#material-unit').click();
    await page.getByRole('option', { name: /unidad/i }).click();
    await page.locator('#material-supplier').click();
    await page.getByPlaceholder(/buscar proveedor/i).fill(PROVIDER.toLowerCase());
    await page.getByRole('option', { name: /sin vincular/i }).click();
    await page.getByRole('button', { name: /^agregar$/i }).click();
    await expect(page.getByText(OLD)).toBeVisible();

    // --- Se carga el proveedor, de los que venden materiales.
    await page.getByRole('link', { name: /^proveedores$/i }).click();
    await page.getByRole('button', { name: /nuevo proveedor/i }).click();
    await page.locator('#provider-name').fill(PROVIDER);
    await page.locator('#provider-specialty').click();
    await page.getByRole('option', { name: /^venta de materiales$/i }).click();
    await page.locator('#provider-phone').fill('11-3333-3333');
    await page.getByRole('button', { name: /crear proveedor/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // --- Material nuevo: el proveedor se elige de la lista.
    await page.getByRole('link', { name: /^compras$/i }).click();
    await page.getByRole('button', { name: /agregar material/i }).click();
    await page.locator('#material-name').fill(BOARD);
    await page.locator('#material-quantity').fill('10');
    await page.locator('#material-unit').click();
    await page.getByRole('option', { name: /unidad/i }).click();
    await page.locator('#material-supplier').click();
    await page.getByPlaceholder(/buscar proveedor/i).fill('Maderera');
    await page.getByRole('option', { name: new RegExp(PROVIDER) }).click();
    await expect(page.locator('#material-supplier')).toContainText(PROVIDER);
    await page.getByRole('button', { name: /^agregar$/i }).click();

    const toBuy = page.getByRole('tabpanel', { name: /por comprar/i });
    await expect(toBuy.getByRole('listitem').filter({ hasText: BOARD })).toContainText(PROVIDER);

    // --- Un proveedor que no está cargado se da de alta sin salir de Compras.
    await page.getByRole('button', { name: /agregar material/i }).click();
    await page.locator('#material-name').fill(NAILS);
    await page.locator('#material-quantity').fill('2');
    await page.locator('#material-unit').click();
    await page.getByRole('option', { name: /kilogramo/i }).click();
    await page.locator('#material-supplier').click();
    await page.getByPlaceholder(/buscar proveedor/i).fill(HARDWARE);
    await page.getByRole('option', { name: /^agregar proveedor$/i }).click();
    await expect(page.locator('#quick-provider-name')).toHaveValue(HARDWARE);
    await page.locator('#quick-provider-specialty').click();
    await page.getByRole('option', { name: /^venta de materiales$/i }).click();
    await page.locator('#quick-provider-phone').fill('11-4444-4444');
    await page.getByRole('button', { name: /crear proveedor/i }).click();
    await expect(page.locator('#material-supplier')).toContainText(HARDWARE);
    await page.getByRole('button', { name: /^agregar$/i }).click();
    await expect(toBuy.getByRole('listitem').filter({ hasText: NAILS })).toContainText(HARDWARE);

    // --- El escrito a mano con el mismo nombre ofrece vincularse, aun ya solicitado.
    const oldRow = toBuy.getByRole('listitem').filter({ hasText: OLD });
    await oldRow.getByRole('button', { name: /marcar solicitado/i }).click();
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await oldRow.getByRole('button', { name: `Vincular a ${PROVIDER} de Proveedores` }).click();
    await expect(oldRow.getByRole('button', { name: /^vincular/i })).toHaveCount(0);
    await expect(oldRow).toContainText(PROVIDER);

    // --- Desde Proveedores: los dos materiales, ya vinculados.
    await page.getByRole('link', { name: /^proveedores$/i }).click();
    await page.getByRole('button', { name: `Materiales de ${PROVIDER}` }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(BOARD)).toBeVisible();
    await expect(dialog.getByText(OLD)).toBeVisible();
  });
});

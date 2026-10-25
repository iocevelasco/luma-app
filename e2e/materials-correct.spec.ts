import { expect, test, type Page } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';

/**
 * Corregir un material y bajar la lista de compras.
 *
 * Se edita o elimina sólo mientras el material no salió de Pendiente. Arma su
 * propia cuenta y su propia obra: edita, mueve y borra, y la obra compartida de
 * las cuentas fijas es para mirar.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_EMAIL = `e2e-materials-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra materiales ${RUN_ID}`;
const TYPO = `Cemnto ${RUN_ID}`;
const FIXED = `Cemento ${RUN_ID}`;
const DUPLICATE = `Arena duplicada ${RUN_ID}`;
const REQUESTED = `Hierro ${RUN_ID}`;

requiresApi();

async function addMaterial(page: Page, name: string, quantity: string, supplier: string) {
  await page.getByRole('button', { name: /agregar material/i }).click();
  await page.locator('#material-name').fill(name);
  await page.locator('#material-quantity').fill(quantity);
  await page.locator('#material-unit').click();
  await page.getByRole('option', { name: /bolsa/i }).click();
  // Proveedor escrito a mano: la obra no tiene proveedores cargados.
  await page.locator('#material-supplier').click();
  await page.getByPlaceholder(/buscar proveedor/i).fill(supplier);
  await page.getByRole('option', { name: `Usar «${supplier}» sin vincular` }).click();
  await page.getByRole('button', { name: /^agregar$/i }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test.describe('corregir materiales y descargar la lista de compras', () => {
  test('edita y elimina mientras está pendiente, y se bloquea al solicitarlo', async ({ page }) => {
    await registerWith(page, `Ejecutante materiales ${RUN_ID}`, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);

    await page.getByRole('link', { name: /nueva obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para corregir materiales.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    await page.getByRole('link', { name: /^compras$/i }).click();
    await expect(page).toHaveURL(/\/materiales$/);

    await addMaterial(page, TYPO, '10', 'Corralón Sur');
    await addMaterial(page, DUPLICATE, '3', 'Corralón Sur');
    await addMaterial(page, REQUESTED, '8', 'Ferretería Díaz');

    const toBuy = page.getByRole('tabpanel', { name: /por comprar/i });

    // --- Editar: un error de tipeo en el nombre y la cantidad.
    await toBuy.getByRole('button', { name: `Editar ${TYPO}` }).click();
    const save = page.getByRole('button', { name: /guardar cambios/i });
    // Sin cambios no hay nada que guardar.
    await expect(save).toBeDisabled();
    await page.locator('#material-name').fill(FIXED);
    await page.locator('#material-quantity').fill('12');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(toBuy.getByText(FIXED)).toBeVisible();
    await expect(toBuy.getByText(TYPO)).toHaveCount(0);
    await expect(toBuy.getByText(/12 Bolsa/)).toBeVisible();

    // --- Eliminar: el duplicado, con confirmación.
    await toBuy.getByRole('button', { name: `Más acciones de ${DUPLICATE}` }).click();
    await page.getByRole('menuitem', { name: /^eliminar$/i }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(DUPLICATE);
    await confirm.getByRole('button', { name: /^eliminar$/i }).click();
    await expect(toBuy.getByText(DUPLICATE)).toHaveCount(0);

    // --- Bloqueo: al solicitarlo, el diálogo avisa y después ya no se corrige.
    await toBuy
      .getByRole('listitem')
      .filter({ hasText: REQUESTED })
      .getByRole('button', { name: /marcar solicitado/i })
      .click();
    await expect(page.getByRole('alertdialog')).toContainText(/ya no vas a poder editarlo ni eliminarlo/i);
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();

    await expect(toBuy.getByRole('button', { name: `Editar ${REQUESTED}` })).toHaveCount(0);
    await toBuy.getByRole('button', { name: `Más acciones de ${REQUESTED}` }).click();
    await expect(page.getByRole('menuitem', { name: /^eliminar$/i })).toHaveCount(0);
    await expect(page.getByText(/ya no se puede editar ni eliminar/i)).toBeVisible();
    await page.keyboard.press('Escape');

    // Volver a Pendiente no lo desbloquea.
    await toBuy.getByRole('button', { name: `Más acciones de ${REQUESTED}` }).click();
    await page.getByRole('menuitem', { name: /^pendiente$/i }).click();
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(toBuy.getByText(REQUESTED)).toBeVisible();
    await expect(toBuy.getByRole('button', { name: `Editar ${REQUESTED}` })).toHaveCount(0);

    // --- PDF: la lista de lo que falta comprar, con proveedor.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        // "Descargar" abre un menú con el formato: PDF o CSV.
        await toBuy.getByRole('button', { name: /^descargar$/i }).click();
        await page.getByRole('menuitem', { name: /pdf/i }).click();
      })(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^compras-.+-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';

/**
 * Selección múltiple en Compras: tildar todo, pasarlo de estado de una vez y
 * borrar varios pendientes juntos.
 *
 * Arma su propia cuenta y su propia obra: mueve y borra, y la obra compartida
 * de las cuentas fijas es para mirar.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_EMAIL = `e2e-materials-bulk-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra selección ${RUN_ID}`;
const TUBE = `Tubo PVC ${RUN_ID}`;
const ELBOW = `Codo 45 ${RUN_ID}`;
const TAPE = `Cinta de butilo ${RUN_ID}`;
const BRICK = `Ladrillo ${RUN_ID}`;

requiresApi();

async function addMaterial(page: Page, name: string) {
  await page.getByRole('button', { name: /agregar material/i }).click();
  await page.locator('#material-name').fill(name);
  await page.locator('#material-quantity').fill('2');
  await page.locator('#material-unit').click();
  await page.getByRole('option', { name: /unidad/i }).click();
  await page.getByRole('button', { name: /^agregar$/i }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test.describe('selección múltiple de materiales', () => {
  test('marca todos como solicitados y borra varios pendientes juntos', async ({ page }) => {
    await registerWith(page, `Ejecutante selección ${RUN_ID}`, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);

    await page.getByRole('link', { name: /nueva obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para la selección múltiple.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    await page.getByRole('link', { name: /^compras$/i }).click();
    await expect(page).toHaveURL(/\/materiales$/);

    for (const name of [TUBE, ELBOW, TAPE, BRICK]) await addMaterial(page, name);

    const toBuy = page.getByRole('tabpanel', { name: /por comprar/i });
    const toolbar = page.getByRole('toolbar', { name: /materiales seleccionados/i });

    // --- Borrar dos pendientes juntos.
    await toBuy.getByRole('checkbox', { name: `Seleccionar ${TAPE}` }).click();
    await toBuy.getByRole('checkbox', { name: `Seleccionar ${BRICK}` }).click();
    await expect(toolbar).toContainText('2 seleccionados');
    // La casilla maestra queda a medias: hay otros dos sin tildar.
    await expect(toBuy.getByRole('checkbox', { name: 'Seleccionar todos', exact: true })).toHaveAttribute(
      'data-state',
      'indeterminate',
    );

    await toolbar.getByRole('button', { name: /más acciones para la selección/i }).click();
    await page.getByRole('menuitem', { name: /^eliminar$/i }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(/eliminar 2 materiales/i);
    await confirm.getByRole('button', { name: /^eliminar$/i }).click();
    await expect(toBuy.getByText(TAPE)).toHaveCount(0);
    await expect(toBuy.getByText(BRICK)).toHaveCount(0);
    await expect(toolbar).toHaveCount(0);

    // --- Tildar todos y pasarlos a Solicitado de una vez.
    await toBuy.getByRole('checkbox', { name: 'Seleccionar todos', exact: true }).click();
    await expect(toolbar).toContainText('2 seleccionados');
    await toolbar.getByRole('button', { name: /marcar solicitado/i }).click();
    await expect(page.getByRole('alertdialog')).toContainText(/ya no se van a poder editar/i);
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(toolbar).toHaveCount(0);

    for (const name of [TUBE, ELBOW]) {
      await expect(
        toBuy.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: /marcar comprado/i }),
      ).toBeVisible();
    }

    // Ya no son editables: la selección no ofrece eliminarlos.
    await toBuy.getByRole('checkbox', { name: 'Seleccionar todos', exact: true }).click();
    await toolbar.getByRole('button', { name: /más acciones para la selección/i }).click();
    await expect(page.getByRole('menuitem', { name: /^eliminar$/i })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Cambiar de pestaña limpia la selección.
    await page.getByRole('tab', { name: /comprados/i }).click();
    await page.getByRole('tab', { name: /por comprar/i }).click();
    await expect(toolbar).toHaveCount(0);
  });
});

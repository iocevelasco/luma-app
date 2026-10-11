import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';

/**
 * Flujo principal de RF-05 corte 1 (presupuesto, carga manual): registra su
 * propia cuenta, crea una obra, carga un presupuesto a mano con un capítulo y
 * un ítem, y confirma que el total calculado se ve en la vista de sólo
 * lectura. El importador de planilla es una entrega aparte, no está cubierto.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_NAME = `Ejecutante E2E ${RUN_ID}`;
const OWNER_EMAIL = `e2e-budget-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra presupuesto ${RUN_ID}`;
const CHAPTER_NAME = `Demolición ${RUN_ID}`;
const ITEM_NAME = `Retiro de escombros ${RUN_ID}`;

test.describe('presupuesto (carga manual)', () => {
  test('crea una obra y carga su presupuesto a mano', async ({ page }) => {
    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para probar la carga de presupuesto.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.locator('#budgetType').click();
    await page.getByRole('option', { name: /cerrado/i }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    await page.getByRole('link', { name: /^presupuesto$/i }).click();
    await expect(page).toHaveURL(/\/presupuesto$/);
    await expect(page.getByText(/todavía no cargaste el presupuesto/i)).toBeVisible();

    // "Importar planilla" es la pestaña por defecto — la carga manual queda
    // como alternativa, hay que pasar a esa pestaña primero.
    await page.getByRole('tab', { name: /cargar a mano/i }).click();

    await page.locator('#budget-line-0-chapter').fill(CHAPTER_NAME);
    await page.locator('#budget-line-0-name').fill(ITEM_NAME);
    await page.locator('#budget-line-0-unit').fill('global');
    await page.locator('#budget-line-0-total').fill('100000');
    await page.locator('#contingencyAmount').fill('10000');

    await page.getByRole('button', { name: /guardar presupuesto/i }).click();

    // ResponsiveTable dibuja tabla de escritorio y tarjetas de celular a la
    // vez (una se esconde por CSS) — el dato de una columna aparece dos veces
    // en el DOM, por eso `.first()` en vez de violar el modo estricto.
    await expect(page.getByText(CHAPTER_NAME).first()).toBeVisible();
    await expect(page.getByText(ITEM_NAME).first()).toBeVisible();
    await expect(page.getByText(/\$\s?100\.000,00/).first()).toBeVisible();
  });
});

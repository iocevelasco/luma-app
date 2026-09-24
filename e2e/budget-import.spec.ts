import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';

/**
 * Flujo del importador de planilla (RF-05, corte 2): sube un .csv con los
 * encabezados de ejemplo del documento funcional, confirma que el mapeo de
 * columnas se detecta solo, y que el presupuesto queda cargado con el total
 * correcto. La carga manual ya está cubierta por `budget.spec.ts`.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'presupuesto-ejemplo.csv');

const RUN_ID = Date.now();
const OWNER_NAME = `Ejecutante E2E ${RUN_ID}`;
const OWNER_EMAIL = `e2e-budget-import-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra import presupuesto ${RUN_ID}`;

test.describe('presupuesto (importador de planilla)', () => {
  test('crea una obra e importa el presupuesto desde un csv', async ({ page }) => {
    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para probar el importador de presupuesto.');
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

    // "Importar planilla" es la pestaña por defecto.
    await page.locator('#budget-import-file').setInputFiles(FIXTURE_PATH);

    // El mapeo de columnas se auto-detecta desde los encabezados en español
    // del documento funcional — no hace falta tocar los selects.
    await expect(page.getByText('Retiro de escombros').first()).toBeVisible();
    await expect(page.getByText('Volqueta').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /confirmar e importar/i })).toBeEnabled();

    await page.getByRole('button', { name: /confirmar e importar/i }).click();

    await expect(page.getByText('Demolición').first()).toBeVisible();
    await expect(page.getByText('Retiro de escombros').first()).toBeVisible();
    await expect(page.getByText(/\$\s?100\.000,00/).first()).toBeVisible();
    await expect(page.getByText(/importado desde presupuesto-ejemplo\.csv/i)).toBeVisible();
  });
});

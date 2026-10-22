import { expect, test, type Page } from '@playwright/test';
import { appUrl, loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';
import { addCrewMember } from './helpers/crew';
import { attachDialog } from './helpers/dialog';

/**
 * Nada se borra al primer toque: el botón abre una confirmación que nombra lo
 * que se va. Cancelar deja todo como estaba; confirmar lo borra. Pesa más en
 * la plata —un cobro no se edita, así que borrarlo es la única corrección
 * posible—, pero vale igual para sacar gente de una obra.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';
const EXPENSE = `Cemento ${RUN_ID}`;
const INSTALLMENT = `Anticipo ${RUN_ID}`;

requiresApi();

async function startProject(page: Page, label: string): Promise<string> {
  const email = `e2e-delete-${label}-${RUN_ID}@luma.test`;
  await registerWith(page, `Ejecutante E2E ${RUN_ID}`, email, PASSWORD);
  await loginWith(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto(appUrl('/admin/proyectos/nuevo'));
  await page.locator('#name').fill(`Obra borrados ${label} ${RUN_ID}`);
  await page.locator('#description').fill('Obra para probar las confirmaciones de borrado.');
  await page.locator('#location').fill('CABA');
  await page.locator('#estimatedStartDate').fill('2026-09-01');
  await page.locator('#estimatedEndDate').fill('2026-12-15');
  await page.locator('#currency').click();
  await page.getByRole('option', { name: 'ARS' }).click();
  await page.getByRole('button', { name: /crear obra/i }).click();
  await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
  return page.url();
}

test.describe('borrar pide confirmación', () => {
  test('gasto, cuota y cobro: cancelar conserva, confirmar borra', async ({ page }) => {
    const projectUrl = await startProject(page, 'plata');

    // --- Gasto ---
    await page.goto(`${projectUrl}/gastos`);
    await page.getByRole('button', { name: /registrar gasto/i }).first().click();
    await page.locator('#expense-description').fill(EXPENSE);
    await page.locator('#expense-amount').fill('15000');
    await page.getByRole('button', { name: /^registrar$/i }).click();
    await expect(page.getByText(EXPENSE)).toBeVisible();

    await page.getByRole('button', { name: /eliminar gasto/i }).click();
    const expenseDialog = page.getByRole('alertdialog');
    await expect(expenseDialog).toContainText(EXPENSE);
    await expect(expenseDialog).toContainText(/no se puede deshacer/i);
    await attachDialog(page, 'gasto');
    await expenseDialog.getByRole('button', { name: /cancelar/i }).click();
    await expect(page.getByText(EXPENSE)).toBeVisible();

    await page.getByRole('button', { name: /eliminar gasto/i }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /eliminar gasto/i }).click();
    await expect(page.getByText(EXPENSE)).toHaveCount(0);

    // --- Cuota y cobro ---
    await page.goto(`${projectUrl}/pagos`);
    await page.getByRole('button', { name: /agregar cuota/i }).click();
    await page.locator('#schedule-concept').fill(INSTALLMENT);
    await page.locator('#schedule-amount').fill('100000');
    await page.getByRole('button', { name: /^agregar$/i }).click();
    await expect(page.getByText(INSTALLMENT, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /registrar cobro/i }).first().click();
    await page.locator('#payment-amount').fill('40000');
    await page.getByRole('button', { name: /^registrar$/i }).click();
    await expect(page.getByRole('button', { name: /eliminar cobro/i })).toBeVisible();

    await page.getByRole('button', { name: /eliminar cobro/i }).click();
    const paymentDialog = page.getByRole('alertdialog');
    await expect(paymentDialog).toContainText(/eliminar este cobro/i);
    await attachDialog(page, 'cobro');
    await paymentDialog.getByRole('button', { name: /cancelar/i }).click();
    await expect(page.getByRole('button', { name: /eliminar cobro/i })).toBeVisible();

    await page.getByRole('button', { name: /eliminar cobro/i }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /eliminar cobro/i }).click();
    await expect(page.getByRole('button', { name: /eliminar cobro/i })).toHaveCount(0);

    await page.getByRole('button', { name: /eliminar cuota/i }).click();
    const installmentDialog = page.getByRole('alertdialog');
    await expect(installmentDialog).toContainText(INSTALLMENT);
    await attachDialog(page, 'cuota');
    await installmentDialog.getByRole('button', { name: /eliminar cuota/i }).click();
    await expect(page.getByText(INSTALLMENT, { exact: true })).toHaveCount(0);
  });

  test('plantel: sacar de la obra pide confirmación', async ({ page }) => {
    const projectUrl = await startProject(page, 'plantel');
    const worker = `Rosa Plantel ${RUN_ID}`;

    await page.goto(`${projectUrl}/personal`);
    await addCrewMember(page, { name: worker });
    await page.getByRole('tab', { name: /^tablero$/i }).click();
    await page.getByRole('button', { name: /^personal fijo$/i }).click();
    const roster = page.getByRole('dialog');
    await expect(roster.getByText(worker)).toBeVisible();

    await roster.getByRole('button', { name: /sacar de la obra/i }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(worker);
    await attachDialog(page, 'plantel');
    await confirm.getByRole('button', { name: /cancelar/i }).click();
    await expect(roster.getByText(worker)).toBeVisible();

    await roster.getByRole('button', { name: /sacar de la obra/i }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /sacar de la obra/i }).click();
    await expect(roster.getByText(worker)).toHaveCount(0);
  });
});

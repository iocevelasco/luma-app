import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';

/**
 * Flujo principal de RF-01 (planificación semanal) y RF-02 (materiales):
 * registra su propia cuenta, crea una obra, agrega una actividad de esta
 * semana, navega a la siguiente y vuelve, agrega un material asociado y
 * confirma el cambio de estado.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_NAME = `Ejecutante E2E ${RUN_ID}`;
const OWNER_EMAIL = `e2e-activities-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra actividades ${RUN_ID}`;
const ACTIVITY_NAME = `Contrapiso ${RUN_ID}`;
const MATERIAL_NAME = `Cemento ${RUN_ID}`;

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

test.describe('planificación semanal y materiales', () => {
  test('crea una obra, planifica una actividad y gestiona sus materiales', async ({ page }) => {
    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para probar actividades y materiales.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.locator('#budgetType').click();
    await page.getByRole('option', { name: /cerrado/i }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    await page.getByRole('link', { name: /^cronograma$/i }).click();
    await expect(page).toHaveURL(/\/actividades$/);

    const today = new Date();
    const start = toDayKey(today);
    const end = toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));

    await page.getByRole('button', { name: /nueva actividad/i }).click();
    await page.locator('#activity-name').fill(ACTIVITY_NAME);
    await page.locator('#activity-area').fill('Planta baja');
    await page.locator('#activity-start').fill(start);
    await page.locator('#activity-end').fill(end);
    await page.locator('#activity-responsible').fill('Juan Pérez');
    await page.getByRole('button', { name: /crear actividad/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Aparece como fila del gantt del rango actual (este mes).
    const activityRow = page.getByRole('gridcell', { name: ACTIVITY_NAME });
    await expect(activityRow).toBeVisible();

    // Abre el detalle en el modal de pantalla completa y vuelve sin cambiar la URL.
    await activityRow.click();
    const detailDialog = page.getByRole('dialog');
    await expect(detailDialog.getByText(ACTIVITY_NAME)).toBeVisible();
    await expect(page).toHaveURL(/\/actividades$/);
    await detailDialog.getByRole('button', { name: /atrás/i }).click();
    await expect(detailDialog).toBeHidden();

    // Agrega un material asociado a esa actividad.
    await page.goto(page.url().replace(/\/actividades$/, ''));
    await page.getByRole('link', { name: /^materiales$/i }).click();
    await expect(page).toHaveURL(/\/materiales$/);

    await page.locator('#material-name').fill(MATERIAL_NAME);
    await page.locator('#material-quantity').fill('10');
    await page.locator('#material-unit').click();
    await page.getByRole('option', { name: /bolsa/i }).click();
    await page.locator('#material-activity').click();
    await page.getByRole('option', { name: ACTIVITY_NAME }).click();
    await page.getByRole('button', { name: /^agregar$/i }).click();

    await expect(page.getByText(MATERIAL_NAME)).toBeVisible();

    // Cambia el estado y confirma en el diálogo.
    await page.getByText(MATERIAL_NAME).locator('../..').getByRole('combobox').click();
    await page.getByRole('option', { name: /solicitado/i }).click();
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
  });
});

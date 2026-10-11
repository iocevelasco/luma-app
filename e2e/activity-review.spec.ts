import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';

/**
 * Validación del supervisor: el trabajo se reporta terminado, el supervisor
 * lo devuelve con motivo (el motivo tiene que quedar visible para quien
 * corrige) y recién después se cierra.
 *
 * La regla de permisos —el Asistente no puede cerrar— está cubierta por unit
 * tests del controller: acá se recorre el flujo de la persona.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

test.describe('validación del supervisor', () => {
  test('reporta terminado, el supervisor devuelve con motivo y después cierra', async ({
    page,
  }) => {
    const ownerEmail = `e2e-review-${RUN_ID}@luma.test`;
    const projectName = `Obra revisión ${RUN_ID}`;
    const activityName = `Colocación de aberturas ${RUN_ID}`;
    const reason = `Faltan los burletes ${RUN_ID}`;

    await registerWith(page, `Ejecutante E2E ${RUN_ID}`, ownerEmail, PASSWORD);
    await loginWith(page, ownerEmail, PASSWORD);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(projectName);
    await page.locator('#description').fill('Obra para probar la validación.');
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
    await page.getByRole('button', { name: /nueva actividad/i }).click();
    await page.locator('#activity-name').fill(activityName);
    await page.locator('#activity-area').fill('Fachada');
    await page.locator('#activity-start').fill(toDayKey(today));
    await page
      .locator('#activity-end')
      .fill(toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)));
    await page.locator('#activity-responsible').fill('Juan Pérez');
    // La especialidad es opcional, pero se declara para agrupar por rubro.
    await page.locator('#activity-specialty').click();
    await page.getByRole('option', { name: /^carpintería$/i }).click();
    await page.getByRole('button', { name: /crear actividad/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('gridcell', { name: activityName, exact: true }).click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText(/carpintería/i)).toBeVisible();

    // --- Se reporta terminado ---
    await detail.getByRole('button', { name: /^editar$/i }).click();
    const editDialog = page.getByRole('dialog').last();
    await editDialog.locator('#edit-activity-status').click();
    await page.getByRole('option', { name: /^en revisión$/i }).click();
    await editDialog.getByRole('button', { name: /^guardar$/i }).click();

    await expect(detail.getByText(/validación del supervisor/i)).toBeVisible();
    await expect(detail.getByRole('button', { name: /aprobar y cerrar/i })).toBeVisible();

    // --- El supervisor lo devuelve con motivo ---
    await detail.getByRole('button', { name: /^devolver$/i }).click();
    // Sin motivo no se puede devolver: un rechazo mudo deja todo en limbo.
    await expect(detail.getByRole('button', { name: /devolver con este motivo/i })).toBeDisabled();

    await detail.locator('#reject-reason').fill(reason);
    await detail.getByRole('button', { name: /devolver con este motivo/i }).click();

    // El motivo sobrevive y queda visible con la actividad de vuelta en curso.
    await expect(detail.getByText(/el supervisor devolvió esta actividad/i)).toBeVisible();
    await expect(detail.getByText(reason)).toBeVisible();

    // --- Se corrige, se vuelve a reportar y ahora sí se cierra ---
    await detail.getByRole('button', { name: /^editar$/i }).click();
    const editAgain = page.getByRole('dialog').last();
    await editAgain.locator('#edit-activity-status').click();
    await page.getByRole('option', { name: /^en revisión$/i }).click();
    await editAgain.getByRole('button', { name: /^guardar$/i }).click();

    // Al re-reportar, el motivo viejo ya no aplica.
    await expect(detail.getByText(reason)).toHaveCount(0);

    await detail.getByRole('button', { name: /aprobar y cerrar/i }).click();
    await expect(detail.getByText(/^completada$/i).first()).toBeVisible();
  });
});

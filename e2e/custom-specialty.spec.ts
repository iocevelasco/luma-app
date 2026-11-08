import { expect, test, type Page } from '@playwright/test';
import { openSection } from './helpers/nav';
import { createProjectViaForm } from './helpers/projects';
import { loginWith, registerWith } from './helpers/auth';
import { pickActivityResponsible } from './helpers/activity';
import { requiresApi } from './helpers/api';

/**
 * El gerente agrega una especialidad propia desde el mismo selector de la tarea,
 * queda elegida y la tarea la muestra con su nombre. Arma su propia obra: crear
 * una especialidad la cambia para todo el que mire esa obra.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';
const SPECIALTY = `Yesería ${RUN_ID}`;

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

async function createOwnProject(page: Page, tag: string) {
    const email = `e2e-specialty-${tag}-${RUN_ID}@luma.test`;
    await registerWith(page, `Ejecutante E2E ${RUN_ID}`, email, PASSWORD);
    await loginWith(page, email, PASSWORD);

    await createProjectViaForm(page, {
      name: `Obra especialidades ${tag} ${RUN_ID}`,
      location: 'CABA',
      start: '2026-09-01',
      end: '2026-12-15',
      currency: 'ARS',
    });
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

}

requiresApi();

test.describe('especialidades propias de la obra', () => {
  test('se crea desde el selector, queda elegida y se ve en la tarea', async ({ page }) => {
    await createOwnProject(page, 'a');

    await openSection(page, 'activities');
    await page.getByRole('button', { name: /nueva tarea/i }).click();
    await page.locator('#activity-name').fill(`Cielorraso ${RUN_ID}`);

    await page.locator('#activity-specialty').click();
    await page.getByPlaceholder('Buscar…').fill(SPECIALTY);
    await page.getByRole('option', { name: new RegExp(`crear.*${RUN_ID}`, 'i') }).click();
    await expect(page.locator('#activity-specialty')).toContainText(SPECIALTY);

    const today = new Date();
    await page.locator('#activity-start').fill(toDayKey(today));
    await page.locator('#activity-end').fill(toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)));
    await pickActivityResponsible(page);
    await page.getByRole('button', { name: /crear tarea/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('gridcell', { name: `Cielorraso ${RUN_ID}`, exact: true }).click();
    await expect(page.getByRole('dialog').getByText(SPECIALTY)).toBeVisible();
  });

  test('el panel de la lista se abre sobre "Nueva tarea": agrega y renombra sin perder lo escrito', async ({ page }) => {
    await createOwnProject(page, 'b');
    await openSection(page, 'activities');
    await page.getByRole('button', { name: /nueva tarea/i }).click();
    await page.locator('#activity-name').fill(`Revoque ${RUN_ID}`);

    await page.getByRole('button', { name: /ver y editar las especialidades/i }).click();
    const panel = page.getByRole('dialog').last();
    await panel.getByLabel(/nombre de la especialidad/i).fill(`Domótica ${RUN_ID}`);
    await panel.getByRole('button', { name: /^agregar$/i }).click();
    await expect(panel.getByText(`Domótica ${RUN_ID}`)).toBeVisible();

    await panel.getByRole('button', { name: /acciones de/i }).click();
    await page.getByRole('menuitem', { name: /renombrar/i }).click();
    const rename = page.getByRole('dialog').last();
    await rename.locator('#specialty-rename').fill(`Domótica pro ${RUN_ID}`);
    await rename.getByRole('button', { name: /^guardar$/i }).click();
    await expect(panel.getByText(`Domótica pro ${RUN_ID}`)).toBeVisible();

    await page.keyboard.press('Escape');
    // Volvió a "Nueva tarea" con lo escrito intacto y sin haberla enviado.
    await expect(page.locator('#activity-name')).toHaveValue(`Revoque ${RUN_ID}`);
    await page.locator('#activity-specialty').click();
    await expect(page.getByRole('option', { name: `Domótica pro ${RUN_ID}` })).toBeVisible();
  });
});

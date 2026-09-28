import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';

/**
 * Personal fijo de obra y metas semanales: cargar el roster (persona, equipo
 * y encargado de especialidad), asignar una meta de la semana, marcarla, y
 * confirmar que las metas viven en SU semana y no se filtran a la siguiente.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';

test.describe('personal fijo y metas semanales', () => {
  test('carga el roster, asigna una meta y la marca cumplida', async ({ page }) => {
    const ownerEmail = `e2e-crew-${RUN_ID}@luma.test`;
    const projectName = `Obra personal ${RUN_ID}`;
    const leadName = `Martín Acosta ${RUN_ID}`;
    const teamName = `Cuadrilla ${RUN_ID}`;
    const goalText = `Terminar el revoque ${RUN_ID}`;

    await registerWith(page, `Ejecutante E2E ${RUN_ID}`, ownerEmail, PASSWORD);
    await loginWith(page, ownerEmail, PASSWORD);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(projectName);
    await page.locator('#description').fill('Obra para probar personal y metas.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.locator('#budgetType').click();
    await page.getByRole('option', { name: /cerrado/i }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    await page.getByRole('link', { name: /^personal$/i }).click();
    await expect(page).toHaveURL(/\/personal$/);

    // La asistencia diaria sigue siendo la vista por defecto.
    await expect(page.getByText(/quién está trabajando hoy/i)).toBeVisible();

    await page.getByRole('tab', { name: /metas de la semana/i }).click();
    await expect(page.getByText(/primero cargá el personal fijo/i)).toBeVisible();

    // --- Roster: un encargado de especialidad y un equipo ---
    await page.getByRole('button', { name: /^personal fijo$/i }).click();
    const roster = page.getByRole('dialog');

    await roster.locator('#crew-name').fill(leadName);
    await roster.locator('#crew-specialty').click();
    await page.getByRole('option', { name: /^electricidad$/i }).click();
    await roster.getByText(/es el encargado de su especialidad/i).click();
    await roster.getByRole('button', { name: /^agregar$/i }).click();
    await expect(roster.getByText(leadName)).toBeVisible();
    await expect(roster.getByText(/^encargado$/i)).toBeVisible();

    await roster.locator('#crew-name').fill(teamName);
    await roster.locator('#crew-kind').click();
    await page.getByRole('option', { name: /^equipo$/i }).click();
    await roster.getByRole('button', { name: /^agregar$/i }).click();
    await expect(roster.getByText(teamName)).toBeVisible();

    await roster.getByRole('button', { name: /close/i }).click();
    await expect(roster).toBeHidden();

    // --- Meta de la semana para el equipo ---
    await page.locator('#goal-crew-member').click();
    await page.getByRole('option', { name: new RegExp(teamName, 'i') }).click();
    await page.locator('#goal-description').fill(goalText);
    await page.getByRole('button', { name: /agregar meta/i }).click();

    await expect(page.getByText(goalText)).toBeVisible();
    // Agrupada bajo el nombre de quien la tiene.
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible();

    // --- Se marca cumplida ---
    await page.getByRole('combobox').filter({ hasText: /pendiente/i }).click();
    await page.getByRole('option', { name: /^cumplida$/i }).click();
    await expect(
      page.getByRole('combobox').filter({ hasText: /^cumplida$/i }),
    ).toBeVisible();

    // --- La meta vive en SU semana, no se filtra a la siguiente ---
    await page.getByRole('button', { name: /semana siguiente/i }).click();
    await expect(page.getByText(/no hay metas cargadas para esta semana/i)).toBeVisible();
    await expect(page.getByText(goalText)).toHaveCount(0);

    // Y al volver sigue ahí, con el estado que le pusimos.
    await page.getByRole('button', { name: /semana actual/i }).click();
    await expect(page.getByText(goalText)).toBeVisible();
    await expect(
      page.getByRole('combobox').filter({ hasText: /^cumplida$/i }),
    ).toBeVisible();
  });
});

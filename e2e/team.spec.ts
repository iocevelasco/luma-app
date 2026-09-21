import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';

/**
 * Flujo del Asistente de Obra (RF-13, sección 2.3): un miembro de la Empresa
 * con acceso operativo a las obras del dueño, sin presupuesto ni invitación
 * de clientes. Mismo patrón que `projects.spec.ts` para el email: el
 * asistente ya tiene cuenta antes de la invitación — no hay bandeja de
 * entrada real en CI para probar el camino de activación por correo.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_NAME = `Ejecutante E2E ${RUN_ID}`;
const OWNER_EMAIL = `e2e-team-owner-${RUN_ID}@luma.test`;
const ASSISTANT_NAME = `Asistente E2E ${RUN_ID}`;
const ASSISTANT_EMAIL = `e2e-team-assistant-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra equipo ${RUN_ID}`;
const ACTIVITY_NAME = `Instalación eléctrica ${RUN_ID}`;

test.describe('Asistente de Obra', () => {
  test('el dueño invita a un asistente, que edita la obra sin ver presupuesto ni invitar clientes', async ({
    page,
    browser,
  }) => {
    const assistantContext = await browser.newContext();
    const assistantPage = await assistantContext.newPage();
    await registerWith(assistantPage, ASSISTANT_NAME, ASSISTANT_EMAIL, PASSWORD);

    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para probar el rol de Asistente de Obra.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.locator('#budgetType').click();
    await page.getByRole('option', { name: /cerrado/i }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    // Invita al asistente desde el home (es un rol de Empresa, no de esta obra puntual).
    await page.goto(page.url().replace(/\/admin\/proyectos\/.*$/, '/admin'));
    await page.getByRole('button', { name: /invitar asistente/i }).click();
    await page.locator('#member-email').fill(ASSISTANT_EMAIL);
    await page.getByRole('dialog').getByRole('button', { name: /invitar/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(ASSISTANT_EMAIL)).toBeVisible();

    // El asistente entra con su propia cuenta y ve la obra en su listado.
    await loginWith(assistantPage, ASSISTANT_EMAIL, PASSWORD);
    await expect(assistantPage).toHaveURL(/\/admin$/);
    await assistantPage.getByRole('link', { name: PROJECT_NAME }).click();
    await expect(assistantPage).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+\/actividades$/);

    // Acceso operativo: puede crear una actividad.
    await assistantPage.getByRole('button', { name: /nueva actividad/i }).click();
    await assistantPage.locator('#activity-name').fill(ACTIVITY_NAME);
    await assistantPage.locator('#activity-area').fill('Planta alta');
    await assistantPage.locator('#activity-start').fill('2026-09-05');
    await assistantPage.locator('#activity-end').fill('2026-09-10');
    await assistantPage.locator('#activity-responsible').fill('Asistente E2E');
    await assistantPage.getByRole('button', { name: /crear actividad/i }).click();
    await expect(assistantPage.getByRole('dialog')).toBeHidden();
    await expect(assistantPage.getByRole('gridcell', { name: ACTIVITY_NAME })).toBeVisible();

    // Sin presupuesto ni gestión de clientes: ni la pestaña ni el botón existen.
    await expect(assistantPage.getByRole('link', { name: /^presupuesto$/i })).toHaveCount(0);
    await assistantPage.goto(assistantPage.url().replace(/\/actividades$/, ''));
    await expect(assistantPage.getByRole('button', { name: /invitar cliente/i })).toHaveCount(0);

    await assistantContext.close();
  });
});

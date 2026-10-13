import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { pickActivityResponsible, pickActivitySpecialty } from './helpers/activity';
import { addCrewMember } from './helpers/crew';

/**
 * Flujo del Supervisor de obra: se invita **a una obra puntual**, no a la
 * Empresa. Reemplaza al Asistente de Obra de la v1, que era un rol de Empresa
 * y por eso entraba a todas sus obras — un supervisor contratado para un piso
 * no tiene por qué ver el presupuesto de los otros.
 *
 * Lo que este spec fija, que es lo que más fácil se afloja de vuelta:
 * el supervisor **reporta** sobre lo planificado, no planifica, y no ve plata.
 *
 * Mismo patrón que `projects.spec.ts` para el email: el supervisor ya tiene
 * cuenta antes de la invitación — no hay bandeja de entrada real en CI para
 * probar el camino de activación por correo.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_NAME = `Ejecutante E2E ${RUN_ID}`;
const OWNER_EMAIL = `e2e-team-owner-${RUN_ID}@luma.test`;
const SUPERVISOR_NAME = `Supervisor E2E ${RUN_ID}`;
const SUPERVISOR_EMAIL = `e2e-team-supervisor-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra equipo ${RUN_ID}`;
const ACTIVITY_NAME = `Instalación eléctrica ${RUN_ID}`;

test.describe('Supervisor de obra', () => {
  test('el gerente lo invita a la obra; reporta avance pero no planifica ni ve presupuesto', async ({
    page,
    browser,
  }) => {
    const supervisorContext = await browser.newContext();
    const supervisorPage = await supervisorContext.newPage();
    await registerWith(supervisorPage, SUPERVISOR_NAME, SUPERVISOR_EMAIL, PASSWORD);

    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para probar el rol de Supervisor de obra.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    // El gerente planifica. El supervisor reporta sobre esto, no lo crea.
    const projectUrl = page.url();
    await page.goto(`${projectUrl}/actividades`);
    await page.getByRole('button', { name: /nueva actividad/i }).click();
    await page.locator('#activity-name').fill(ACTIVITY_NAME);
    await pickActivitySpecialty(page);
    await page.locator('#activity-start').fill('2026-09-05');
    await page.locator('#activity-end').fill('2026-09-10');
    await pickActivityResponsible(page);
    await page.getByRole('button', { name: /crear actividad/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Acceso a ESTA obra, con el rol explícito, desde la pantalla de equipo.
    await page.goto(`${projectUrl}/equipo`);
    await page.getByRole('button', { name: /dar acceso/i }).first().click();
    await page.locator('#member-email').fill(SUPERVISOR_EMAIL);
    await page.getByRole('dialog').getByRole('button', { name: /^supervisor de obra$/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^dar acceso$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(SUPERVISOR_EMAIL)).toBeVisible();

    // El supervisor entra con su cuenta y ve la obra en su listado.
    await loginWith(supervisorPage, SUPERVISOR_EMAIL, PASSWORD);
    await expect(supervisorPage).toHaveURL(/\/admin$/);
    await supervisorPage.getByRole('link', { name: PROJECT_NAME }).click();
    await expect(supervisorPage.getByText(ACTIVITY_NAME).first()).toBeVisible();

    // No planifica: el botón de crear actividad no existe para él.
    await supervisorPage.goto(`${projectUrl}/actividades`);
    await expect(
      supervisorPage.getByRole('button', { name: /nueva actividad/i }),
    ).toHaveCount(0);

    // No ve plata: ni presupuesto ni Consultor IA, ni como pestaña ni por URL.
    await expect(supervisorPage.getByRole('link', { name: /^presupuesto$/i })).toHaveCount(0);
    await expect(supervisorPage.getByRole('link', { name: /consultor/i })).toHaveCount(0);

    // Tampoco ve plata de ningún lado: ni cobros ni gastos.
    await expect(supervisorPage.getByRole('link', { name: /^pagos$/i })).toHaveCount(0);
    await expect(supervisorPage.getByRole('link', { name: /^gastos$/i })).toHaveCount(0);

    // Y no administra accesos: la pestaña de equipo no existe para él.
    await supervisorPage.goto(projectUrl);
    await expect(supervisorPage.getByRole('link', { name: /^equipo$/i })).toHaveCount(0);

    // Suma personal a SU obra —es quien está cuando llega alguien nuevo—, pero
    // no administra el roster: ni sacar, ni dar de baja, ni traer de la Empresa.
    await expect(supervisorPage.getByText(/metas de la semana/i)).toBeVisible();
    await supervisorPage.goto(`${projectUrl}/personal`);
    await addCrewMember(supervisorPage, { name: `Obrero del supervisor ${RUN_ID}` });
    await supervisorPage.getByRole('tab', { name: /^tablero$/i }).click();
    await supervisorPage.getByRole('button', { name: /^personal fijo$/i }).click();
    const roster = supervisorPage.getByRole('dialog');
    await expect(roster.getByText(`Obrero del supervisor ${RUN_ID}`)).toBeVisible();
    await expect(roster.getByRole('button', { name: /agregar de la empresa/i })).toHaveCount(0);
    await expect(roster.getByRole('button', { name: /sacar de la obra|dar de baja/i })).toHaveCount(0);

    await supervisorContext.close();
  });
});

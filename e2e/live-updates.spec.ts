import { expect, test, type Page } from '@playwright/test';
import { createProjectViaForm } from './helpers/projects';
import { loginWith, registerWith } from './helpers/auth';
import { addCrewMember, addTask, openBoard, taskCard } from './helpers/crew';
import { requiresApi } from './helpers/api';

/**
 * Tiempo real entre dos personas de la misma obra: lo que carga el gerente le
 * aparece al supervisor **sin recargar y sin esperar al polling**.
 *
 * Arma su propia cuenta y su propia obra (crea cosas: la compartida es para
 * mirar) y dos contextos de navegador, uno por persona.
 *
 * El polling de las pantallas de obra es de 30 s: si el cambio aparece antes
 * de 5 s, llegó por el canal en vivo. Un solo cambio podría coincidir con una
 * vuelta del polling; por eso son dos seguidos.
 *
 * El estado del canal se lee de `<html data-live-status>`, que deja
 * `useProjectLive`: se espera a `live` antes de provocar el cambio.
 */
// El idioma lo detecta la app del navegador: sin esto Playwright (en-US) cae al
// español de España y los textos ("Añadir") no coinciden con los de los helpers.
test.use({ storageState: { cookies: [], origins: [] }, locale: 'es-AR' });

const RUN_ID = Date.now();
const OWNER_EMAIL = `e2e-live-owner-${RUN_ID}@luma.test`;
const SUPERVISOR_EMAIL = `e2e-live-supervisor-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra en vivo ${RUN_ID}`;
const FIRST = `Cemento en vivo ${RUN_ID}`;
const SECOND = `Arena en vivo ${RUN_ID}`;
const TASK = `Tarea en vivo ${RUN_ID}`;
const WORKER = `Obrero en vivo ${RUN_ID}`;

/** Menos que el polling (30 s) y más que la latencia del canal (~1-2 s). */
const LIVE_WITHIN_MS = 5_000;

requiresApi();

async function addMaterial(page: Page, name: string) {
  await page.getByRole('button', { name: /(agregar|añadir) material/i }).click();
  await page.locator('#material-name').fill(name);
  await page.locator('#material-quantity').fill('2');
  await page.locator('#material-unit').click();
  await page.getByRole('option', { name: /unidad/i }).click();
  await page.getByRole('button', { name: /^(agregar|añadir)$/i }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test.describe('tiempo real entre gerente y supervisor', () => {
  test('lo que carga el gerente le aparece al supervisor sin recargar', async ({ page, browser }) => {
    const supervisorContext = await browser.newContext();
    const supervisorPage = await supervisorContext.newPage();
    await registerWith(supervisorPage, `Supervisor en vivo ${RUN_ID}`, SUPERVISOR_EMAIL, PASSWORD);

    // --- El gerente arma la obra e invita al supervisor.
    await registerWith(page, `Ejecutante en vivo ${RUN_ID}`, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await createProjectViaForm(page, {
      name: PROJECT_NAME,
      location: 'CABA',
      start: '2026-09-01',
      end: '2026-12-15',
      currency: 'ARS',
    });
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
    const projectUrl = page.url();

    await page.goto(`${projectUrl}/equipo`);
    await page.getByRole('button', { name: /dar acceso/i }).first().click();
    await page.locator('#member-email').fill(SUPERVISOR_EMAIL);
    await page.getByRole('dialog').getByRole('button', { name: /^supervisor de obra$/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^dar acceso$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // --- El supervisor mira Compras y espera a que el canal esté abierto.
    await loginWith(supervisorPage, SUPERVISOR_EMAIL, PASSWORD);
    await supervisorPage.goto(`${projectUrl}/materiales`);
    await expect(supervisorPage.locator('html')).toHaveAttribute('data-live-status', 'live', {
      timeout: 15_000,
    });

    // --- El gerente carga dos materiales. El supervisor los ve sin tocar nada.
    await page.goto(`${projectUrl}/materiales`);
    await addMaterial(page, FIRST);
    await expect(supervisorPage.getByText(FIRST)).toBeVisible({ timeout: LIVE_WITHIN_MS });

    await addMaterial(page, SECOND);
    await expect(supervisorPage.getByText(SECOND)).toBeVisible({ timeout: LIVE_WITHIN_MS });

    // --- Lo mismo con Actividades: el supervisor mira el Tablero.
    await page.goto(`${projectUrl}/personal`);
    await addCrewMember(page, { name: WORKER });
    await openBoard(supervisorPage, projectUrl);
    await expect(supervisorPage.locator('html')).toHaveAttribute('data-live-status', 'live', {
      timeout: 15_000,
    });

    await openBoard(page, projectUrl);
    await addTask(page, WORKER, TASK);
    await expect(taskCard(supervisorPage, TASK)).toBeVisible({ timeout: LIVE_WITHIN_MS });

    await supervisorContext.close();
  });
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';

/**
 * Hitos y reuniones, de punta a punta.
 *
 * Lo que este spec fija:
 *
 * 1. El gerente deja la minuta de una reunión con formato (título, lista) y
 *    el cliente la lee con ese formato.
 * 2. Lo interno no le llega al cliente, ni en la lista ni escribiendo la URL
 *    del alta.
 * 3. El formulario es una ruta: sobrevive a una recarga, y cerrar con algo
 *    escrito pregunta antes de descartar.
 * 4. Un hito crítico se ve de entrada con su texto y su evidencia.
 *
 * Mismo patrón de cuentas que `projects.spec.ts`: cada corrida registra las
 * suyas, sin depender de usuarios sembrados.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: 'serial' });

const RUN_ID = Date.now();
const OWNER_NAME = `Gerente hitos ${RUN_ID}`;
const OWNER_EMAIL = `e2e-hitos-owner-${RUN_ID}@luma.test`;
const CLIENT_NAME = `Cliente hitos ${RUN_ID}`;
const CLIENT_EMAIL = `e2e-hitos-client-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eHitos1234!';
const PROJECT_NAME = `Obra hitos ${RUN_ID}`;

const MEETING_TITLE = `Reunión de avance ${RUN_ID}`;
const INTERNAL_TITLE = `Eventualidad interna ${RUN_ID}`;
const CRITICAL_TITLE = `Humedad en muro ${RUN_ID}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = path.join(__dirname, 'fixtures', 'evidencia-humedad.png');

let milestonesUrl = '';

/** Abre el alta y elige tipo y audiencia: lo que todo hito pide. */
async function openNewMilestone(page: Page, type: RegExp, audience: RegExp) {
  await page.getByRole('link', { name: /reportar hito/i }).click();
  await expect(page).toHaveURL(/\/hitos\/nuevo$/);
  const panel = page.getByRole('dialog');
  await panel.locator('#milestone-type').click();
  await page.getByRole('option', { name: type }).click();
  await panel.getByRole('button', { name: audience }).click();
  return panel;
}

requiresApi();

test.describe('Hitos y reuniones', () => {
  test('el gerente deja la minuta de una reunión y el cliente la lee; lo interno no le llega', async ({
    page,
    browser,
  }) => {
    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    await registerWith(clientPage, CLIENT_NAME, CLIENT_EMAIL, PASSWORD);

    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    // La acción principal flota abajo a la derecha, esté la pantalla vacía o no.
    await page.getByRole('link', { name: /^nueva obra$/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para probar hitos y reuniones.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
    const projectUrl = page.url();
    milestonesUrl = `${projectUrl}/hitos`;

    await page.goto(`${projectUrl}/equipo`);
    await page.getByRole('button', { name: /dar acceso/i }).first().click();
    await page.locator('#member-email').fill(CLIENT_EMAIL);
    await page.getByRole('dialog').getByRole('button', { name: /^cliente$/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^dar acceso$/i }).click();
    await expect(page.getByText(CLIENT_EMAIL)).toBeVisible();

    // --- La reunión, con asistentes y minuta con formato ---
    await page.goto(milestonesUrl);
    await page.getByRole('link', { name: /reportar hito/i }).click();
    await expect(page).toHaveURL(/\/hitos\/nuevo$/);

    // El formulario es una ruta: recargar no pierde la pantalla.
    await page.reload();
    await expect(page).toHaveURL(/\/hitos\/nuevo$/);
    const form = page.getByRole('dialog');
    await expect(form.getByRole('heading', { name: /reportar hito/i })).toBeVisible();

    await form.locator('#milestone-type').click();
    await page.getByRole('option', { name: /^reunión$/i }).click();
    await form.getByRole('button', { name: /visible para el cliente/i }).click();
    await form.locator('#milestone-title').fill(MEETING_TITLE);
    for (const name of ['Laura Cliente', 'Arq. Gómez']) {
      await form.locator('#milestone-attendees').fill(name);
      await form.locator('#milestone-attendees').press('Enter');
    }
    await expect(form.getByRole('button', { name: /quitar a laura cliente/i })).toBeVisible();

    // La minuta, con la barra: título y lista. Lo que se guarda es Markdown.
    const editor = form.getByRole('textbox', { name: /minuta/i });
    await editor.click();
    await form.getByRole('button', { name: /^título$/i }).click();
    await page.keyboard.type('Acuerdos');
    await page.keyboard.press('Enter');
    await form.getByRole('button', { name: /lista con viñetas/i }).click();
    await page.keyboard.type('Porcelanato mate en planta baja');
    await expect(editor.getByRole('heading', { name: 'Acuerdos' })).toBeVisible();

    await form.getByRole('button', { name: /^reportar$/i }).click();
    await expect(page).toHaveURL(/\/hitos$/);
    const meetingCard = page.getByRole('article', { name: MEETING_TITLE });
    await expect(meetingCard).toBeVisible();
    await expect(meetingCard.getByText('Laura Cliente')).toBeVisible();

    // --- Una eventualidad interna: el cliente no tiene que enterarse ---
    const internal = await openNewMilestone(page, /^retraso$/i, /^interno/i);
    await internal.locator('#milestone-title').fill(INTERNAL_TITLE);
    await internal.getByRole('button', { name: /^reportar$/i }).click();
    await expect(page.getByRole('article', { name: INTERNAL_TITLE })).toBeVisible();

    // --- El cliente ---
    await loginWith(clientPage, CLIENT_EMAIL, PASSWORD);
    await clientPage.goto(milestonesUrl);
    const clientCard = clientPage.getByRole('article', { name: MEETING_TITLE });
    await expect(clientCard).toBeVisible();
    await expect(clientPage.getByRole('article', { name: INTERNAL_TITLE })).toHaveCount(0);
    await expect(clientPage.getByRole('link', { name: /reportar hito/i })).toHaveCount(0);

    // No crítico: la minuta está cerrada, y tocar la card la abre — el
    // cliente no puede editar, así que la card no lo lleva a ningún lado.
    await expect(clientCard.getByRole('heading', { name: 'Acuerdos' })).toHaveCount(0);
    await clientCard.getByRole('button', { name: MEETING_TITLE }).click();
    await expect(clientCard.getByRole('heading', { name: 'Acuerdos' })).toBeVisible();
    await expect(clientCard.getByRole('listitem').filter({ hasText: 'Porcelanato mate' })).toBeVisible();

    // Escribir la URL del alta no le abre un formulario que terminaría en 403.
    await clientPage.goto(`${milestonesUrl}/nuevo`);
    await expect(clientPage).toHaveURL(/\/hitos$/);
    await expect(clientPage.getByRole('dialog')).toHaveCount(0);

    await clientContext.close();
  });

  test('cerrar el formulario con algo escrito pregunta antes de descartar', async ({ page }) => {
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await page.goto(milestonesUrl);

    await page.getByRole('link', { name: /reportar hito/i }).click();
    await page.getByRole('dialog').locator('#milestone-title').fill('Algo a medio escribir');
    await page.getByRole('button', { name: /^cerrar$/i }).click();

    const confirm = page.getByRole('alertdialog');
    await expect(confirm.getByText(/descartar los cambios/i)).toBeVisible();
    await confirm.getByRole('button', { name: /seguir editando/i }).click();
    await expect(page.getByRole('dialog').locator('#milestone-title')).toHaveValue(
      'Algo a medio escribir',
    );

    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').getByRole('button', { name: /^descartar$/i }).click();
    await expect(page).toHaveURL(/\/hitos$/);
    await expect(page.getByText('Algo a medio escribir')).toHaveCount(0);
  });

  test('un hito crítico se ve de entrada con su texto y su foto de evidencia', async ({ page }) => {
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await page.goto(milestonesUrl);

    const panel = await openNewMilestone(page, /^vicio oculto$/i, /^interno/i);
    await panel.locator('#milestone-title').fill(CRITICAL_TITLE);
    await panel.locator('#milestone-severity').click();
    await page.getByRole('option', { name: /^crítico$/i }).click();
    await panel.getByRole('textbox', { name: /descripción/i }).click();
    await page.keyboard.type('Aparece humedad ascendente en el muro medianero.');

    // El input es `sr-only`: se le pasa el archivo directo, como haría el
    // selector del sistema.
    await panel.locator('input[type="file"]').setInputFiles(EVIDENCE_PATH);
    await expect(panel.getByText(/se sube al guardar/i)).toBeVisible();

    const upload = page.waitForResponse(
      (response) =>
        response.url().includes('/attachments') && response.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: /^reportar$/i }).click();

    // Sin media-service configurado la subida devuelve 503 y la app lo dice;
    // lo que este test fija (la evidencia en la card) no se puede ver ahí.
    const response = await upload;
    test.skip(response.status() === 503, 'El storage no está configurado en este entorno');

    await expect(page).toHaveURL(/\/hitos$/);
    const card = page.getByRole('article', { name: CRITICAL_TITLE });
    // Crítico: el texto está a la vista sin tocar nada.
    await expect(card.getByText(/humedad ascendente/i)).toBeVisible();
    await expect(card.getByText(/^crítico$/i)).toBeVisible();
    await expect(card.getByRole('img', { name: 'evidencia-humedad.png' })).toBeVisible();

    // Toda la card lleva a la edición, y ahí está el adjunto guardado.
    await card.getByRole('link', { name: CRITICAL_TITLE }).click();
    await expect(page).toHaveURL(/\/hitos\/[a-f0-9]+\/editar$/);
    await expect(
      page.getByRole('dialog').getByRole('link', { name: 'evidencia-humedad.png' }),
    ).toBeVisible();
  });
});

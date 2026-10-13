import { expect, test, type Page } from '@playwright/test';
import { appUrl, loginWith, registerWith } from './helpers/auth';
import { pickActivityResponsible, pickActivitySpecialty } from './helpers/activity';
import { addCrewMember } from './helpers/crew';

/**
 * Metas de la semana, del lado de quien mira la obra:
 *
 * - la card del detalle, desde "no hay personal" hasta "semana al día";
 * - el arrastre: lo que quedó abierto la semana pasada aparece en esta con su
 *   semana de origen, y deja de arrastrarse cuando se cierra;
 * - la asistencia que la card conserva: si hoy falta gente, lo dice.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Registra una cuenta nueva, crea una obra y deja la página en su detalle. */
async function startProject(page: Page, label: string): Promise<string> {
  const email = `e2e-goals-${label}-${RUN_ID}@luma.test`;
  await registerWith(page, `Ejecutante ${label} ${RUN_ID}`, email, PASSWORD);
  await loginWith(page, email, PASSWORD);

  await page.goto(appUrl('/admin/proyectos/nuevo'));
  await page.locator('#name').fill(`Obra metas ${label} ${RUN_ID}`);
  await page.locator('#description').fill('Obra para probar las metas de la semana.');
  await page.locator('#location').fill('CABA');
  await page.locator('#estimatedStartDate').fill('2026-09-01');
  await page.locator('#estimatedEndDate').fill('2027-12-15');
  await page.locator('#currency').click();
  await page.getByRole('option', { name: 'ARS' }).click();
  await page.getByRole('button', { name: /crear obra/i }).click();
  await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
  return page.url();
}

/** La card de metas del detalle de la obra. */
function goalsCard(page: Page) {
  return page.locator('[data-slot="card"]').filter({ hasText: /metas de la semana/i });
}

async function addGoal(page: Page, assignee: string, description: string) {
  await page.locator('#goal-crew-member').click();
  await page.getByRole('option', { name: new RegExp(assignee, 'i') }).click();
  await page.locator('#goal-description').fill(description);
  await page.getByRole('button', { name: /agregar meta/i }).click();
  await expect(page.getByText(description)).toBeVisible();
}

/** El selector de estado de la fila de una meta. */
function statusOf(page: Page, description: string) {
  return page
    .locator('div')
    .filter({ hasText: description })
    .filter({ has: page.getByRole('combobox') })
    .last()
    .getByRole('combobox');
}

test.describe('metas de la semana', () => {
  test('la card del detalle va de "sin personal" a "semana al día"', async ({ page }) => {
    const workerName = `Ana Metas ${RUN_ID}`;
    const goalText = `Terminar el contrapiso ${RUN_ID}`;
    const projectUrl = await startProject(page, 'card');

    // --- Sin personal: la card ofrece cargarlo ahí mismo ---
    const card = goalsCard(page);
    await expect(card.getByText(/todavía no cargaste personal de obra/i)).toBeVisible();
    await card.getByRole('button', { name: /^agregar personal$/i }).click();
    const drawer = page.getByRole('dialog');
    await drawer.locator('#add-crew-name').fill(workerName);
    await drawer.getByRole('button', { name: /crear y sumar a la obra/i }).click();
    await expect(drawer).toBeHidden();

    // --- Con personal y sin metas ---
    await expect(card.getByText(/no hay metas para esta semana/i)).toBeVisible();

    // --- "Ver todo" abre directo el Tablero ---
    await card.getByRole('link', { name: /ver todo/i }).click();
    await expect(page).toHaveURL(/\/personal\?tab=board$/);
    await expect(page.getByRole('tab', { name: /^tablero$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await addGoal(page, workerName, goalText);

    // --- La card cuenta la meta y la lista con su responsable ---
    await page.goto(projectUrl);
    await expect(card.getByText('0 / 1', { exact: true })).toBeVisible();
    await expect(card.getByText(goalText)).toBeVisible();
    await expect(card.getByText(workerName)).toBeVisible();

    // --- Hecha: la card dice que la semana está al día ---
    await page.goto(`${projectUrl}/personal?tab=board`);
    await statusOf(page, goalText).click();
    await page.getByRole('option', { name: /^hecha$/i }).click();
    await expect(statusOf(page, goalText)).toHaveText(/^hecha$/i);

    await page.goto(projectUrl);
    await expect(card.getByText(/semana al día/i)).toBeVisible();
    await expect(card.getByText('1 / 1', { exact: true })).toBeVisible();
    await expect(card.getByText(goalText)).toHaveCount(0);
  });

  test('lo abierto de la semana pasada se arrastra hasta que se cierra', async ({ page }) => {
    const workerName = `Beto Arrastre ${RUN_ID}`;
    const carriedText = `Revocar el tanque ${RUN_ID}`;
    const closedText = `Limpiar la losa ${RUN_ID}`;
    const projectUrl = await startProject(page, 'carry');

    await page.goto(`${projectUrl}/personal?tab=board`);
    await addCrewMember(page, { name: workerName });

    // --- Una meta cargada en la semana ANTERIOR, que nadie cerró ---
    await page.getByRole('button', { name: /semana anterior/i }).click();
    await addGoal(page, workerName, carriedText);
    await addGoal(page, workerName, closedText);
    // En su semana de origen no dice que viene de otra.
    await expect(page.getByText(/viene de la semana del/i)).toHaveCount(0);

    // --- En la semana actual aparece, con su semana de origen a la vista ---
    await page.getByRole('button', { name: /semana actual/i }).click();
    await expect(page.getByText(carriedText)).toBeVisible();
    await expect(page.getByText(/viene de la semana del/i)).toHaveCount(2);

    // --- Una arrastrada cerrada esta semana sigue a la vista: si no, cerrarla
    // la haría desaparecer y el avance nunca la contaría ---
    await statusOf(page, closedText).click();
    await page.getByRole('option', { name: /^hecha$/i }).click();
    await expect(statusOf(page, closedText)).toHaveText(/^hecha$/i);
    await page.reload();
    await expect(page.getByText(closedText)).toBeVisible();

    // --- Y la card cuenta la cerrada como avance, y la abierta aparte ---
    await page.goto(projectUrl);
    const card = goalsCard(page);
    await expect(card.getByText('1 / 2', { exact: true })).toBeVisible();
    await expect(card.getByText(/1 arrastrada de semanas anteriores/i)).toBeVisible();
    await expect(card.getByText(carriedText)).toBeVisible();
    await expect(card.getByText(closedText)).toHaveCount(0);

    // --- Descartada: deja de arrastrarse, pero sigue en su semana ---
    await page.goto(`${projectUrl}/personal?tab=board`);
    await statusOf(page, carriedText).click();
    await page.getByRole('option', { name: /^descartada$/i }).click();
    await expect(page.getByText(carriedText)).toHaveCount(0);

    await page.getByRole('button', { name: /semana anterior/i }).click();
    await expect(page.getByText(carriedText)).toBeVisible();
    await expect(statusOf(page, carriedText)).toHaveText(/^descartada$/i);

    // En la card sólo queda la cerrada: la descartada no cuenta para el total.
    await page.goto(projectUrl);
    await expect(card.getByText('1 / 1', { exact: true })).toBeVisible();
    await expect(card.getByText(/semana al día/i)).toBeVisible();
  });

  test('la card avisa si hoy falta gente y lleva a la Jornada', async ({ page }) => {
    const workerName = `Caro Falta ${RUN_ID}`;
    const activityName = `Encofrado ${RUN_ID}`;
    const projectUrl = await startProject(page, 'missing');

    // --- Una actividad vigente hoy ---
    await page.goto(`${projectUrl}/actividades`);
    const today = new Date();
    await page.getByRole('button', { name: /nueva actividad/i }).click();
    await page.locator('#activity-name').fill(activityName);
    await pickActivitySpecialty(page);
    await page.locator('#activity-start').fill(toDayKey(today));
    await page
      .locator('#activity-end')
      .fill(toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)));
    await pickActivityResponsible(page);
    await page.getByRole('button', { name: /crear actividad/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // --- Alguien asignado a esa actividad, que hoy no vino ---
    await page.goto(`${projectUrl}/personal`);
    await addCrewMember(page, { name: workerName });
    const activityCard = page.locator('section', { hasText: activityName });
    await activityCard.getByRole('button', { name: /asignar personal/i }).click();
    await activityCard.getByRole('combobox').last().click();
    await page.getByRole('option', { name: workerName }).click();
    await expect(activityCard.getByText(workerName)).toBeVisible();

    // --- La card del detalle lo dice, y el aviso lleva a la Jornada ---
    await page.goto(projectUrl);
    const missing = goalsCard(page).getByRole('link', { name: /falta 1 persona hoy/i });
    await expect(missing).toBeVisible();
    await missing.click();
    await expect(page).toHaveURL(/\/personal$/);
    await expect(page.getByRole('tab', { name: /^jornada$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

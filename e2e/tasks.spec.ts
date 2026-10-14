import { expect, test, type Page } from '@playwright/test';
import { appUrl, loginWith, registerWith } from './helpers/auth';
import { pickActivityResponsible, pickActivitySpecialty } from './helpers/activity';
import { addCrewMember, addTask, boardColumn, moveTask, taskCard } from './helpers/crew';

/**
 * Una tarea es UNA entidad: lo que se crea en el Tablero aparece en el
 * Cronograma, y lo que se planifica en el Cronograma aparece en el Tablero y
 * en la asistencia de la Jornada.
 *
 * Además: la card del detalle, el flujo de revisión en el Tablero, las
 * atrasadas, cancelar y restaurar, el filtro por persona y el celular.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';

function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Registra una cuenta nueva, crea una obra y deja la página en su detalle. */
async function startProject(page: Page, label: string): Promise<string> {
  const email = `e2e-tasks-${label}-${RUN_ID}@luma.test`;
  await registerWith(page, `Ejecutante ${label} ${RUN_ID}`, email, PASSWORD);
  await loginWith(page, email, PASSWORD);

  await page.goto(appUrl('/admin/proyectos/nuevo'));
  await page.locator('#name').fill(`Obra tareas ${label} ${RUN_ID}`);
  await page.locator('#description').fill('Obra para probar las tareas.');
  await page.locator('#location').fill('CABA');
  await page.locator('#estimatedStartDate').fill('2026-09-01');
  await page.locator('#estimatedEndDate').fill('2027-12-15');
  await page.locator('#currency').click();
  await page.getByRole('option', { name: 'ARS' }).click();
  await page.getByRole('button', { name: /crear obra/i }).click();
  await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
  return page.url();
}

/** Crea una tarea desde el Cronograma ("Nueva tarea"). */
async function planTask(
  page: Page,
  projectUrl: string,
  task: { name: string; start: string; end: string; responsible?: RegExp },
) {
  await page.goto(`${projectUrl}/actividades`);
  await page.getByRole('button', { name: /nueva tarea/i }).click();
  await page.locator('#activity-name').fill(task.name);
  await pickActivitySpecialty(page);
  await page.locator('#activity-start').fill(task.start);
  await page.locator('#activity-end').fill(task.end);
  await pickActivityResponsible(page, task.responsible);
  await page.getByRole('button', { name: /crear tarea/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** La card de tareas del detalle de la obra. */
function tasksCard(page: Page) {
  return page.locator('[data-slot="card"]').filter({ hasText: /tareas de la semana/i });
}

function cardIn(page: Page, column: RegExp, name: string) {
  return boardColumn(page, column).getByRole('article', { name });
}

test.describe('tareas', () => {
  test('una sola entidad: Tablero, Cronograma y Jornada ven la misma tarea', async ({
    page,
  }) => {
    const worker = `Ana Tareas ${RUN_ID}`;
    const boardTask = `Limpiar el obrador ${RUN_ID}`;
    const plannedTask = `Revocar el tanque ${RUN_ID}`;
    const projectUrl = await startProject(page, 'entity');

    // --- La card ofrece cargar personal, y después dice que no hay tareas ---
    const card = tasksCard(page);
    await expect(card.getByText(/todavía no cargaste personal de obra/i)).toBeVisible();
    await card.getByRole('button', { name: /^agregar personal$/i }).click();
    const drawer = page.getByRole('dialog');
    await drawer.locator('#add-crew-name').fill(worker);
    await drawer.getByRole('button', { name: /crear y sumar a la obra/i }).click();
    await expect(drawer).toBeHidden();
    await expect(card.getByText(/no hay tareas para esta semana/i)).toBeVisible();

    // --- "Ver todo" lleva al Tablero ---
    await card.getByRole('link', { name: /ver todo/i }).click();
    await expect(page).toHaveURL(/\/personal$/);
    await expect(page.getByRole('tab', { name: /^tablero$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // --- Creada en el Tablero → está en el Cronograma ---
    await addTask(page, worker, boardTask);
    await page.goto(`${projectUrl}/actividades`);
    await expect(page.getByRole('gridcell', { name: boardTask, exact: true })).toBeVisible();

    // --- Planificada en el Cronograma → está en el Tablero y en la Jornada ---
    await planTask(page, projectUrl, {
      name: plannedTask,
      start: dayKey(),
      end: dayKey(),
      responsible: new RegExp(worker, 'i'),
    });
    await page.goto(`${projectUrl}/personal`);
    await expect(cardIn(page, /^pendiente$/i, plannedTask)).toContainText(worker);

    await page.getByRole('tab', { name: /^jornada$/i }).click();
    // Nació con la responsable en la cuadrilla: aparece esperada hoy.
    await expect(page.locator('section', { hasText: plannedTask })).toContainText(worker);

    // --- La card cuenta las dos ---
    await page.goto(projectUrl);
    await expect(card.getByText('0 / 2', { exact: true })).toBeVisible();
    await expect(card.getByText(boardTask)).toBeVisible();
    await expect(card.getByText(plannedTask)).toBeVisible();

    // --- Flujo: en revisión → aprobada; y la otra, completada directo ---
    await page.goto(`${projectUrl}/personal`);
    await moveTask(page, boardTask, /mover a en revisión/i);
    await expect(cardIn(page, /^en revisión$/i, boardTask)).toBeVisible();
    await moveTask(page, boardTask, /^aprobar$/i);
    await expect(cardIn(page, /^completada$/i, boardTask)).toBeVisible();
    await moveTask(page, plannedTask, /mover a completada/i);
    await expect(cardIn(page, /^completada$/i, plannedTask)).toBeVisible();

    await page.goto(projectUrl);
    await expect(card.getByText(/semana al día/i)).toBeVisible();
    await expect(card.getByText('2 / 2', { exact: true })).toBeVisible();
  });

  test('el gerente devuelve una tarea con motivo desde el Tablero', async ({ page }) => {
    const worker = `Beto Devuelta ${RUN_ID}`;
    const task = `Pintar el zócalo ${RUN_ID}`;
    const projectUrl = await startProject(page, 'reject');

    await page.goto(`${projectUrl}/personal`);
    await addCrewMember(page, { name: worker });
    await addTask(page, worker, task);
    await moveTask(page, task, /mover a en revisión/i);

    await moveTask(page, task, /^devolver$/i);
    const dialog = page.getByRole('dialog');
    await dialog.locator('#board-reject-reason').fill('Falta la segunda mano');
    await dialog.getByRole('button', { name: /devolver con este motivo/i }).click();
    await expect(dialog).toBeHidden();

    await expect(cardIn(page, /^en curso$/i, task)).toContainText(
      /devuelta: falta la segunda mano/i,
    );
  });

  test('lo atrasado aparece en la semana actual; cancelar y restaurar', async ({ page }) => {
    const worker = `Caro Atrasada ${RUN_ID}`;
    const lateTask = `Sellar la losa ${RUN_ID}`;
    const projectUrl = await startProject(page, 'late');

    await page.goto(`${projectUrl}/personal`);
    await addCrewMember(page, { name: worker });

    // Vencida la semana pasada y nunca cerrada.
    await planTask(page, projectUrl, {
      name: lateTask,
      start: dayKey(-10),
      end: dayKey(-8),
      responsible: new RegExp(worker, 'i'),
    });

    // --- Aparece en la semana actual, marcada como atrasada ---
    await page.goto(`${projectUrl}/personal`);
    await expect(cardIn(page, /^pendiente$/i, lateTask)).toContainText(/atrasada/i);

    await page.goto(projectUrl);
    await expect(tasksCard(page).getByText(/^1 atrasada$/i)).toBeVisible();

    // --- Arrastrando con el mouse ---
    await page.goto(`${projectUrl}/personal`);
    await taskCard(page, lateTask).dragTo(boardColumn(page, /^en curso$/i));
    await expect(cardIn(page, /^en curso$/i, lateTask)).toBeVisible();

    // --- Cancelada: deja de estar en la semana actual ---
    await moveTask(page, lateTask, /cancelar tarea/i);
    await expect(page.getByRole('article', { name: lateTask })).toHaveCount(0);

    // --- En su semana sigue, aparte, y se puede restaurar ---
    await page.getByRole('button', { name: /semana anterior/i }).click();
    await page.getByRole('button', { name: /ver canceladas \(1\)/i }).click();
    await moveTask(page, lateTask, /^restaurar$/i);
    await expect(cardIn(page, /^pendiente$/i, lateTask)).toBeVisible();
  });

  test('filtra por persona, y en el celular las columnas son pestañas', async ({ page }) => {
    const ana = `Ana Filtro ${RUN_ID}`;
    const luis = `Luis Filtro ${RUN_ID}`;
    const anaTask = `Pintar la fachada ${RUN_ID}`;
    const luisTask = `Cablear el tablero ${RUN_ID}`;
    const projectUrl = await startProject(page, 'filter');

    await page.goto(`${projectUrl}/personal`);
    await addCrewMember(page, { name: ana });
    await addCrewMember(page, { name: luis });
    await addTask(page, ana, anaTask);
    await addTask(page, luis, luisTask);

    // --- "¿Qué tiene fulano?" ---
    const filters = page.getByRole('group', { name: /filtrar por persona/i });
    await filters.getByRole('button', { name: ana }).click();
    await expect(taskCard(page, anaTask)).toBeVisible();
    await expect(page.getByRole('article', { name: luisTask })).toHaveCount(0);

    await filters.getByRole('button', { name: /^todos$/i }).click();
    await expect(taskCard(page, luisTask)).toBeVisible();

    await moveTask(page, luisTask, /mover a completada/i);
    await expect(cardIn(page, /^completada$/i, luisTask)).toBeVisible();

    // --- Celular: una columna a la vez, elegida por pestaña ---
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(taskCard(page, anaTask)).toBeVisible();
    await expect(taskCard(page, luisTask)).toBeHidden();
    await page.getByRole('tab', { name: /^completada \(1\)$/i }).click();
    await expect(taskCard(page, luisTask)).toBeVisible();
    await expect(taskCard(page, anaTask)).toBeHidden();
    // Sin scroll horizontal de la página.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('la card avisa si hoy falta gente y lleva a la Jornada', async ({ page }) => {
    const worker = `Dani Falta ${RUN_ID}`;
    const task = `Encofrado ${RUN_ID}`;
    const projectUrl = await startProject(page, 'missing');

    await page.goto(`${projectUrl}/personal`);
    await addCrewMember(page, { name: worker });

    // Una tarea vigente hoy, con esa persona en la cuadrilla, que no vino.
    await planTask(page, projectUrl, {
      name: task,
      start: dayKey(),
      end: dayKey(3),
      responsible: new RegExp(worker, 'i'),
    });

    await page.goto(projectUrl);
    const missing = tasksCard(page).getByRole('link', { name: /falta 1 persona hoy/i });
    await expect(missing).toBeVisible();
    await missing.click();
    await expect(page).toHaveURL(/\/personal\?tab=day$/);
    await expect(page.getByRole('tab', { name: /^jornada$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

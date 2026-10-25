import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { appUrl, loginWith, registerWith } from './helpers/auth';
import { pickActivityResponsible, pickActivitySpecialty } from './helpers/activity';
import { addCrewMember, addTask, boardColumn, moveTask, openBoard, taskCard } from './helpers/crew';
import { requiresApi } from './helpers/api';

/**
 * Una tarea es UNA entidad: lo que se crea en el Tablero aparece en el
 * Cronograma, y lo que se planifica en el Cronograma aparece en el Tablero y
 * en la asistencia de la Jornada.
 *
 * Además: la card del detalle, el flujo de revisión en el Tablero, las
 * atrasadas, cancelar y restaurar, el filtro por persona, los filtros
 * compartidos que se recuerdan y el celular.
 *
 * El Cronograma, el Tablero y la Lista son tres vistas de la misma pantalla
 * (Actividades); la Jornada vive aparte, en Personal.
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
async function startProject(
  page: Page,
  label: string,
  { start = '2026-09-01' }: { start?: string } = {},
): Promise<string> {
  const email = `e2e-tasks-${label}-${RUN_ID}@luma.test`;
  await registerWith(page, `Ejecutante ${label} ${RUN_ID}`, email, PASSWORD);
  await loginWith(page, email, PASSWORD);

  await page.goto(appUrl('/admin/proyectos/nuevo'));
  await page.locator('#name').fill(`Obra tareas ${label} ${RUN_ID}`);
  await page.locator('#description').fill('Obra para probar las tareas.');
  await page.locator('#location').fill('CABA');
  await page.locator('#estimatedStartDate').fill(start);
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

requiresApi();

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

    // --- "Ver todo" lleva al Tablero de Actividades ---
    await card.getByRole('link', { name: /ver todo/i }).click();
    await expect(page).toHaveURL(/\/actividades\?vista=tablero$/);
    await expect(page.getByRole('tab', { name: /^actividades$/i })).toHaveAttribute(
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
    await openBoard(page, projectUrl);
    await expect(cardIn(page, /^pendiente$/i, plannedTask)).toContainText(worker);

    await page.goto(`${projectUrl}/personal`);
    // Nació con la responsable en la cuadrilla: aparece esperada hoy.
    await expect(page.locator('section', { hasText: plannedTask })).toContainText(worker);

    // --- La card cuenta las dos ---
    await page.goto(projectUrl);
    await expect(card.getByText('0 / 2', { exact: true })).toBeVisible();
    await expect(card.getByText(boardTask)).toBeVisible();
    await expect(card.getByText(plannedTask)).toBeVisible();

    // --- Flujo: en revisión → aprobada; y la otra, completada directo ---
    await openBoard(page, projectUrl);
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
    await openBoard(page, projectUrl);
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
    await openBoard(page, projectUrl);
    await expect(cardIn(page, /^pendiente$/i, lateTask)).toContainText(/atrasada/i);

    await page.goto(projectUrl);
    await expect(tasksCard(page).getByText(/^1 atrasada$/i)).toBeVisible();

    // --- Arrastrando con el mouse ---
    await openBoard(page, projectUrl);
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
    await openBoard(page, projectUrl);
    await addTask(page, ana, anaTask);
    await addTask(page, luis, luisTask);

    // --- "¿Qué tiene fulano?" Los filtros son los de toda la pantalla ---
    const people = page.getByRole('group', { name: /filtrar por responsable/i });
    await people.getByRole('button', { name: ana }).click();
    await expect(taskCard(page, anaTask)).toBeVisible();
    await expect(page.getByRole('article', { name: luisTask })).toHaveCount(0);

    await page.getByRole('button', { name: /^limpiar todo$/i }).click();
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

  test('los filtros valen para las tres vistas, se recuerdan y se avisa que hay alguno', async ({
    page,
  }) => {
    const onTime = `Armar el andamio ${RUN_ID}`;
    const late = `Cerrar la medianera ${RUN_ID}`;
    const projectUrl = await startProject(page, 'filters');

    await planTask(page, projectUrl, { name: onTime, start: dayKey(), end: dayKey(2) });
    await planTask(page, projectUrl, { name: late, start: dayKey(-10), end: dayKey(-8) });

    await page.goto(`${projectUrl}/actividades`);
    await expect(page.getByRole('gridcell', { name: onTime, exact: true })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: late, exact: true })).toBeVisible();
    // Sin filtros no hay aviso.
    await expect(page.getByTestId('activity-filters-notice')).toHaveCount(0);

    // --- Se pone un filtro: el aviso aparece y el Cronograma se recorta ---
    await page.getByTestId('activity-filters-button').click();
    await page.getByRole('checkbox', { name: /^atrasadas$/i }).click();
    await page.keyboard.press('Escape');
    const notice = page.getByTestId('activity-filters-notice');
    await expect(notice).toContainText(/1 filtro activo/i);
    await expect(page.getByRole('gridcell', { name: late, exact: true })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: onTime, exact: true })).toHaveCount(0);

    // --- El mismo recorte en la Lista ---
    await page.getByRole('tab', { name: /^lista$/i }).click();
    await expect(page).toHaveURL(/\/actividades\?vista=lista$/);
    await expect(page.getByRole('button', { name: late, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: onTime, exact: true })).toHaveCount(0);

    // --- Recargar no lo pierde: se recuerda en el navegador ---
    await page.reload();
    await expect(page.getByTestId('activity-filters-notice')).toContainText(/1 filtro activo/i);
    await expect(page.getByRole('button', { name: late, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: onTime, exact: true })).toHaveCount(0);

    // --- Un filtro que deja todo afuera lo dice, en vez de mostrar una obra vacía ---
    await page.getByTestId('activity-filters-button').click();
    await page.getByRole('checkbox', { name: /^completada$/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/nada coincide con los filtros/i)).toBeVisible();
    await expect(notice).toContainText(/2 filtros activos/i);

    // --- Limpiar todo vuelve a mostrar todo, y tampoco se recuerda ---
    await page.getByRole('button', { name: /^limpiar todo$/i }).click();
    await expect(page.getByTestId('activity-filters-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: onTime, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('activity-filters-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: late, exact: true })).toBeVisible();
  });

  test('cambiar las fechas de una actividad se refleja en el Cronograma y en el Tablero', async ({
    page,
  }) => {
    const task = `Hormigonar la losa ${RUN_ID}`;
    const projectUrl = await startProject(page, 'dates');

    // Planificada para dentro de seis semanas: el Cronograma la ve de lejos…
    await planTask(page, projectUrl, { name: task, start: dayKey(42), end: dayKey(44) });
    await page.goto(`${projectUrl}/actividades`);
    await expect(page.getByRole('gridcell', { name: task, exact: true })).toBeVisible();

    // …y el Tablero, que es de esta semana, todavía no la muestra.
    await openBoard(page, projectUrl);
    await expect(page.getByRole('region', { name: /kanban board/i })).toBeVisible();
    await expect(page.getByRole('article', { name: task })).toHaveCount(0);

    // --- Se adelanta a hoy desde su detalle ---
    await page.goto(`${projectUrl}/actividades`);
    await page.getByRole('gridcell', { name: task, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^editar$/i }).click();
    await page.locator('#edit-activity-start').fill(dayKey());
    await page.locator('#edit-activity-end').fill(dayKey());
    await page.getByRole('button', { name: /^guardar$/i }).click();
    await expect(page.locator('#edit-activity-start')).toBeHidden();

    // --- Ahora está en las dos: la misma actividad, una sola vez ---
    await openBoard(page, projectUrl);
    await expect(cardIn(page, /^pendiente$/i, task)).toBeVisible();
    await page.goto(`${projectUrl}/actividades`);
    await expect(page.getByRole('gridcell', { name: task, exact: true })).toHaveCount(1);

    // --- Y a la inversa: lo que se mueve en el Tablero se ve en el Cronograma ---
    await openBoard(page, projectUrl);
    await moveTask(page, task, /mover a en curso/i);
    await expect(cardIn(page, /^en curso$/i, task)).toBeVisible();
    await page.goto(`${projectUrl}/actividades?vista=lista`);
    await expect(
      page.locator('section', { hasText: /^en curso/i }).getByRole('button', { name: task, exact: true }),
    ).toBeVisible();
  });

  test('el Cronograma abre con meses enteros: una obra que arranca el 31 no deja un mes de un día', async ({
    page,
  }) => {
    const task = `Replanteo ${RUN_ID}`;
    const projectUrl = await startProject(page, 'month', { start: '2026-07-31' });

    await planTask(page, projectUrl, { name: task, start: '2026-08-03', end: '2026-08-07' });
    await page.goto(`${projectUrl}/actividades`);
    await page.getByRole('radio', { name: /^días$/i }).click();
    // El diagrama abre en "hoy" (con un scroll animado que tarda un par de cuadros) y la
    // escala sólo dibuja lo visible: se vuelve al principio hasta que el scroll se quede.
    const firstMonth = page.locator('.wx-scale .wx-row').first().locator('.wx-cell').first();
    await expect
      .poll(async () => {
        await page.evaluate(() => {
          const chart = document.querySelector('.wx-chart');
          if (chart) chart.scrollLeft = 0;
        });
        return (await firstMonth.textContent()) ?? '';
      })
      .toMatch(/julio 2026/i);

    // El primer mes de la escala es julio entero (31 días de 32px), no sólo el 31.
    const width = (await firstMonth.boundingBox())?.width ?? 0;
    expect(width).toBeGreaterThanOrEqual(31 * 32 - 2);
  });

  test('la Lista descarga las actividades del día en un PDF tamaño carta', async ({ page }) => {
    const today = `Colar la platea ${RUN_ID}`;
    const later = `Pintar el frente ${RUN_ID}`;
    const projectUrl = await startProject(page, 'daypdf');

    await planTask(page, projectUrl, { name: today, start: dayKey(-1), end: dayKey(2) });
    await planTask(page, projectUrl, { name: later, start: dayKey(10), end: dayKey(12) });

    await page.goto(`${projectUrl}/actividades?vista=lista`);
    // Sólo cuenta la de hoy: la otra empieza dentro de diez días.
    const button = page.getByRole('button', { name: /descargar actividades de hoy/i });
    await expect(button).toBeEnabled();
    await expect(button).toContainText('1');

    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toMatch(/^actividades-.+-\d{4}-\d{2}-\d{2}\.pdf$/);

    // Es un PDF, en tamaño carta (612 × 792 pt), con la actividad de hoy y sin la otra.
    const file = await download.path();
    const pdf = fs.readFileSync(file).toString('latin1');
    expect(pdf.startsWith('%PDF')).toBe(true);
    expect(pdf).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+612\.?0*\s+792\.?0*\s*\]/);
    expect(pdf).toContain(today);
    expect(pdf).not.toContain(later);
  });

  test('al soltar una tarjeta en otra columna no desaparece ni vuelve un instante a la de origen', async ({
    page,
  }) => {
    const name = `Tarjeta que se mueve ${RUN_ID}`;
    // Atrasada a propósito: es el caso que se perdía. Una tarea vencida que se pasa a
    // Completada ya no cae en la semana ni está abierta, y salía del Tablero al soltarla.
    const projectUrl = await startProject(page, 'dnd');
    await planTask(page, projectUrl, { name, start: dayKey(-12), end: dayKey(-9) });

    await openBoard(page, projectUrl);
    const card = cardIn(page, /^pendiente$/i, name);
    await expect(card).toBeVisible();

    const from = (await card.boundingBox())!;
    const to = (await boardColumn(page, /^completada$/i).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 30, from.y + from.height / 2 + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });

    // Se muestrea cuadro a cuadro desde antes de soltar: una vez que desaparece el fantasma
    // de arrastre la tarjeta no puede volver a verse en la columna de origen.
    const sampling = page.evaluate(async (title) => {
      let ghostGone = false;
      let backInOrigin = 0;
      const start = performance.now();
      while (performance.now() - start < 2000) {
        const ghost = !!document.querySelector('.wx-ghost');
        if (ghost) ghostGone = false;
        else if (!ghostGone && performance.now() - start > 300) ghostGone = true;
        if (ghostGone) {
          backInOrigin += document.querySelectorAll(
            `[data-kanban-column-cards=":pendiente"] article[aria-label="${title}"]`,
          ).length;
        }
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      }
      return backInOrigin;
    }, name);
    await page.waitForTimeout(350);
    await page.mouse.up();

    expect(await sampling, 'la tarjeta volvió a la columna de origen después de soltarla').toBe(0);
    // Y sigue a la vista cuando llega la respuesta de la API y se vuelve a pedir la lista.
    await expect(cardIn(page, /^completada$/i, name)).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(cardIn(page, /^completada$/i, name)).toBeVisible();
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
    await expect(page).toHaveURL(/\/personal$/);
    await expect(page.getByText(/^presentes$/i)).toBeVisible();
  });
});

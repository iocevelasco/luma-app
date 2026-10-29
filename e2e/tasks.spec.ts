import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
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

/** Crea una tarea desde la pantalla de Actividades en la que ya se está ("Nueva tarea"). */
async function createTask(
  page: Page,
  task: { name: string; start: string; end: string; responsible?: RegExp },
) {
  await page.getByRole('button', { name: /nueva tarea/i }).click();
  await page.locator('#activity-name').fill(task.name);
  await pickActivitySpecialty(page);
  await page.locator('#activity-start').fill(task.start);
  await page.locator('#activity-end').fill(task.end);
  await pickActivityResponsible(page, task.responsible);
  await page.getByRole('button', { name: /crear tarea/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** Abre Actividades y crea una tarea. */
async function planTask(
  page: Page,
  projectUrl: string,
  task: { name: string; start: string; end: string; responsible?: RegExp },
) {
  await page.goto(`${projectUrl}/actividades`);
  await createTask(page, task);
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

  test('el aviso de filtros no tapa lo último del Cronograma ni del Tablero', async ({ page }) => {
    // Arma una cuenta y una obra, y recorre dos vistas en dos tamaños de pantalla.
    test.setTimeout(60_000);
    const task = `Armar el encofrado ${RUN_ID}`;
    const projectUrl = await startProject(page, 'noticegap');
    await planTask(page, projectUrl, { name: task, start: dayKey(), end: dayKey(2) });

    // Un filtro que deja la tarea a la vista y hace que aparezca el aviso, que flota abajo a
    // la izquierda. El Cronograma y el Tablero ocupan el alto de la ventana: sin lugar
    // reservado, el aviso queda encima de su última fila.
    await page.goto(`${projectUrl}/actividades`);
    await page.getByPlaceholder(/buscar/i).fill(task);
    const pill = page.getByTestId('activity-filters-notice').locator('div').first();
    await expect(pill).toBeVisible();

    /** El aviso tiene que quedar por debajo del contenido, sin pisarlo ni un píxel. */
    async function expectNoticeBelow(content: Locator) {
      await expect(content).toBeVisible();
      // En el celular la pantalla scrollea (dentro de un contenedor, no de la ventana):
      // lo que importa es cómo queda el contenido al llegar al final.
      await content.evaluate((element) => {
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
          if (node.scrollHeight > node.clientHeight) node.scrollTop = node.scrollHeight;
        }
      });
      const notice = (await pill.boundingBox())!;
      const above = (await content.boundingBox())!;
      expect(above.y + above.height, 'el aviso de filtros tapa el final del contenido').toBeLessThanOrEqual(
        notice.y + 0.5,
      );
    }

    await expectNoticeBelow(page.locator('.luma-gantt'));

    await openBoard(page, projectUrl);
    await expect(pill).toBeVisible();
    await expectNoticeBelow(page.locator('.luma-kanban'));

    // Celular: ahí sólo el Cronograma ocupa el alto de la ventana.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${projectUrl}/actividades`);
    await expect(pill).toBeVisible();
    await expectNoticeBelow(page.locator('.luma-gantt'));
  });

  test('el Cronograma llega al borde y «Nueva tarea» no tapa la última fila', async ({ page }) => {
    test.setTimeout(60_000);
    const task = `Colocar el contrapiso ${RUN_ID}`;
    const projectUrl = await startProject(page, 'actiongap');
    await planTask(page, projectUrl, { name: task, start: dayKey(), end: dayKey(2) });

    /**
     * El diagrama ocupa el alto que queda (sin un hueco abajo) y, scrolleado hasta el
     * final, su última tarea queda por encima del botón flotante: el aire está dentro
     * del scroll, no afuera.
     */
    async function expectLastRowAboveAction() {
      await page.goto(`${projectUrl}/actividades`);
      const gantt = page.locator('.luma-gantt');
      const action = page.getByTestId('primary-action');
      await expect(gantt).toBeVisible();
      await expect(action).toBeVisible();
      // En el celular la pantalla scrollea (dentro de un contenedor, no de la ventana):
      // lo que importa es cómo queda el diagrama al llegar al final.
      await gantt.evaluate((element) => {
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
          if (node.scrollHeight > node.clientHeight) node.scrollTop = node.scrollHeight;
        }
      });

      const chart = (await gantt.boundingBox())!;
      const main = (await page.locator('main').boundingBox())!;
      // Sin un hueco grande abajo: el diagrama termina a pocos píxeles del borde del área.
      // En el celular `<main>` reserva su propio relleno (`pb-24`), así que sólo se mide en escritorio.
      if ((page.viewportSize()?.width ?? 0) >= 768) {
        expect(
          main.y + main.height - (chart.y + chart.height),
          'el diagrama deja un hueco abajo',
        ).toBeLessThanOrEqual(24);
      }

      // La fila de la tarea, la última real, queda por encima del botón.
      const row = (await page.getByRole('gridcell', { name: task, exact: true }).boundingBox())!;
      const button = (await action.boundingBox())!;
      expect(row.y + row.height, 'el botón flotante tapa la última fila').toBeLessThanOrEqual(
        button.y + 0.5,
      );
    }

    await expectLastRowAboveAction();

    // Celular: el botón se apoya más cerca del borde, pero el diagrama también ocupa todo el alto.
    await page.setViewportSize({ width: 375, height: 812 });
    await expectLastRowAboveAction();
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

  test.describe('el diagrama del Cronograma', () => {
    /** La columna de hoy, que sólo se dibuja en la escala de días y sólo si está a la vista. */
    const todayColumn = (page: Page) => page.locator('.luma-gantt-today');

    /** Desplaza el diagrama al origen: lo más lejos de hoy que se puede estar. */
    async function scrollToStart(page: Page) {
      await page.evaluate(() => {
        const chart = document.querySelector('.wx-chart');
        if (chart) chart.scrollLeft = 0;
      });
    }

    const scrollLeft = (page: Page) =>
      page.evaluate(() => document.querySelector('.wx-chart')?.scrollLeft ?? -1);

    // La obra arranca dos meses atrás: hoy queda lejos del origen en cualquier zoom.
    async function openGantt(page: Page, label: string) {
      const projectUrl = await startProject(page, label, { start: dayKey(-60) });
      await planTask(page, projectUrl, {
        name: `Tarea ${label} ${RUN_ID}`,
        start: dayKey(0),
        end: dayKey(5),
      });
      await page.goto(`${projectUrl}/actividades`);
      await page.getByRole('radio', { name: /^días$/i }).click();
      await expect(todayColumn(page).first()).toBeVisible();
      return projectUrl;
    }

    test('"Ir a hoy" vuelve a la fecha de hoy desde cualquier parte del diagrama', async ({
      page,
    }) => {
      await openGantt(page, 'irhoy');

      await scrollToStart(page);
      await expect(todayColumn(page)).toHaveCount(0);

      await page.getByRole('button', { name: /ir a hoy/i }).click();
      await expect(todayColumn(page).first()).toBeVisible();
    });

    test('cambiar el zoom recentra en hoy: el scroll es en píxeles y cada escala los mide distinto', async ({
      page,
    }) => {
      await openGantt(page, 'zoom');

      // Meses y Trimestres no dibujan la columna de hoy: se mira que el scroll no haya
      // quedado en el origen ni pegado al final, que era dónde terminaba.
      const centred = () =>
        page.evaluate(() => {
          const chart = document.querySelector('.wx-chart');
          if (!chart) return false;
          const end = chart.scrollWidth - chart.clientWidth;
          return chart.scrollLeft > 50 && chart.scrollLeft < end - 50;
        });
      for (const zoom of [/^meses$/i, /^trimestres$/i]) {
        await page.getByRole('radio', { name: zoom }).click();
        await expect.poll(centred).toBe(true);
      }

      await page.getByRole('radio', { name: /^semanas$/i }).click();
      await page.getByRole('radio', { name: /^días$/i }).click();
      await expect(todayColumn(page).first()).toBeVisible();
    });

    test('la etiqueta del mes se esconde mientras no entra en lo que queda a la vista, en vez de verse cortada', async ({
      page,
    }) => {
      await openGantt(page, 'monthlabel');

      // Por cada mes de la escala: ¿se ve la etiqueta?, ¿cuánto de su celda queda dentro del
      // área que desplaza?, ¿cuánto mide el texto? Depende de clases internas de la librería.
      const months = () =>
        page.evaluate(() => {
          const area = document.querySelector('.wx-chart')!.getBoundingClientRect();
          return [...document.querySelectorAll<HTMLElement>('.wx-scale .wx-row:first-child .wx-cell')]
            .map((cell) => {
              const label = cell.querySelector<HTMLElement>('.wx-cell-value');
              const box = cell.getBoundingClientRect();
              return {
                found: !!label,
                hidden: label?.style.visibility === 'hidden',
                visible: Math.min(box.right, area.right) - Math.max(box.left, area.left),
                needed: label ? label.scrollWidth + 8 : 0,
              };
            })
            .filter((month) => month.found);
        });

      // Se desplaza de a poco: en algún momento un mes queda con un cacho a la vista.
      let cut = 0;
      for (let step = 0; step < 40; step += 1) {
        await page.evaluate(() => {
          document.querySelector('.wx-chart')!.scrollLeft += 80;
        });
        await page.waitForTimeout(60);
        const current = await months();
        expect(current.length, 'no se encontró la etiqueta del mes: ¿cambió el DOM de la librería?')
          .toBeGreaterThan(0);
        for (const month of current) {
          // Se esconde si y sólo si no entra.
          expect(month.hidden).toBe(month.visible < month.needed);
          if (month.visible > 0 && month.visible < month.needed) cut += 1;
        }
      }
      expect(cut, 'nunca quedó un mes a medias: el recorrido no probó nada').toBeGreaterThan(0);
    });

    test('que crezca el rango no devuelve el diagrama a hoy mientras se mira otra parte', async ({
      page,
    }) => {
      await openGantt(page, 'rango');
      await scrollToStart(page);
      await expect(todayColumn(page)).toHaveCount(0);

      // Una tarea fuera de las fechas de la obra estira el rango del diagrama.
      const far = `Tarea lejana ${RUN_ID}`;
      await createTask(page, { name: far, start: '2028-02-01', end: '2028-02-10' });
      await expect(page.getByRole('gridcell', { name: far, exact: true })).toBeVisible();

      // Con el efecto anterior el salto a hoy corría a los dos cuadros de cambiar el
      // rango; un segundo es un margen enorme, y es la única forma de afirmar
      // que algo NO pasó.
      await page.waitForTimeout(1_000);
      expect(await scrollLeft(page)).toBe(0);
      await expect(todayColumn(page)).toHaveCount(0);
    });
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

  test('si la API rechaza el movimiento, la tarjeta vuelve a su columna y se avisa', async ({
    page,
  }) => {
    const name = `Tarjeta rechazada ${RUN_ID}`;
    const projectUrl = await startProject(page, 'rollback');
    await planTask(page, projectUrl, { name, start: dayKey(0), end: dayKey(2) });

    await openBoard(page, projectUrl);
    const card = cardIn(page, /^pendiente$/i, name);
    await expect(card).toBeVisible();

    // El PATCH de la actividad se corta. El Tablero deja pasar el soltar (la librería ya
    // acomoda la tarjeta en la columna nueva), así que volver a la de origen depende de
    // que la reversión de la caché llegue hasta la librería.
    let attempts = 0;
    await page.route(/\/api\/projects\/[a-f0-9]+\/activities\/[a-f0-9]+$/, (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      attempts += 1;
      return route.abort('failed');
    });

    const from = (await card.boundingBox())!;
    const to = (await boardColumn(page, /^en curso$/i).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 30, from.y + from.height / 2 + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });
    await page.mouse.up();

    await expect.poll(() => attempts, 'no se llegó a pedir el cambio').toBeGreaterThan(0);
    // Una falla sin formulario detrás va por toast, no por banner.
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
    await expect(cardIn(page, /^pendiente$/i, name)).toBeVisible();
    await expect(cardIn(page, /^en curso$/i, name)).toHaveCount(0);

    // Y se queda ahí cuando llega la lista que se vuelve a pedir.
    await page.waitForTimeout(1_000);
    await expect(cardIn(page, /^pendiente$/i, name)).toBeVisible();
    await expect(cardIn(page, /^en curso$/i, name)).toHaveCount(0);
  });

  test('el Tablero muestra el ícono y el nombre del estado en el encabezado de cada columna', async ({
    page,
  }) => {
    // El ícono va en el `label` de la columna, que la librería tipa como texto pero dibuja
    // tal cual: es lo que se rompería si una actualización cambiara cómo lo usa.
    const projectUrl = await startProject(page, 'columnheads');
    await openBoard(page, projectUrl);

    const titles = page.locator('.wx-column-header .wx-title');
    await expect(titles).toHaveText([/^pendiente$/i, /^en curso$/i, /^en revisión$/i, /^completada$/i]);
    await expect(titles.locator('svg')).toHaveCount(4);
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

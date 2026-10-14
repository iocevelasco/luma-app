import { expect, type Page } from '@playwright/test';

/**
 * Suma personal a la obra abierta desde el drawer "Agregar personal" de la
 * pantalla Personal. Crea en la libreta de la Empresa y lo deja asignado.
 *
 * Los specs que necesitan gente para trabajar —asistencia, metas— no
 * deberían saber cómo es el formulario.
 */
export async function addCrewMember(
  page: Page,
  member: {
    name: string;
    phone?: string;
    kind?: RegExp;
    specialty?: RegExp;
    isLead?: boolean;
  },
) {
  await page.getByRole('button', { name: /^agregar personal$/i }).click();
  const drawer = page.getByRole('dialog');

  await drawer.locator('#add-crew-name').fill(member.name);
  if (member.kind) {
    await drawer.locator('#add-crew-kind').click();
    await page.getByRole('option', { name: member.kind }).click();
  }
  if (member.specialty) {
    await drawer.locator('#add-crew-specialty').click();
    await page.getByRole('option', { name: member.specialty }).click();
  }
  if (member.phone) await drawer.locator('#add-crew-phone').fill(member.phone);
  if (member.isLead) await drawer.getByText(/es el encargado de su especialidad/i).click();

  await drawer.getByRole('button', { name: /crear y sumar a la obra/i }).click();
  await expect(drawer).toBeHidden();
}

/** Una columna del Tablero de tareas, por su título ("Pendiente", "En curso", "En revisión", "Completada"). */
export function boardColumn(page: Page, title: RegExp) {
  return page.getByRole('region', { name: title });
}

/** La tarjeta de una tarea en el Tablero. */
export function taskCard(page: Page, name: string) {
  return page.getByRole('article', { name });
}

/**
 * Crea una tarea desde el alta rápida de la columna Pendiente, para la semana
 * que muestra el Tablero. El alta queda abierta después de guardar: si ya lo
 * está, la reusa. `until` es la fecha de fin (`YYYY-MM-DD`); sin ella, dura un
 * día.
 */
export async function addTask(page: Page, assignee: string, name: string, until?: string) {
  const input = page.locator('#board-task-name');
  if (!(await input.isVisible())) {
    await boardColumn(page, /^pendiente$/i).getByRole('button', { name: /nueva tarea/i }).click();
  }
  await input.fill(name);
  await page.locator('#board-task-assignee').click();
  await page.getByRole('option', { name: new RegExp(assignee, 'i') }).click();
  if (until) await page.locator('#board-task-end').fill(until);
  await page.getByRole('button', { name: /^crear$/i }).click();
  await expect(taskCard(page, name)).toBeVisible();
}

/**
 * Mueve una tarea desde el menú de su tarjeta — el camino que funciona en el
 * celular. `action` es el ítem del menú: /mover a completada/, /aprobar/,
 * /cancelar tarea/, etc.
 */
export async function moveTask(page: Page, name: string, action: RegExp) {
  await taskCard(page, name).getByRole('button', { name: /acciones de la tarea/i }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

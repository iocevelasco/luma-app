import { MAX_PROJECT_MANAGERS, projectManagerSlots } from '@luma/shared';
import type { IProject } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { conflict } from '../utils/errors.js';

/**
 * El tope de gerentes por obra (`MAX_PROJECT_MANAGERS`, contando al dueño).
 *
 * Se cuenta, no se guarda: el dueño es `Project.createdBy` y no tiene fila, y
 * los demás son filas de `ProjectMembership` con `role: 'gerente'`. Un contador
 * guardado en la obra sería un número más que puede no coincidir con la lista.
 */

const FULL_MESSAGE =
  `La obra ya tiene ${MAX_PROJECT_MANAGERS} gerentes, que es el máximo. ` +
  'Sacá a uno para sumar otro.';

/** Cuántos gerentes tiene la obra hoy, el dueño incluido. */
export async function countProjectManagers(project: IProject): Promise<number> {
  const invited = await ProjectMembership.countDocuments({
    project: project._id,
    role: 'gerente',
  });
  return 1 + invited;
}

/** Corta antes de crear nada si ya no entra otro gerente. */
export async function assertManagerSlotFree(project: IProject): Promise<void> {
  const slots = projectManagerSlots(await countProjectManagers(project));
  if (slots.isFull) throw conflict(FULL_MESSAGE, { managers: slots.count, max: slots.max });
}

/**
 * Se llama **después** de haber guardado al gerente nuevo y vuelve a contar.
 *
 * No hay transacciones en el repo, así que el chequeo previo no alcanza: dos
 * invitaciones que llegan juntas ven las dos "queda un lugar" y entran las
 * dos. Acá la que se pasó del tope se deshace sola (`undo`) y falla con el
 * mismo 409. En una carrera pueden perder las dos, pero nunca ganar las dos.
 */
export async function confirmManagerSlot(
  project: IProject,
  undo: () => Promise<unknown>,
): Promise<void> {
  const count = await countProjectManagers(project);
  if (count <= MAX_PROJECT_MANAGERS) return;

  await undo();
  throw conflict(FULL_MESSAGE, { managers: MAX_PROJECT_MANAGERS, max: MAX_PROJECT_MANAGERS });
}

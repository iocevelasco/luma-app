/**
 * El rango con el que abre el Cronograma: toda la obra y, además, cualquier
 * tarea que se haya corrido fuera de las fechas estimadas.
 *
 * Con sólo las fechas de la obra, una tarea que termina después de la entrega
 * estimada —o empieza antes del inicio— no aparece nunca: el servidor filtra
 * por rango y el Gantt no la dibuja. Es justo la tarea atrasada, la que más
 * hace falta ver.
 *
 * Las fechas son `YYYY-MM-DD`: comparan bien como texto, sin pasar por `Date`
 * (y sin los problemas de zona horaria y de Safari que eso trae).
 */
export interface DayRange {
  from: string;
  to: string;
}

export function scheduleRange(
  project: { estimatedStartDate: string; estimatedEndDate: string },
  activities: ReadonlyArray<{ startDate: string; endDate: string }>,
): DayRange {
  let from = project.estimatedStartDate;
  let to = project.estimatedEndDate;

  for (const activity of activities) {
    if (activity.startDate < from) from = activity.startDate;
    if (activity.endDate > to) to = activity.endDate;
  }

  return { from, to };
}

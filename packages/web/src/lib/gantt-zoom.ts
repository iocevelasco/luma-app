/**
 * Cuánto se ve de la línea de tiempo del Cronograma: de cada día a cada
 * trimestre. Vive aparte de `activity-gantt.tsx` para que la pantalla de
 * Actividades pueda ofrecer el selector sin bajar la librería del diagrama.
 */
export type GanttZoom = 'days' | 'weeks' | 'months' | 'quarters';

export const GANTT_ZOOMS: readonly GanttZoom[] = ['days', 'weeks', 'months', 'quarters'];

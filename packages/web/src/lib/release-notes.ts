/**
 * Las novedades de Luma: lo nuevo y lo que se arregló, para quien usa la app.
 *
 * **Es un archivo y no una colección.** Lo escribe quien hace el cambio, en el
 * mismo PR, y sale con el deploy: una novedad que se publica antes de estar
 * desplegada anuncia algo que todavía no existe. Los textos van en i18n
 * (`releaseNotes.entries.<id>.<clave>`), en los tres idiomas — el test de
 * paridad y `release-notes.spec.ts` verifican que no falte ninguno.
 *
 * Una entrada por tanda de cambios, la más nueva **primero**. No toda versión
 * lleva entrada: la regla es que un cambio que una persona nota (un `minor`)
 * sí, y un arreglo interno no.
 */

import { CalendarRange, FireExtinguisher, Flag, Sparkles, Users, type LucideIcon } from 'lucide-react';

export type ReleaseNoteKind = 'new' | 'fix';

export interface ReleaseNoteItem {
  kind: ReleaseNoteKind;
  /** Clave bajo `releaseNotes.entries.<id>` en las traducciones (`title` y `description`). */
  key: string;
  /** El ícono de la tarjeta: se reconoce antes que el texto. */
  icon: LucideIcon;
}

export interface ReleaseNote {
  /** Único y estable: es lo que se guarda como "lo último que vio". */
  id: string;
  /** `YYYY-MM-DD`. Se lee con `fromDayKey`, nunca con `new Date(...)` (Safari y la zona horaria). */
  date: string;
  items: readonly ReleaseNoteItem[];
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    id: '2026-10-28',
    date: '2026-10-28',
    items: [
      { kind: 'new', key: 'managers', icon: Users },
      { kind: 'new', key: 'milestoneTypes', icon: Flag },
      { kind: 'new', key: 'fireProtection', icon: FireExtinguisher },
      { kind: 'new', key: 'whatsNew', icon: Sparkles },
      { kind: 'fix', key: 'lastTask', icon: CalendarRange },
    ],
  },
];

/** Cuántas entradas se muestran: más viejas que eso ya no le sirven a nadie. */
export const RELEASE_NOTES_SHOWN = 20;

/**
 * Las entradas que esta persona todavía no vio, de la más nueva a la más vieja.
 *
 * `lastSeenId` es la última entrada que vio. Si no hay (nunca abrió las
 * novedades) o ya no existe en la lista, **sólo la última cuenta como nueva**:
 * una cuenta recién creada no tiene que ver un punto por todo lo que pasó
 * antes de que existiera.
 */
export function unseenReleaseNotes(
  notes: readonly ReleaseNote[],
  lastSeenId: string | null,
): ReleaseNote[] {
  if (notes.length === 0) return [];
  const seenAt = lastSeenId === null ? -1 : notes.findIndex((note) => note.id === lastSeenId);
  return seenAt === -1 ? [notes[0]!] : notes.slice(0, seenAt);
}

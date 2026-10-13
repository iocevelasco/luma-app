import { normalizePersonName, type CrewDirectoryEntry, type CrewDuplicateDetails } from '@luma/shared';
import { isApiError } from './api-client';

/**
 * Lo que el drawer de alta necesita para no duplicar empleados: a quién
 * ofrecer mientras se tipea, y cómo leer el 409 cuando igual se intentó.
 */

/** Cuántas sugerencias como mucho: más que eso es una lista, no una sugerencia. */
export const CREW_SUGGESTION_LIMIT = 5;

/**
 * Empleados de la Empresa que coinciden con lo que se va tipeando.
 *
 * Cada palabra tipeada tiene que ser el comienzo de alguna palabra del
 * nombre: "juan pe" encuentra a "Juan Pérez", y "perez" también. Sin tildes
 * ni mayúsculas, con la MISMA normalización que usa el servidor para
 * bloquear.
 *
 * No es el guardia: el directorio sólo trae activos que todavía no están en
 * la obra, y el servidor además mira a los dados de baja y a los que ya
 * están acá. Lo que no aparece en la sugerencia todavía puede chocar al
 * crear, y para eso está el banner del 409.
 */
export function matchCrewDirectory(
  entries: CrewDirectoryEntry[],
  query: string,
  limit = CREW_SUGGESTION_LIMIT,
): CrewDirectoryEntry[] {
  const tokens = normalizePersonName(query).split(' ').filter(Boolean);
  if (tokens.join('').length < 2) return [];

  return entries
    .filter((entry) => {
      const words = normalizePersonName(entry.name).split(' ');
      return tokens.every((token) => words.some((word) => word.startsWith(token)));
    })
    .slice(0, limit);
}

/** El `details` de un 409 de duplicado, o `null` si el error es otra cosa. Ramifica por `code`, nunca por texto. */
export function crewDuplicateOf(error: unknown): CrewDuplicateDetails | null {
  if (!isApiError(error) || error.code !== 'CONFLICT') return null;

  const details = error.details as Partial<CrewDuplicateDetails> | undefined;
  if (!details?.existing || (details.reason !== 'name' && details.reason !== 'phone')) return null;

  return details as CrewDuplicateDetails;
}

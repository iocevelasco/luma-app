import type { LiveResource } from '@luma/shared';
import { QueryKeys } from '@/lib/query-keys';

/**
 * Qué queries de React Query invalida cada recurso en vivo.
 *
 * Un solo lugar y tipado contra `LiveResource`: sumar un recurso a `@luma/shared`
 * no compila hasta decir acá qué pantalla refresca.
 *
 * Todas las claves de obra son `[QueryKeys.X, projectId, ...]`, así que
 * invalidar por prefijo `[X, projectId]` alcanza a cada variante (filtros,
 * rangos). **Nunca** las fotos ni los archivos (`materialPhoto`,
 * `projectDocumentFile`): llevan el `projectId` en la clave pero pesan mucho y
 * no cambian por un aviso.
 *
 * Los efectos cruzados (borrar una actividad mueve Materiales) los resuelve el
 * servidor en `LIVE_WRITE_EFFECTS`: llega el aviso de los dos recursos.
 */
export const LIVE_QUERY_KEYS: Record<LiveResource, readonly QueryKeys[]> = {
  activities: [QueryKeys.activities],
  materials: [QueryKeys.materials],
};

/** Las claves completas a invalidar para estos recursos en esta obra. */
export function liveQueryKeysFor(
  resources: readonly LiveResource[],
  projectId: string,
): (readonly [QueryKeys, string])[] {
  return resources.flatMap((resource) =>
    LIVE_QUERY_KEYS[resource].map((key) => [key, projectId] as const),
  );
}

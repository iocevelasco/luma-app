import { matchPath, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';

/**
 * Toda ruta de `ROUTES` que tenga `:projectId`, derivada y no escrita a mano.
 *
 * Antes era una lista literal, y cada pantalla nueva de obra que alguien
 * agregaba se olvidaba de sumarse acá. El síntoma era desconcertante: en esa
 * pantalla desaparecían las pestañas del header y todo lo que depende de
 * `<Can>` quedaba escondido —no un error, sino una UI a la que simplemente le
 * faltaban cosas—. Derivarla hace que el olvido sea imposible.
 *
 * El orden importa: `PROJECT_DETAIL` es prefijo de todas las demás, así que va
 * último o se come cualquier subruta. Las más largas primero.
 */
const PROJECT_PATTERNS = Object.values(ROUTES)
  .filter((path) => path.includes(':projectId'))
  .sort((a, b) => b.length - a.length);

/**
 * `:projectId` de la URL activa, vía `matchPath` en vez de `useParams`.
 *
 * Pensado para componentes que cuelgan del header, que vive una sola vez
 * arriba del `Outlet` (ver dashboard-layout.tsx) — `useParams` sólo ve los
 * params de la rama de rutas por encima de donde se llama, y el header no
 * está adentro del `Outlet` que matchea `:projectId`. `matchPath` no depende
 * de la posición en el árbol: compara la URL actual contra el patrón de ruta
 * directamente.
 */
export function useCurrentProjectId(): string | undefined {
  const { pathname } = useLocation();
  for (const pattern of PROJECT_PATTERNS) {
    const match = matchPath(pattern, pathname);
    const candidate = match?.params.projectId;
    if (candidate && isProjectId(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Un `:projectId` de verdad es un ObjectId de Mongo: 24 hexadecimales.
 *
 * Sin este chequeo, `/admin/proyectos/nuevo` matchea `PROJECT_DETAIL` y el
 * header cree que `"nuevo"` es una obra: pide `GET /api/projects/nuevo`, come
 * un 404 y rompe la pantalla de alta — justo la que alguien abre cuando
 * todavía no tiene ninguna obra.
 *
 * Validar la forma del id y no mantener una lista de segmentos reservados
 * ("nuevo", y lo que venga después) es lo que hace que el próximo no reviva
 * el bug.
 */
function isProjectId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

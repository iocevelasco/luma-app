import { matchPath, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';

const PROJECT_PATTERNS = [
  ROUTES.PROJECT_DETAIL,
  ROUTES.PROJECT_ACTIVITIES,
  ROUTES.PROJECT_MATERIALS,
  ROUTES.PROJECT_LABOR,
  ROUTES.PROJECT_BUDGET,
  ROUTES.PROJECT_ADVISOR,
];

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
    if (match?.params.projectId) return match.params.projectId;
  }
  return undefined;
}

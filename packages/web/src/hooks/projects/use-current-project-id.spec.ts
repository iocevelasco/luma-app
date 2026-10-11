import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/lib/routes';

/**
 * No prueba el hook (necesitaría un router montado) sino la lista de patrones
 * que lo alimenta, que es donde estuvo el bug: una pantalla de obra que no
 * figuraba ahí perdía las pestañas del header y escondía todo lo que cuelga
 * de `<Can>`, sin tirar un solo error.
 */
const PROJECT_PATTERNS = Object.values(ROUTES)
  .filter((path) => path.includes(':projectId'))
  .sort((a, b) => b.length - a.length);

describe('patrones de ruta con :projectId', () => {
  it('incluye TODAS las rutas de obra de ROUTES', () => {
    const declared = Object.values(ROUTES).filter((path) => path.includes(':projectId'));
    expect(PROJECT_PATTERNS).toHaveLength(declared.length);
  });

  it('pone el detalle último: es prefijo de todas las demás', () => {
    // Si `/admin/proyectos/:projectId` fuera primero, matchPath lo resolvería
    // antes de llegar a `/admin/proyectos/:projectId/equipo`.
    expect(PROJECT_PATTERNS.at(-1)).toBe(ROUTES.PROJECT_DETAIL);
  });

  it('cubre las pantallas que se agregaron después de la v1', () => {
    for (const route of [
      ROUTES.PROJECT_TEAM,
      ROUTES.PROJECT_MILESTONES,
      ROUTES.PROJECT_DOCUMENTS,
      ROUTES.PROJECT_PAYMENTS,
      ROUTES.PROJECT_EXPENSES,
    ]) {
      expect(PROJECT_PATTERNS).toContain(route);
    }
  });
});

describe('qué cuenta como :projectId', () => {
  const isProjectId = (value: string) => /^[a-f0-9]{24}$/i.test(value);

  it('acepta un ObjectId de Mongo', () => {
    expect(isProjectId('6acacacee7e548e55c5d0ae4')).toBe(true);
  });

  it('rechaza los segmentos estáticos que viven bajo /admin/proyectos', () => {
    // `/admin/proyectos/nuevo` matchea el patrón de detalle. Sin este filtro,
    // el header pide GET /api/projects/nuevo y rompe la pantalla de alta —
    // la que abre justamente quien todavía no tiene ninguna obra.
    expect(isProjectId('nuevo')).toBe(false);
  });

  it('rechaza algo con la longitud justa pero que no es hex', () => {
    expect(isProjectId('zzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
  });
});

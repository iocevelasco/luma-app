import { useMemo } from 'react';
import type { Capability, ProjectRole } from '@luma/shared';
import { useProject } from './use-project-queries';

/**
 * Qué puede hacer quien está mirando, en esta obra.
 *
 * Capa 2 sobre `useProject`: las capacidades vienen resueltas por la API
 * contra la grilla de `@luma/shared/permissions`, con los flags de la obra ya
 * aplicados. El frontend **no las vuelve a derivar** — si las calculara de
 * nuevo a partir del rol, habría dos copias de la grilla y la que se
 * desincroniza es siempre la que decide qué botón se muestra.
 *
 * Esconder un botón no es un permiso: el gate que importa es el de la API
 * (`requireCapability`). Esto es sólo para no ofrecer una acción que va a
 * terminar en 403.
 *
 * ```tsx
 * const { can } = useProjectCapabilities(projectId);
 * {can('activity.plan') && <Button>Nueva actividad</Button>}
 * ```
 */
export function useProjectCapabilities(projectId: string | undefined) {
  const { data, isLoading } = useProject(projectId);

  const capabilities = useMemo(
    () => new Set<Capability>(data?.project.capabilities ?? []),
    [data?.project.capabilities],
  );

  return useMemo(
    () => ({
      role: data?.project.role as ProjectRole | undefined,
      capabilities,
      /**
       * Mientras la obra carga devuelve `false`: no sabemos todavía, y el
       * default correcto de un permiso es negar. Usá `isLoading` si querés
       * distinguir "no puede" de "todavía no sé".
       */
      can: (capability: Capability) => capabilities.has(capability),
      isLoading,
    }),
    [capabilities, data?.project.role, isLoading],
  );
}

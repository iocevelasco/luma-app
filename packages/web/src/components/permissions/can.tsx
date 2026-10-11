import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Capability } from '@luma/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';

/**
 * El gate de permisos del frontend.
 *
 * **Esconder un botón no es un permiso.** El gate que importa es el de la API
 * (`requireCapability`), y este componente existe sólo para no ofrecer una
 * acción que va a terminar en 403. Si alguna vez son lo único que protege algo,
 * es un bug del backend, no de acá.
 *
 * Dos modos, y la diferencia importa:
 *
 * - `hide` (default) — la acción no existe para este rol. Un contador no tiene
 *   por qué saber que hay un botón de "nueva actividad".
 * - `disable` — la acción existe y es parte del flujo, pero esta persona no
 *   puede hacerla. El control queda visible y apagado, con un tooltip que
 *   explica por qué. Esconderlo dejaría un hueco en una fila de botones y la
 *   sensación de que la pantalla está rota.
 *
 * Regla práctica: `hide` para secciones y altas enteras, `disable` para un
 * control adentro de algo que sí se está mirando.
 *
 * ```tsx
 * <Can I="payment.write"><Button>Registrar cobro</Button></Can>
 * <Can I="activity.plan" mode="disable"><Button>Editar fechas</Button></Can>
 * ```
 */
export function Can({
  I: capability,
  children,
  mode = 'hide',
  fallback = null,
  projectId: explicitProjectId,
}: {
  /** La capacidad que hace falta. Se lee `<Can I="payment.write">`. */
  I: Capability;
  children: ReactNode;
  mode?: 'hide' | 'disable';
  /** Qué mostrar cuando no se puede y el modo es `hide`. */
  fallback?: ReactNode;
  /** Por si el componente vive fuera de una ruta con `:projectId`. */
  projectId?: string;
}) {
  const { t } = useTranslation();
  const routeProjectId = useCurrentProjectId();
  const { can, isLoading } = useProjectCapabilities(explicitProjectId ?? routeProjectId);

  const allowed = can(capability);

  if (allowed) return <>{children}</>;

  // Mientras la obra carga, `can` devuelve false para todo. Mostrar el estado
  // "no podés" en ese momento haría parpadear un tooltip de permisos en cada
  // navegación; esconder sin explicación es el comportamiento correcto para un
  // instante que dura lo que tarda una request.
  if (mode === 'hide' || isLoading) return <>{fallback}</>;

  if (!isValidElement(children)) return <>{fallback}</>;

  const disabled = cloneElement(children as ReactElement<{ disabled?: boolean }>, {
    disabled: true,
  });

  return (
    <Tooltip>
      {/*
        El `span` no es decorativo: un control deshabilitado no emite eventos
        de puntero, así que sin un envoltorio que sí los emita el tooltip nunca
        aparecería — y el motivo del bloqueo quedaría invisible.
      */}
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0}>
          {disabled}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('permissions.notAllowed')}</TooltipContent>
    </Tooltip>
  );
}

export default Can;

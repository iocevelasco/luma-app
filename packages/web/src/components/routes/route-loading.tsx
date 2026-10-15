import { LoadingIndicator } from '@/components/common/loading-indicator';

/**
 * Loading component for route lazy loading.
 *
 * `inline` para rutas que ya están adentro de un chrome montado (header y barra
 * de navegación fijos). A pantalla completa el fallback empuja el layout y hace
 * saltar la barra en cada navegación.
 *
 * Es la misma animación que usa cada pantalla (`PageLayout`): una sola forma de
 * decir "esperá".
 */
export function RouteLoading({ inline = false }: { inline?: boolean }) {
  return <LoadingIndicator fullscreen={!inline} />;
}

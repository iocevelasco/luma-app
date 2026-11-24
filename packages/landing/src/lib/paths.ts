/** La landing se sirve bajo `/home` en local y en producción. */
export const LANDING_BASE = '/home';

export type LegalRoute = 'terminos' | 'privacidad' | 'baja-servicio';

export function legalRoute(pathname: string): LegalRoute | null {
  const path = pathname.replace(/\/+$/, '');
  if (path.endsWith('/terminos')) return 'terminos';
  if (path.endsWith('/privacidad')) return 'privacidad';
  if (path.endsWith('/baja-servicio')) return 'baja-servicio';
  return null;
}

export function landingHref(route: LegalRoute | 'home'): string {
  return route === 'home' ? LANDING_BASE : `${LANDING_BASE}/${route}`;
}

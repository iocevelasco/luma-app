/** La landing se sirve bajo `/home`. Las tres páginas legales viven en `/legal`. */
export const LANDING_BASE = '/home';
export const LEGAL_BASE = '/legal';

export type LegalRoute = 'terminos' | 'privacidad' | 'baja-servicio';

const LEGAL_ROUTES: LegalRoute[] = ['terminos', 'privacidad', 'baja-servicio'];

function isLegalRoute(value: string): value is LegalRoute {
  return (LEGAL_ROUTES as string[]).includes(value);
}

export function legalRoute(pathname: string): LegalRoute | null {
  const path = pathname.replace(/\/+$/, '');
  const page = path.startsWith(`${LEGAL_BASE}/`) ? path.slice(LEGAL_BASE.length + 1) : '';
  return isLegalRoute(page) ? page : null;
}

/** `/home/terminos` y compañía, de antes de mover las páginas a `/legal`. */
export function legacyLegalPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '');
  const page = path.startsWith(`${LANDING_BASE}/`) ? path.slice(LANDING_BASE.length + 1) : '';
  return isLegalRoute(page) ? `${LEGAL_BASE}/${page}` : null;
}

export function landingHref(route: LegalRoute | 'home'): string {
  return route === 'home' ? LANDING_BASE : `${LEGAL_BASE}/${route}`;
}

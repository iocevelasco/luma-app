export type LandingLegalPage = 'terminos' | 'privacidad' | 'baja-servicio';

/**
 * En producción las páginas legales viven en el mismo origen, bajo `/legal`.
 * En local la SPA está en el 6173 y la landing en el 5174.
 */
export function landingLegalUrl(
  page: LandingLegalPage,
  location: { protocol: string; hostname: string; port: string } = window.location,
): string {
  if (location.port === '6173' || location.port === '5174') {
    const protocol = location.protocol || 'http:';
    return `${protocol}//${location.hostname}:5174/legal/${page}`;
  }
  return `/legal/${page}`;
}

export type LandingLegalPage = 'terminos' | 'privacidad' | 'baja-servicio';

/**
 * En producción la landing vive en el mismo origen, bajo `/home`. En local la
 * SPA está en el 6173 y la landing en el 5174.
 */
export function landingLegalUrl(
  page: LandingLegalPage,
  location: { protocol: string; hostname: string; port: string } = window.location,
): string {
  if (location.port === '6173' || location.port === '6174') {
    const protocol = location.protocol || 'http:';
    return `${protocol}//${location.hostname}:5174/home/${page}`;
  }
  return `/home/${page}`;
}

/**
 * Términos y Condiciones y Política de Privacidad: un solo documento.
 *
 * `LEGAL_VERSION` es la versión vigente. Cuando el texto cambia de fondo se
 * sube, y toda cuenta con otra versión aceptada vuelve a ver el modal. Un
 * cambio de redacción que no altera derechos ni obligaciones no la toca.
 *
 * Formato ISO (AAAA-MM-DD): se compara por igualdad, nunca por orden.
 */
export const LEGAL_VERSION = '2026-10-24';

/**
 * Correo donde se ejercen los derechos sobre los datos. Es el valor por
 * defecto: la web lo puede pisar con `VITE_LEGAL_CONTACT_EMAIL` sin tocar código.
 */
export const LEGAL_CONTACT_EMAIL = 'legales@lumas.systems.com';

/** Cuánto se conserva una cuenta dada de baja antes de purgarla. */
export const ACCOUNT_PURGE_RETENTION_DAYS = 90;

/** ¿Esta persona aceptó el texto que rige hoy? */
export function hasAcceptedCurrentTerms(acceptedVersion?: string | null): boolean {
  return acceptedVersion === LEGAL_VERSION;
}

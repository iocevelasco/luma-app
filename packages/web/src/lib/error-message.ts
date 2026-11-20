import type { TFunction } from 'i18next';
import type { ApiErrorCode } from '@luma/shared';
import { isApiError } from './api-client';

/**
 * Convierte cualquier error en un texto que una persona entienda.
 *
 * **Un solo lugar.** Antes cada hook tenía su propio `errorMessage` con su
 * propio fallback, así que la misma falla decía una cosa en materiales y otra
 * en gastos.
 *
 * El criterio: **gana el mensaje del servidor**. "Esa cuota ya tiene cobros
 * registrados. Borrá los cobros primero." no se puede deducir del código —
 * sólo el servidor sabe por qué no se pudo. El mapa por código es para
 * cuando no hay mensaje, o cuando el que hay no le sirve a nadie (un 500
 * generico, una red caída).
 */

/** Claves bajo `errors.` en los archivos de traducción. */
const KEY_BY_CODE: Record<ApiErrorCode, string> = {
  VALIDATION: 'errors.validation',
  UNAUTHENTICATED: 'errors.unauthenticated',
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  WRONG_PASSWORD: 'errors.wrongPassword',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  CONFLICT: 'errors.conflict',
  MATERIAL_LOCKED: 'errors.materialLocked',
  PAYLOAD_TOO_LARGE: 'errors.payloadTooLarge',
  RATE_LIMITED: 'errors.rateLimited',
  SERVICE_UNAVAILABLE: 'errors.serviceUnavailable',
  SUBSCRIPTION_REQUIRED: 'errors.subscriptionRequired',
  PAID_PLAN_REQUIRED: 'errors.paidPlanRequired',
  TERMS_REQUIRED: 'errors.termsRequired',
  PASSWORD_NOT_SET: 'errors.passwordNotSet',
  GOOGLE_TOKEN_INVALID: 'errors.googleTokenInvalid',
  GOOGLE_EMAIL_NOT_VERIFIED: 'errors.googleEmailNotVerified',
  GOOGLE_SIGNUP_REQUIRED: 'errors.googleSignupRequired',
  GOOGLE_LINK_REQUIRED: 'errors.googleLinkRequired',
  GOOGLE_ALREADY_LINKED: 'errors.googleAlreadyLinked',
  GOOGLE_UNLINK_NEEDS_PASSWORD: 'errors.googleUnlinkNeedsPassword',
  GOOGLE_NOT_ALLOWED: 'errors.googleNotAllowed',
  INTERNAL: 'errors.internal',
};

/**
 * Los códigos donde el texto del servidor NO sirve y mandamos el nuestro.
 *
 * - `INTERNAL`: en producción el servidor manda un genérico a propósito —no
 *   cuenta qué se rompió adentro— así que el nuestro es igual de bueno y
 *   además está traducido.
 * - `UNAUTHENTICATED`: "No token provided" es correcto y no le dice nada a
 *   nadie.
 * - `INVALID_CREDENTIALS`: el servidor no sabe más que el código, y el nuestro
 *   está traducido.
 * - `WRONG_PASSWORD`: ídem — la contraseña que confirma un cambio en la cuenta
 *   no coincide, y eso es todo lo que hay para decir.
 * - `SUBSCRIPTION_REQUIRED` / `PAID_PLAN_REQUIRED`: el servidor no sabe nada
 *   que el código no diga, y el nuestro está traducido.
 * - Los de Google y `PASSWORD_NOT_SET`: lo mismo. El único con dos variantes,
 *   `GOOGLE_LINK_REQUIRED`, la dice en `details.reason` y la resuelve
 *   `GoogleAuthSection`.
 */
const PREFER_OWN_MESSAGE: ReadonlySet<string> = new Set<ApiErrorCode>([
  'INTERNAL',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'WRONG_PASSWORD',
  // Los límites de la suscripción no dependen de nada que sólo sepa el
  // servidor, y el texto propio está en el idioma de quien lo lee.
  'SUBSCRIPTION_REQUIRED',
  'PAID_PLAN_REQUIRED',
  'PASSWORD_NOT_SET',
  'GOOGLE_TOKEN_INVALID',
  'GOOGLE_EMAIL_NOT_VERIFIED',
  'GOOGLE_SIGNUP_REQUIRED',
  'GOOGLE_LINK_REQUIRED',
  'GOOGLE_ALREADY_LINKED',
  'GOOGLE_UNLINK_NEEDS_PASSWORD',
  'GOOGLE_NOT_ALLOWED',
]);

export function errorMessage(error: unknown, t: TFunction): string | null {
  if (!error) return null;

  if (isApiError(error)) {
    const code = error.code as ApiErrorCode | undefined;
    const key = code ? KEY_BY_CODE[code] : undefined;

    if (key && (PREFER_OWN_MESSAGE.has(code as string) || !error.message)) {
      return t(key);
    }
    if (error.message) return error.message;
    return t('errors.internal');
  }

  // `TypeError: Failed to fetch` es lo que tira el browser cuando no hay red.
  // Mostrarlo tal cual deja a la persona creyendo que la app tiene un bug.
  if (error instanceof TypeError) return t('errors.network');

  return error instanceof Error && error.message ? error.message : t('errors.internal');
}

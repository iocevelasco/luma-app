/**
 * El contrato de error entre la API y el frontend.
 *
 * Antes cada controller armaba su propia respuesta de error y el frontend
 * sólo podía leer el texto. Eso tiene dos problemas: el texto cambia cuando
 * alguien edita un mensaje —y con él se rompe cualquier `if` que lo
 * comparaba— y no hay forma de traducirlo ni de reaccionar distinto según
 * qué falló.
 *
 * Ahora toda respuesta de error lleva un `code`: estable, para la máquina.
 * El `error` es el texto para la persona, y el frontend lo usa tal cual
 * cuando el servidor sabe algo que el cliente no puede saber —"esa persona ya
 * tiene acceso a la obra"— o lo reemplaza por el suyo cuando el código le
 * alcanza.
 */

export type ApiErrorCode =
  /** Datos inválidos. Trae `details` con el detalle por campo. */
  | 'VALIDATION'
  /** Falta sesión o el token no vale. */
  | 'UNAUTHENTICATED'
  /** Hay sesión, pero este rol no puede. */
  | 'FORBIDDEN'
  /** No existe, o existe y no es de quien pregunta — ver abajo. */
  | 'NOT_FOUND'
  /** Choca con algo que ya está: un email repetido, una cuota con cobros. */
  | 'CONFLICT'
  /**
   * El material ya salió de Pendiente y no se corrige: ni se edita ni se
   * elimina. Aparte de `CONFLICT` para que la UI pueda reaccionar (refrescar la
   * fila) sin comparar el texto del mensaje.
   */
  | 'MATERIAL_LOCKED'
  /** El archivo es más grande que el límite. */
  | 'PAYLOAD_TOO_LARGE'
  /** Demasiadas requests. */
  | 'RATE_LIMITED'
  /** Una dependencia no está configurada o no responde (storage, IA). */
  | 'SERVICE_UNAVAILABLE'
  /** La suscripción de la Empresa venció: las obras están en sólo lectura. */
  | 'SUBSCRIPTION_REQUIRED'
  /**
   * En la prueba ya tiene 3 obras activas: para crear la cuarta tiene que
   * activar el plan pago, y eso termina la prueba ese día.
   */
  | 'PAID_PLAN_REQUIRED'
  /** Hay que aceptar los Términos y la Política de Privacidad para seguir. */
  | 'TERMS_REQUIRED'
  /** Cualquier otra cosa. Nunca lleva el detalle interno hacia afuera. */
  | 'INTERNAL';

/**
 * `NOT_FOUND` también cubre "no tenés acceso" a propósito: un 403 confirma
 * que el recurso existe, y el aislamiento entre clientes distintos pide lo
 * contrario. Ver `project.middleware.ts`.
 */

/** La forma de TODA respuesta de error de la API. */
export interface ApiErrorBody {
  success: false;
  /** Texto para la persona, ya en castellano. */
  error: string;
  code: ApiErrorCode;
  /**
   * En `VALIDATION`: qué campo falló y por qué. En un `CONFLICT` puede traer
   * con qué chocó, para que la UI ofrezca una salida (ver
   * `CrewDuplicateDetails`).
   */
  details?: unknown;
}

/** El status HTTP que le corresponde a cada código. */
export const STATUS_BY_ERROR_CODE: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  MATERIAL_LOCKED: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  // 402 Payment Required. `errorCodeForStatus(402)` devuelve el primero.
  SUBSCRIPTION_REQUIRED: 402,
  PAID_PLAN_REQUIRED: 402,
  // 403 como FORBIDDEN: `errorCodeForStatus(403)` devuelve el primero.
  TERMS_REQUIRED: 403,
  INTERNAL: 500,
};

/**
 * El código que le corresponde a un status, para normalizar las respuestas
 * que todavía se arman a mano en los controllers. Lo que no está mapeado cae
 * en `INTERNAL` si es 5xx y en `VALIDATION` si es 4xx: un 4xx sin código
 * específico casi siempre es un problema de lo que se mandó.
 */
export function errorCodeForStatus(status: number): ApiErrorCode {
  const direct = (Object.entries(STATUS_BY_ERROR_CODE) as [ApiErrorCode, number][]).find(
    ([, mapped]) => mapped === status,
  );
  if (direct) return direct[0];

  return status >= 500 ? 'INTERNAL' : 'VALIDATION';
}

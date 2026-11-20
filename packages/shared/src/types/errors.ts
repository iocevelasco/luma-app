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
  /** El login no coincide. Aparte de `UNAUTHENTICATED`: acá nunca hubo una sesión que se cerrara. */
  | 'INVALID_CREDENTIALS'
  /**
   * Hay sesión, y la contraseña que se pidió para confirmar una acción sobre la
   * cuenta (cambiar la contraseña, cambiar el correo) no es la de la cuenta.
   * Aparte de `UNAUTHENTICATED` y de `INVALID_CREDENTIALS`: la sesión sigue
   * valiendo. Nunca un 401 — ver `STATUS_BY_ERROR_CODE`.
   */
  | 'WRONG_PASSWORD'
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
  /**
   * La cuenta no tiene contraseña (entra sólo con Google) y la acción la pide:
   * cambiar la contraseña o el correo. Se crea con «Olvidé mi contraseña».
   */
  | 'PASSWORD_NOT_SET'
  /** La credencial de Google no vale: firma, emisor, audiencia o vencida. */
  | 'GOOGLE_TOKEN_INVALID'
  /** Google no da el correo de esa cuenta por verificado. */
  | 'GOOGLE_EMAIL_NOT_VERIFIED'
  /**
   * No hay cuenta con ese correo: crearla pide aceptar los Términos. Trae
   * `details: { email, name }` para que el diálogo diga con qué correo se crea.
   */
  | 'GOOGLE_SIGNUP_REQUIRED'
  /**
   * Hay una cuenta con ese correo y Google no se une solo: se conecta poniendo
   * la contraseña una vez (ADR-005 §1). `details.reason`: `password` (entrar
   * con la contraseña y conectar) o `invited` (activar desde el correo).
   */
  | 'GOOGLE_LINK_REQUIRED'
  /** Esa cuenta de Google ya está conectada a otra cuenta de Luma. */
  | 'GOOGLE_ALREADY_LINKED'
  /** Desconectar Google dejaría la cuenta sin forma de entrar. */
  | 'GOOGLE_UNLINK_NEEDS_PASSWORD'
  /** Esta cuenta no puede usar Google (los admins de plataforma). */
  | 'GOOGLE_NOT_ALLOWED'
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
  // 401 como UNAUTHENTICATED: `errorCodeForStatus(401)` devuelve el primero.
  INVALID_CREDENTIALS: 401,
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
  // 403 y no 401: el cliente lee todo 401 con token como sesión vencida —
  // renueva, reintenta y, si vuelve a fallar, cierra la sesión. Una contraseña
  // mal escrita en "Mi cuenta" no puede desloguear a nadie.
  // Va después de FORBIDDEN: `errorCodeForStatus(403)` devuelve el primero.
  WRONG_PASSWORD: 403,
  // Ninguno de Google sale con 401: el popup de Google pasa también con sesión
  // abierta (conectar desde la cuenta), y un 401 la cerraría. Todos van después
  // del genérico de su status, así `errorCodeForStatus` no cambia.
  PASSWORD_NOT_SET: 409,
  GOOGLE_TOKEN_INVALID: 400,
  GOOGLE_EMAIL_NOT_VERIFIED: 400,
  GOOGLE_SIGNUP_REQUIRED: 409,
  GOOGLE_LINK_REQUIRED: 409,
  GOOGLE_ALREADY_LINKED: 409,
  GOOGLE_UNLINK_NEEDS_PASSWORD: 409,
  GOOGLE_NOT_ALLOWED: 403,
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

/**
 * Lo que la SPA necesita saber del entorno y la API le dice en runtime
 * (`GET /api/public/config`, sin sesión). Una variable horneada en el build
 * (`VITE_*`) exige reconstruir la imagen para cambiarla y puede no coincidir
 * con la de la API; esto no.
 *
 * Cada integración llega completa o en `null`: `null` = la entrega está
 * deshabilitada en este entorno y la UI no la ofrece.
 */
export interface PublicConfig {
  /** Importar y exportar con Google Drive (ADR-005 §4). */
  drive: DrivePublicConfig | null;
}

/** Datos públicos del proyecto de Google Cloud para el Picker. Ninguno es secreto. */
export interface DrivePublicConfig {
  /** Client id del cliente OAuth web. */
  clientId: string;
  /** Clave de navegador con la Picker API, restringida por dominio. */
  apiKey: string;
  /** Número del proyecto de Google Cloud: el `appId` del Picker. */
  appId: string;
}

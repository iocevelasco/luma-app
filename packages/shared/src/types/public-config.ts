/**
 * Lo que la SPA necesita saber del entorno y la API le dice en runtime. Una
 * variable horneada en el build (`VITE_*`) exige reconstruir la imagen para
 * cambiarla y puede no coincidir con la de la API; esto no.
 *
 * Cada integración llega completa o en `null`: `null` = la entrega está
 * deshabilitada en este entorno y la UI no la ofrece.
 *
 * Va en dos partes según quién la necesita:
 * - `PublicConfig` (`GET /api/public/config`, sin sesión): sólo lo que las
 *   pantallas públicas usan antes de entrar, el client id del botón de Google.
 * - `IntegrationsConfig` (`GET /api/config/integrations`, con sesión): las
 *   claves de Maps y Drive, que sólo se usan adentro de la app. Son claves de
 *   navegador (terminan en el navegador igual); con sesión, al menos no las
 *   levanta cualquiera que pegue la URL.
 */
export interface PublicConfig {
  /** Entrar y registrarse con Google (ADR-005 §1). */
  googleLogin: GoogleLoginConfig | null;
}

export interface IntegrationsConfig {
  /** Autocompletar la dirección de la obra y verla en el mapa (ADR-005 §2). */
  maps: MapsIntegrationConfig | null;
  /** Importar y exportar con Google Drive (ADR-005 §4). */
  drive: DriveIntegrationConfig | null;
}

/**
 * Lo que el Picker de Drive necesita. Va con sesión (`IntegrationsConfig`):
 * ninguno es secreto, pero no se reparte a quien no entró.
 */
export interface DriveIntegrationConfig {
  /** Client id del cliente OAuth web. */
  clientId: string;
  /** Clave de navegador con la Picker API, restringida por dominio. */
  apiKey: string;
  /** Número del proyecto de Google Cloud: el `appId` del Picker. */
  appId: string;
}

/** Lo que el botón de Google necesita. El client id no es secreto: va sin sesión. */
export interface GoogleLoginConfig {
  clientId: string;
}

/**
 * Clave de navegador con Maps JavaScript API, Places API (New) y Maps Embed
 * API. Va con sesión (`IntegrationsConfig`), pero termina en el navegador igual:
 * lo que la protege es la restricción por dominio y por API, y la cuota, en
 * Google Cloud.
 */
export interface MapsIntegrationConfig {
  apiKey: string;
}

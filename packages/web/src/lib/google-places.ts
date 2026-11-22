import { loadGoogleScript } from './google-scripts';

/**
 * Google Maps para la dirección de la obra (ADR-005 §2).
 *
 * El autocompletado usa `AutocompleteSuggestion` del SDK de Maps JavaScript,
 * que está hecho para el navegador y acepta una clave restringida por dominio.
 * La API REST de Places pide claves restringidas por IP (es un servicio web) y
 * desde el navegador quedaría expuesta o rechazada: por eso no se usa.
 *
 * El script se carga recién cuando la persona escribe en el campo, no al abrir
 * la pantalla: nada sale hacia Google sin una acción suya.
 *
 * Lo único que se guarda es el `placeId`. Ni coordenadas ni las sugerencias:
 * las políticas de Places no lo permiten más allá de 30 días.
 *
 * El mapa es un iframe de Maps Embed (sin costo por uso) y "Cómo llegar" es un
 * enlace a Google Maps: ninguno de los dos usa este SDK.
 */

const MAPS_URL = 'https://maps.googleapis.com/maps/api/js';

/** Antes de esto no se le pregunta nada a Google: cada request se cobra. */
export const MIN_QUERY_LENGTH = 3;
/** Espera entre teclas antes de preguntar. */
export const QUERY_DEBOUNCE_MS = 300;

export interface PlaceSuggestion {
  placeId: string;
  /** La dirección completa, la que queda en el campo al elegirla. */
  text: string;
  /** Primera línea (calle y número) y segunda (localidad), para la lista. */
  main: string;
  secondary?: string;
}

// ── Tipos mínimos del SDK ───────────────────────────────────────────────────

interface FormattableText {
  text?: string;
}

interface SdkSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: FormattableText | null;
    mainText?: FormattableText | null;
    secondaryText?: FormattableText | null;
  } | null;
}

interface PlacesLibrary {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string;
      sessionToken?: object;
      language?: string;
    }): Promise<{ suggestions: SdkSuggestion[] }>;
  };
}

/** Lo que se usa de `google.maps`. */
export interface GoogleMapsNamespace {
  importLibrary(name: 'places'): Promise<unknown>;
}

// ── Carga ───────────────────────────────────────────────────────────────────

const mapsReady = () => typeof window.google?.maps?.importLibrary === 'function';
let placesLibrary: Promise<PlacesLibrary> | null = null;

/** Lo llama Google cuando la API terminó de cargar (`&callback=`). */
const READY_CALLBACK = '__lumaMapsReady';
/** Sin respuesta en este tiempo (la CSP o una extensión frenaron `main.js`) se da por fallida. */
export const MAPS_LOAD_TIMEOUT_MS = 15_000;

/**
 * Con `loading=async`, el script de la URL es sólo un cargador: define `google.maps`
 * y recién después pide `main.js`, que es el que trae `importLibrary`. Su `onload`
 * llega antes de que la API esté lista, así que se espera el `callback` de Google.
 */
function waitForMaps(apiKey: string): Promise<void> {
  if (mapsReady()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Google Maps no terminó de cargar')), MAPS_LOAD_TIMEOUT_MS);
    const win = window as unknown as Record<string, unknown>;
    win[READY_CALLBACK] = () => {
      window.clearTimeout(timer);
      resolve();
    };
    loadGoogleScript(
      `${MAPS_URL}?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${READY_CALLBACK}`,
      // El cargador ya corrió: lo que falta lo avisa el callback.
      () => typeof window.google?.maps === 'object',
    ).catch((error: unknown) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

function loadPlaces(apiKey: string): Promise<PlacesLibrary> {
  placesLibrary ??= waitForMaps(apiKey)
    .then(() => window.google!.maps!.importLibrary('places') as Promise<PlacesLibrary>)
    .catch((error: unknown) => {
      // Que el próximo intento pruebe de nuevo (p. ej. volvió la conexión).
      placesLibrary = null;
      throw error;
    });
  return placesLibrary;
}

/** Sólo para tests. */
export function resetPlacesLibrary(): void {
  placesLibrary = null;
}

// ── Sugerencias ─────────────────────────────────────────────────────────────

/**
 * Agrupa las preguntas de una búsqueda en una sesión de facturación. Se crea
 * con la primera pregunta y se descarta al elegir una sugerencia.
 */
export interface PlacesSession {
  token?: object;
}

export function newPlacesSession(): PlacesSession {
  return {};
}

/** El idioma de la app en el formato de Google (`language`). */
export function mapsLanguage(language: string | undefined): string {
  if (!language) return 'es';
  if (language === 'es-AR') return 'es-419';
  if (language.startsWith('pt')) return 'pt-BR';
  if (language.startsWith('es')) return 'es';
  return language;
}

export function parseSuggestions(suggestions: SdkSuggestion[] | undefined): PlaceSuggestion[] {
  return (suggestions ?? []).flatMap(({ placePrediction: p }) => {
    const text = p?.text?.text?.trim();
    if (!p?.placeId || !text) return [];
    const main = p.mainText?.text?.trim() || text;
    const secondary = p.secondaryText?.text?.trim() || undefined;
    return [{ placeId: p.placeId, text, main, secondary }];
  });
}

export async function fetchPlaceSuggestions(
  apiKey: string,
  input: string,
  session: PlacesSession,
  language: string,
): Promise<PlaceSuggestion[]> {
  const places = await loadPlaces(apiKey);
  session.token ??= new places.AutocompleteSessionToken();
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken: session.token,
    language,
  });
  return parseSuggestions(suggestions);
}

/** El iframe de Maps Embed para un lugar. Host fijo; todo lo variable, escapado. */
export function mapEmbedUrl(apiKey: string, placeId: string, language: string): string {
  const params = new URLSearchParams({ key: apiKey, q: `place_id:${placeId}`, language });
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

/** "Cómo llegar": un enlace a Google Maps, sin API. Con lugar, apunta a ese lugar exacto. */
export function directionsUrl(location: string, placeId?: string): string {
  const params = new URLSearchParams({ api: '1', destination: location });
  if (placeId) params.set('destination_place_id', placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Google Maps para la dirección de la obra (ADR-005 §2).
 *
 * El autocompletado va por la API REST de Places (New) directo desde el
 * navegador, con la clave de navegador restringida por dominio: es el mismo
 * producto y el mismo precio que `AutocompleteSuggestion` del SDK de Maps, sin
 * cargar el script de Maps (unos cientos de KB y más orígenes en la CSP).
 *
 * Lo único que se guarda es el `placeId`. Ni coordenadas ni las sugerencias:
 * las políticas de Places no lo permiten más allá de 30 días.
 *
 * El mapa es un iframe de Maps Embed (sin costo por uso) y "Cómo llegar" es un
 * enlace a Google Maps: ninguno de los dos usa la API de Places.
 */

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

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

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
    };
  }[];
}

export class PlacesError extends Error {
  constructor(public readonly status: number) {
    super(`Places respondió ${status}`);
    this.name = 'PlacesError';
  }
}

/**
 * Agrupa los requests de una búsqueda en una sesión de facturación. Se cambia
 * al elegir una sugerencia. `crypto.randomUUID` llega a Safari en 15.4: antes,
 * un UUID v4 armado con `getRandomValues`.
 */
export function newSessionToken(): string {
  const crypto = window.crypto;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** El idioma de la app en el formato de Google (`languageCode`, `language`). */
export function mapsLanguage(language: string | undefined): string {
  if (!language) return 'es';
  if (language === 'es-AR') return 'es-419';
  if (language.startsWith('pt')) return 'pt-BR';
  if (language.startsWith('es')) return 'es';
  return language;
}

export function parseSuggestions(body: AutocompleteResponse): PlaceSuggestion[] {
  return (body.suggestions ?? []).flatMap(({ placePrediction: p }) => {
    const text = p?.text?.text?.trim();
    if (!p?.placeId || !text) return [];
    const main = p.structuredFormat?.mainText?.text?.trim() || text;
    const secondary = p.structuredFormat?.secondaryText?.text?.trim() || undefined;
    return [{ placeId: p.placeId, text, main, secondary }];
  });
}

export async function fetchPlaceSuggestions(
  apiKey: string,
  input: string,
  sessionToken: string,
  language: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const response = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // Sólo lo que se muestra: el FieldMask también acota lo que se cobra.
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({ input, sessionToken, languageCode: language }),
    signal,
  });
  if (!response.ok) throw new PlacesError(response.status);
  return parseSuggestions((await response.json()) as AutocompleteResponse);
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

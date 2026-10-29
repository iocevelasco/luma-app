/**
 * Qué novedades vio cada persona. Vive en `localStorage` y no en la base: ver
 * una novedad repetida en otro dispositivo no le cuesta nada a nadie, y no hay
 * motivo para un campo más en `User`.
 *
 * - **Por persona**: en una computadora de obra, la que usa uno la usa el
 *   siguiente. Una sola clave con un mapa `{ [userId]: últimaEntradaVista }`.
 * - **La clave sobrevive a un deploy.** `version-manager` limpia el
 *   `localStorage` en cada cambio de versión, y `luma:novedades:visto` está en
 *   su lista de claves que se preservan: sin eso, el deploy que trae la
 *   novedad borraría justo lo que dice que ya la viste.
 * - Todo acceso va en `try/catch`: en Safari con navegación privada, o con los
 *   datos del sitio bloqueados, el acceso tira. Sin storage `available` es
 *   `false` y la pantalla **no enciende ningún punto** — uno que no se puede
 *   apagar enseña a ignorarlo.
 */
export const RELEASE_SEEN_KEY = 'luma:novedades:visto';

export interface LastSeen {
  /** `false`: no hay dónde recordarlo, así que no se avisa. */
  available: boolean;
  id: string | null;
}

const UNAVAILABLE: LastSeen = { available: false, id: null };

function storage(): Storage | null {
  try {
    return typeof window.localStorage === 'object' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readMap(store: Storage): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(store.getItem(RELEASE_SEEN_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    // Un valor que no es JSON no rompe nada: se lo trata como "no vio ninguna".
    return {};
  }
}

export function loadLastSeen(userId: string): LastSeen {
  try {
    const store = storage();
    if (!store) return UNAVAILABLE;
    return { available: true, id: readMap(store)[userId] ?? null };
  } catch {
    return UNAVAILABLE;
  }
}

export function saveLastSeen(userId: string, entryId: string): void {
  try {
    const store = storage();
    if (!store) return;
    store.setItem(RELEASE_SEEN_KEY, JSON.stringify({ ...readMap(store), [userId]: entryId }));
  } catch {
    // Sin dónde guardarlo no hay punto (ver `loadLastSeen`): no hace falta avisar.
  }
}

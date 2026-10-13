/**
 * Identidad de un build de la SPA: la versión semver de `packages/web/package.json`
 * y el instante en que se compiló.
 *
 * Los dos viajan en el bundle (`VITE_APP_VERSION`, `VITE_APP_BUILD_TIME`) y en
 * `/version.json`, que se genera en el mismo build. Comparar el bundle contra el
 * archivo es lo que le dice a una pestaña abierta hace días que hay un deploy
 * nuevo.
 */
export interface BuildInfo {
  version: string;
  /** ISO 8601. `null` si el lado que publica no lo informa (builds viejos). */
  buildTime: string | null;
}

/**
 * ¿El servidor sirve un build distinto al que esta pestaña tiene cargado?
 *
 * La versión semver manda: es lo que la persona ve y lo que el equipo sube a
 * propósito en cada deploy. El `buildTime` es la red: un deploy sin bump deja la
 * versión igual, pero el bundle cambió y la pestaña quedó vieja igual.
 *
 * Sólo se compara `buildTime` si **ambos** lados lo tienen. Con uno solo no hay
 * contra qué comparar, y declarar "hay update" por un campo ausente dispararía
 * el aviso en cada chequeo.
 */
export function hasNewBuild(current: BuildInfo, server: BuildInfo): boolean {
  if (server.version !== current.version) return true;
  if (current.buildTime === null || server.buildTime === null) return false;
  return server.buildTime !== current.buildTime;
}

/**
 * Lee el cuerpo de `/version.json`. Devuelve `null` ante cualquier cosa que no
 * sea un `{ version: string }` válido — en dev el archivo no existe y el
 * fallback SPA responde HTML con 200, y un deploy a medias puede dejar un
 * archivo truncado. Ninguno de los dos es "hay update".
 */
export function parseBuildInfo(raw: string): BuildInfo | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof data !== 'object' || data === null) return null;
  const { version, buildTime } = data as { version?: unknown; buildTime?: unknown };

  if (typeof version !== 'string' || version.length === 0) return null;

  return {
    version,
    buildTime: typeof buildTime === 'string' && buildTime.length > 0 ? buildTime : null,
  };
}

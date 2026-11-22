/** Origen de la web y el subpath de la SPA (`/app` en producción). */
export interface WebTarget {
  origin: string;
  base: string;
}

/**
 * `EXPO_PUBLIC_WEB_ORIGIN` puede ser el origen pelado (`http://192.168.1.10:6173`)
 * o la raíz de la SPA (`https://luma.example/app`). La API vive siempre en el
 * origen, en `/api`.
 */
export function resolveWebTarget(rawOrigin: string, rawBase?: string): WebTarget {
  const parsed = new URL(rawOrigin);
  const fromPath = parsed.pathname.replace(/\/+$/, '');
  const chosen = rawBase?.trim() ? rawBase.trim() : fromPath;
  const base = !chosen || chosen === '/' ? '' : chosen.startsWith('/') ? chosen.replace(/\/+$/, '') : `/${chosen.replace(/\/+$/, '')}`;
  return { origin: parsed.origin, base };
}

export function joinPath(base: string, path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return !base || base === '/' ? suffix : `${base}${suffix}`;
}

export function loginUrl(target: WebTarget): string {
  return `${target.origin}/api/auth/login`;
}

export function appEntryUrl(target: WebTarget): string {
  return `${target.origin}${joinPath(target.base, '/admin')}`;
}

export function forgotPasswordUrl(target: WebTarget): string {
  return `${target.origin}${joinPath(target.base, '/forgot-password')}`;
}

/** La web llegó a su login: la sesión de la página terminó. */
export function isLoginUrl(url: string, target: WebTarget): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return false;
  }
  return pathname === joinPath(target.base, '/login');
}

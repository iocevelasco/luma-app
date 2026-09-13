/**
 * Detección de entorno que funciona igual en el browser y en Node.
 *
 * No hay dominio hardcodeado acá a propósito: en el browser decide el hostname
 * (localhost o red privada = desarrollo) y, si no, el MODE de Vite; en Node
 * decide NODE_ENV. Cuando el proyecto tenga dominio propio no hace falta tocar
 * este archivo.
 */

declare const window: (Window & typeof globalThis) | undefined;
declare const process: NodeJS.Process | undefined;

export type Environment = 'production' | 'development' | 'test';

export interface EnvironmentInfo {
  environment: Environment;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  hostname: string | null;
  isLocalhost: boolean;
}

export function getHostname(): string | null {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname;
  }

  if (typeof process !== 'undefined') {
    return process.env.HOSTNAME || null;
  }

  return null;
}

export function isLocalhost(hostname?: string | null): boolean {
  const host = hostname ?? getHostname();
  if (!host) return false;

  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.')
  );
}

export function isProduction(hostname?: string | null): boolean {
  const host = hostname ?? getHostname();

  // Un hostname de red local gana sobre cualquier otra señal: si estás en
  // localhost no estás en producción, diga lo que diga NODE_ENV.
  if (host && isLocalhost(host)) {
    return false;
  }

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return true;
  }

  if (typeof window !== 'undefined') {
    // `import.meta.env` sólo existe cuando lo compila Vite; en Node este
    // archivo se ejecuta con module Node16 y TS no lo acepta.
    // @ts-expect-error - variables de entorno de Vite
    if (import.meta?.env?.MODE === 'production') {
      return true;
    }
  }

  return false;
}

export function isDevelopment(hostname?: string | null): boolean {
  return !isProduction(hostname);
}

export function getEnvironment(hostname?: string | null): Environment {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return 'test';
  }

  return isProduction(hostname) ? 'production' : 'development';
}

export function getEnvironmentInfo(hostname?: string | null): EnvironmentInfo {
  const host = hostname ?? getHostname();
  const env = getEnvironment(host);

  return {
    environment: env,
    isProduction: isProduction(host),
    isDevelopment: isDevelopment(host),
    isTest: env === 'test',
    hostname: host,
    isLocalhost: isLocalhost(host),
  };
}

/**
 * URL base de la API.
 * En producción devuelve cadena vacía: la SPA y la API comparten origen, así que
 * las URLs relativas son correctas y evitan un preflight de CORS por request.
 */
export function getApiBaseUrl(devUrl?: string, productionUrl: string = ''): string {
  if (isProduction()) {
    return productionUrl;
  }

  return devUrl || 'http://localhost:8080';
}

/** reCAPTCHA se desactiva en localhost: en desarrollo no hay site key válida. */
export function shouldEnableRecaptcha(hostname?: string | null): boolean {
  const host = hostname ?? getHostname();

  if (isLocalhost(host)) {
    return false;
  }

  return isProduction(host);
}

import { resolveWebTarget, type WebTarget } from './urls';

export interface MobileConfig {
  target: WebTarget;
  clientKey: string;
}

/** Lo que la app necesita para hablar con la web. Vacío si falta alguna variable. */
export function readConfig(override?: {
  EXPO_PUBLIC_WEB_ORIGIN?: string;
  EXPO_PUBLIC_MOBILE_CLIENT_KEY?: string;
  EXPO_PUBLIC_WEB_BASE?: string;
}): MobileConfig | { error: string } {
  // Expo sustituye process.env.EXPO_PUBLIC_* al compilar el APK. Si se lee
  // process.env y después la clave, esa sustitución no ocurre y la app
  // instalada ve la variable vacía aunque esté cargada en EAS.
  const rawOrigin = (override?.EXPO_PUBLIC_WEB_ORIGIN ?? process.env.EXPO_PUBLIC_WEB_ORIGIN)?.trim() ?? '';
  const clientKey = (override?.EXPO_PUBLIC_MOBILE_CLIENT_KEY ?? process.env.EXPO_PUBLIC_MOBILE_CLIENT_KEY)?.trim() ?? '';
  if (!rawOrigin) return { error: 'Falta EXPO_PUBLIC_WEB_ORIGIN.' };
  if (!clientKey) return { error: 'Falta EXPO_PUBLIC_MOBILE_CLIENT_KEY.' };
  try {
    return {
      target: resolveWebTarget(rawOrigin, override?.EXPO_PUBLIC_WEB_BASE ?? process.env.EXPO_PUBLIC_WEB_BASE),
      clientKey,
    };
  } catch {
    return { error: 'EXPO_PUBLIC_WEB_ORIGIN no es una URL válida.' };
  }
}

export function isMobileConfig(value: MobileConfig | { error: string }): value is MobileConfig {
  return 'target' in value;
}

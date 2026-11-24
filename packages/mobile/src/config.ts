import { resolveWebTarget, type WebTarget } from './urls';

export interface MobileConfig {
  target: WebTarget;
  clientKey: string;
}

/** Lo que la app necesita para hablar con la web. Vacío si falta alguna variable. */
export function readConfig(
  env: Record<string, string | undefined> = process.env,
): MobileConfig | { error: string } {
  const rawOrigin = env.EXPO_PUBLIC_WEB_ORIGIN?.trim() ?? '';
  const clientKey = env.EXPO_PUBLIC_MOBILE_CLIENT_KEY?.trim() ?? '';
  if (!rawOrigin) return { error: 'Falta EXPO_PUBLIC_WEB_ORIGIN.' };
  if (!clientKey) return { error: 'Falta EXPO_PUBLIC_MOBILE_CLIENT_KEY.' };
  try {
    return { target: resolveWebTarget(rawOrigin, env.EXPO_PUBLIC_WEB_BASE), clientKey };
  } catch {
    return { error: 'EXPO_PUBLIC_WEB_ORIGIN no es una URL válida.' };
  }
}

export function isMobileConfig(value: MobileConfig | { error: string }): value is MobileConfig {
  return 'target' in value;
}

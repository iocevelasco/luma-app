import { Platform, TurboModuleRegistry } from 'react-native';

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

type CookieClient = {
  set: (
    url: string,
    cookie: {
      name: string;
      value: string;
      path: string;
      secure: boolean;
      httpOnly: boolean;
      sameSite: 'lax';
      maxAge: number;
    },
    options?: { iosCookieStore: 'webKit' },
  ) => Promise<boolean>;
  clearByName: (url: string, name: string, options?: { iosCookieStore: 'webKit' }) => Promise<boolean>;
};

/**
 * Expo Go no trae este módulo: importarlo revienta al abrir con
 * `CookieManager could not be found`. Solo se carga si el binario lo tiene
 * (un build de desarrollo). Sin él, la página igual entra con el access token.
 */
function loadCookieManager(): CookieClient | null {
  if (TurboModuleRegistry.get('CookieManager') == null) return null;
  return require('@preeternal/react-native-cookie-manager').default as CookieClient;
}

/**
 * La cookie que la web usa para renovar el access token. El fetch del login
 * nativo no la deja en el WebView, así que se planta en el almacén que la
 * página sí lee. Si el binario no tiene el módulo, no hace nada.
 */
export async function plantRefreshCookie(origin: string, refreshToken: string): Promise<void> {
  const cookies = loadCookieManager();
  if (!cookies) return;

  const cookie = {
    name: 'refresh_token',
    value: refreshToken,
    path: '/',
    secure: origin.startsWith('https:'),
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: NINETY_DAYS_SECONDS,
  };
  if (Platform.OS === 'ios') {
    await cookies.set(origin, cookie, { iosCookieStore: 'webKit' });
  }
  await cookies.set(origin, cookie);
}

export async function clearRefreshCookie(origin: string): Promise<void> {
  const cookies = loadCookieManager();
  if (!cookies) return;

  if (Platform.OS === 'ios') {
    await cookies.clearByName(origin, 'refresh_token', { iosCookieStore: 'webKit' });
  }
  await cookies.clearByName(origin, 'refresh_token');
}

import { Platform } from 'react-native';
import CookieManager from '@preeternal/react-native-cookie-manager';

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

/**
 * La cookie que la web usa para renovar el access token. El fetch del login
 * nativo no la deja en el WebView, así que se planta en el almacén que la
 * página sí lee.
 */
export async function plantRefreshCookie(origin: string, refreshToken: string): Promise<void> {
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
    await CookieManager.set(origin, cookie, { iosCookieStore: 'webKit' });
  }
  await CookieManager.set(origin, cookie);
}

export async function clearRefreshCookie(origin: string): Promise<void> {
  if (Platform.OS === 'ios') {
    await CookieManager.clearByName(origin, 'refresh_token', { iosCookieStore: 'webKit' });
  }
  await CookieManager.clearByName(origin, 'refresh_token');
}

import * as SecureStore from 'expo-secure-store';

/** Lo que el WebView necesita para arrancar ya adentro. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  user: unknown;
  /** Milisegundos desde el login, el tope de 30 días de la web. */
  sessionStart: string;
}

const ACCESS = 'luma.access';
const REFRESH = 'luma.refresh';
const USER = 'luma.user';
const STARTED = 'luma.started';

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, session.accessToken);
  await SecureStore.setItemAsync(REFRESH, session.refreshToken);
  await SecureStore.setItemAsync(USER, JSON.stringify(session.user));
  await SecureStore.setItemAsync(STARTED, session.sessionStart);
}

export async function loadSession(): Promise<Session | null> {
  const [accessToken, refreshToken, userRaw, sessionStart] = await Promise.all([
    SecureStore.getItemAsync(ACCESS),
    SecureStore.getItemAsync(REFRESH),
    SecureStore.getItemAsync(USER),
    SecureStore.getItemAsync(STARTED),
  ]);
  if (!accessToken || !refreshToken || !userRaw || !sessionStart) return null;
  try {
    return { accessToken, refreshToken, user: JSON.parse(userRaw) as unknown, sessionStart };
  } catch {
    return null;
  }
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS),
    SecureStore.deleteItemAsync(REFRESH),
    SecureStore.deleteItemAsync(USER),
    SecureStore.deleteItemAsync(STARTED),
  ]);
}

/**
 * Corre antes del JavaScript de la página. Repone el access token de esta
 * sesión y no toca `session_start_time` si la página ya lo tiene: renovar el
 * token no debe reiniciar los 30 días.
 */
export function sessionBootstrapScript(session: Session): string {
  const token = JSON.stringify(session.accessToken);
  const user = JSON.stringify(JSON.stringify(session.user));
  const start = JSON.stringify(session.sessionStart);
  return `(() => {
    try {
      localStorage.setItem('auth_token', ${token});
      localStorage.setItem('auth_user', ${user});
      if (!localStorage.getItem('session_start_time')) {
        localStorage.setItem('session_start_time', ${start});
      }
    } catch (e) {}
  })();
  true;`;
}

export function sessionClearScript(): string {
  return `(() => {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('session_start_time');
    } catch (e) {}
  })();
  true;`;
}

export function isSessionEndedMessage(data: string): boolean {
  try {
    return (JSON.parse(data) as { type?: string }).type === 'session-ended';
  } catch {
    return false;
  }
}
